#!/usr/bin/env python3
"""
Check CloudFront Invalidation Status Script
===========================================

This script checks the status of the most recent CloudFront invalidation.

USAGE:
    python scripts/aws/cloudfront/check_invalidation.py [distribution_id] [options]
    
    Examples:
    # Check most recent invalidation (auto-detect distribution)
    python scripts/aws/cloudfront/check_invalidation.py
    
    # Check with specific distribution ID
    python scripts/aws/cloudfront/check_invalidation.py EF3FG0T13DT34
    
    # Check with domain name
    python scripts/aws/cloudfront/check_invalidation.py --domain d2dtpxz4sf6hir.cloudfront.net
    
    # Check with different region
    python scripts/aws/cloudfront/check_invalidation.py --region us-west-2
"""

import sys
import os
import boto3
from botocore.exceptions import ClientError
import argparse
import time
from datetime import datetime, timedelta

# Import SSO authentication utility
# Add parent directory (scripts/aws) to path to import aws_sso_auth
_aws_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _aws_dir not in sys.path:
    sys.path.insert(0, _aws_dir)
from sso.aws_sso_auth import ensure_sso_authenticated, get_boto3_session

# Default CloudFront domain
DEFAULT_CLOUDFRONT_DOMAIN = 'd2dtpxz4sf6hir.cloudfront.net'

# Default polling interval for watching invalidations (in seconds)
DEFAULT_INTERVAL = 10

# Fix Windows console encoding for emoji support
if sys.platform == 'win32':
    try:
        # Try to set UTF-8 encoding for stdout/stderr
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8')
        if hasattr(sys.stderr, 'reconfigure'):
            sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        # If that fails, we'll use ASCII-safe alternatives
        pass

def get_cloudfront_client(region='us-east-1'):
    """Get CloudFront client using AWS SSO authentication."""
    # Ensure SSO authentication is active
    if not ensure_sso_authenticated():
        print("❌ Error: Failed to authenticate with AWS SSO")
        print("   Please ensure you have completed the SSO setup.")
        return None
    
    try:
        # Get boto3 session with SSO profile
        session = get_boto3_session()
        # CloudFront is a global service, but boto3 requires a region
        # We use us-east-1 as default
        return session.client('cloudfront', region_name=region)
    except Exception as e:
        print(f"❌ Error connecting to CloudFront: {e}")
        return None

def get_distribution_id_from_domain(cloudfront_client, domain_name):
    """Get distribution ID from domain name."""
    try:
        print(f"🔍 Looking up distribution ID for domain: {domain_name}")
        
        paginator = cloudfront_client.get_paginator('list_distributions')
        for page in paginator.paginate():
            distributions = page.get('DistributionList', {}).get('Items', [])
            for dist in distributions:
                # Check if domain matches
                if dist.get('DomainName') == domain_name:
                    dist_id = dist.get('Id')
                    dist_name = dist.get('Comment', dist.get('Aliases', {}).get('Items', [None])[0] if dist.get('Aliases', {}).get('Items') else 'N/A')
                    print(f"✅ Found distribution: {dist_id} ({dist_name})")
                    return dist_id
                
                # Also check aliases
                aliases = dist.get('Aliases', {}).get('Items', [])
                if domain_name in aliases:
                    dist_id = dist.get('Id')
                    dist_name = dist.get('Comment', aliases[0] if aliases else 'N/A')
                    print(f"✅ Found distribution: {dist_id} ({dist_name})")
                    return dist_id
        
        print(f"❌ Error: No distribution found with domain name: {domain_name}")
        return None
    except Exception as e:
        print(f"❌ Error looking up distribution: {e}")
        return None

def format_datetime(dt):
    """Format datetime object to readable string."""
    if dt is None:
        return 'N/A'
    return dt.strftime('%Y-%m-%d %H:%M:%S UTC')

def format_status(status):
    """Format status with appropriate emoji."""
    status_map = {
        'InProgress': '🔄',
        'Completed': '✅',
    }
    emoji = status_map.get(status, '❓')
    return f"{emoji} {status}"

def get_invalidation_by_id(cloudfront_client, distribution_id, invalidation_id):
    """Get a specific invalidation by ID."""
    try:
        response = cloudfront_client.get_invalidation(
            DistributionId=distribution_id,
            Id=invalidation_id
        )
        return response.get('Invalidation', {})
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'NoSuchInvalidation':
            return None
        elif error_code == 'NoSuchDistribution':
            print(f"❌ Error: Distribution '{distribution_id}' does not exist")
        elif error_code == 'AccessDenied':
            print(f"❌ Error: Access denied to distribution '{distribution_id}'")
            print("   Please check your AWS credentials and IAM permissions")
        else:
            print(f"❌ Error fetching invalidation: {e}")
        return None
    except Exception as e:
        print(f"❌ Unexpected error fetching invalidation: {e}")
        return None

def get_most_recent_invalidation(cloudfront_client, distribution_id):
    """Get the most recent invalidation for a distribution."""
    try:
        print(f"🔍 Fetching invalidations for distribution: {distribution_id}")
        
        # List invalidations (most recent first)
        paginator = cloudfront_client.get_paginator('list_invalidations')
        for page in paginator.paginate(DistributionId=distribution_id):
            invalidations = page.get('InvalidationList', {}).get('Items', [])
            
            if not invalidations:
                print("ℹ️  No invalidations found for this distribution")
                return None
            
            # Get the most recent one (first in the list, which is sorted by CreateTime descending)
            most_recent = invalidations[0]
            invalidation_id = most_recent.get('Id')
            
            # Get full details of the invalidation
            invalidation = get_invalidation_by_id(cloudfront_client, distribution_id, invalidation_id)
            if invalidation:
                return invalidation
            else:
                # Return basic info from list if we can't get full details
                return most_recent
        
        return None
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'NoSuchDistribution':
            print(f"❌ Error: Distribution '{distribution_id}' does not exist")
        elif error_code == 'AccessDenied':
            print(f"❌ Error: Access denied to distribution '{distribution_id}'")
            print("   Please check your AWS credentials and IAM permissions")
        else:
            print(f"❌ Error fetching invalidations: {e}")
        return None
    except Exception as e:
        print(f"❌ Unexpected error fetching invalidations: {e}")
        return None

def calculate_elapsed_time(create_time):
    """Calculate elapsed time since invalidation was created."""
    if not create_time:
        return None
    
    # Convert to datetime if it's a string or keep as datetime
    if isinstance(create_time, str):
        try:
            create_time = datetime.fromisoformat(create_time.replace('Z', '+00:00'))
        except:
            return None
    
    now = datetime.now(create_time.tzinfo) if create_time.tzinfo else datetime.utcnow()
    elapsed = now - create_time
    
    # Format elapsed time
    total_seconds = int(elapsed.total_seconds())
    if total_seconds < 60:
        return f"{total_seconds}s"
    elif total_seconds < 3600:
        minutes = total_seconds // 60
        seconds = total_seconds % 60
        return f"{minutes}m {seconds}s"
    else:
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        return f"{hours}h {minutes}m"

def display_invalidation_status(invalidation, show_elapsed=False, compact=False):
    """Display invalidation status information."""
    if not invalidation:
        return
    
    invalidation_id = invalidation.get('Id', 'N/A')
    status = invalidation.get('Status', 'N/A')
    create_time = invalidation.get('CreateTime')
    paths = invalidation.get('InvalidationBatch', {}).get('Paths', {}).get('Items', [])
    path_count = invalidation.get('InvalidationBatch', {}).get('Paths', {}).get('Quantity', 0)
    
    if compact:
        # Compact format for polling updates
        elapsed = calculate_elapsed_time(create_time)
        elapsed_str = f" (elapsed: {elapsed})" if elapsed else ""
        print(f"⏳ Status: {format_status(status)}{elapsed_str}")
        return
    
    print("\n" + "=" * 70)
    print("MOST RECENT INVALIDATION STATUS")
    print("=" * 70)
    print(f"Invalidation ID: {invalidation_id}")
    print(f"Status: {format_status(status)}")
    print(f"Created: {format_datetime(create_time)}")
    
    if show_elapsed:
        elapsed = calculate_elapsed_time(create_time)
        if elapsed:
            print(f"Elapsed: {elapsed}")
    
    if path_count > 0:
        print(f"\nPaths invalidated ({path_count}):")
        for i, path in enumerate(paths[:10], 1):  # Show first 10 paths
            print(f"  {i}. {path}")
        if len(paths) > 10:
            print(f"  ... and {len(paths) - 10} more path(s)")
    
    # Show additional info based on status
    if status == 'InProgress':
        print("\n⏳ Invalidation is currently in progress.")
        print("   CloudFront invalidations typically take 5-15 minutes to complete.")
    elif status == 'Completed':
        print("\n✅ Invalidation has completed successfully.")
    else:
        print(f"\n❓ Status: {status}")
    
    print("=" * 70)

def poll_invalidation_status(cloudfront_client, distribution_id, invalidation_id, interval=30):
    """Poll invalidation status until it completes."""
    print(f"\n🔄 Starting to watch invalidation (checking every {interval} seconds)...")
    print("   Press Ctrl+C to stop watching (invalidation will continue in background)")
    print()
    
    check_count = 0
    start_time = time.time()
    status = 'Unknown'
    
    try:
        while True:
            check_count += 1
            current_time = time.time()
            elapsed = int(current_time - start_time)
            
            # Fetch current status
            invalidation = get_invalidation_by_id(cloudfront_client, distribution_id, invalidation_id)
            
            if not invalidation:
                print(f"\n❌ Error: Could not fetch invalidation status")
                return False
            
            status = invalidation.get('Status', 'Unknown')
            
            # Show compact status update
            print(f"[Check #{check_count} - {elapsed}s] ", end='')
            display_invalidation_status(invalidation, show_elapsed=True, compact=True)
            
            if status == 'Completed':
                # Show full status on completion
                print("\n" + "🎉" * 35)
                print("✅ INVALIDATION COMPLETED SUCCESSFULLY!")
                print("🎉" * 35)
                display_invalidation_status(invalidation, show_elapsed=True, compact=False)
                return True
            elif status != 'InProgress':
                # Unknown status - show full info and exit
                print(f"\n⚠️  Invalidation status changed to: {status}")
                display_invalidation_status(invalidation, show_elapsed=True, compact=False)
                return True
            
            # Wait before next check
            print(f"   ⏱️  Next check in {interval} seconds...\n")
            time.sleep(interval)
            
    except KeyboardInterrupt:
        elapsed = int(time.time() - start_time)
        print("\n\n⏸️  Stopped watching (invalidation continues in background)")
        print(f"   Checked {check_count} time(s) over {elapsed} seconds")
        print(f"   Invalidation ID: {invalidation_id}")
        print(f"   Final status: {status}")
        print(f"   You can check status again later using:")
        print(f"   python scripts/aws/cloudfront/check_invalidation.py {distribution_id}")
        return True
    except Exception as e:
        print(f"\n❌ Error while polling: {e}")
        return False

def main():
    """Main function to check invalidation status."""
    parser = argparse.ArgumentParser(
        description='Check status of the most recent CloudFront invalidation',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Check most recent invalidation (auto-detect distribution, auto-watch if in progress)
  python scripts/aws/cloudfront/check_invalidation.py
  
  # Watch with custom polling interval (check every 60 seconds)
  python scripts/aws/cloudfront/check_invalidation.py --interval 60
  
  # Just check once, don't watch
  python scripts/aws/cloudfront/check_invalidation.py --no-watch
  
  # Check with specific distribution ID
  python scripts/aws/cloudfront/check_invalidation.py EF3FG0T13DT34
  
  # Check with domain name
  python scripts/aws/cloudfront/check_invalidation.py --domain d2dtpxz4sf6hir.cloudfront.net
        """
    )
    parser.add_argument(
        'distribution_id',
        nargs='?',
        default=None,
        help='CloudFront distribution ID (e.g., EF3FG0T13DT34). Optional - defaults to looking up from domain if not provided.'
    )
    parser.add_argument(
        '--domain',
        default=DEFAULT_CLOUDFRONT_DOMAIN,
        help=f'CloudFront distribution domain name (default: {DEFAULT_CLOUDFRONT_DOMAIN}). Used to look up distribution ID.'
    )
    parser.add_argument(
        '--region',
        default='us-east-1',
        help='AWS region (default: us-east-1)'
    )
    parser.add_argument(
        '--no-watch',
        action='store_true',
        help='Disable automatic watching (just check once and exit). By default, the script watches invalidations until completion.'
    )
    parser.add_argument(
        '--interval', '-i',
        type=int,
        default=DEFAULT_INTERVAL,
        help=f'Polling interval in seconds when watching (default: {DEFAULT_INTERVAL})'
    )
    
    args = parser.parse_args()
    
    # Determine distribution ID
    distribution_id = args.distribution_id
    
    print("=" * 70)
    print("CLOUDFRONT INVALIDATION STATUS CHECK")
    print("=" * 70)
    print(f"Region: {args.region}")
    print()
    
    # Get CloudFront client
    cloudfront_client = get_cloudfront_client(args.region)
    if not cloudfront_client:
        return False
    
    # If no distribution_id is provided, use domain (which now has a default)
    if not distribution_id:
        distribution_id = get_distribution_id_from_domain(cloudfront_client, args.domain)
        if not distribution_id:
            return False
        print()
    
    # Get the most recent invalidation
    invalidation = get_most_recent_invalidation(cloudfront_client, distribution_id)
    
    if invalidation:
        status = invalidation.get('Status', 'Unknown')
        invalidation_id = invalidation.get('Id')
        
        # Show initial status
        display_invalidation_status(invalidation)
        
        # Automatically watch if status is InProgress (unless --no-watch is specified)
        should_watch = not args.no_watch  # Default to watching unless --no-watch
        
        if should_watch and status == 'InProgress':
            return poll_invalidation_status(cloudfront_client, distribution_id, invalidation_id, args.interval)
        
        return True
    else:
        print("\n" + "=" * 70)
        print("❌ NO INVALIDATION FOUND")
        print("=" * 70)
        return False

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n❌ Check cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

