#!/usr/bin/env python3
"""
DynamoDB Table Backup Script: Backup DynamoDB table to local JSON files
=======================================================================

This script scans a DynamoDB table and creates a local backup as JSON files
with support for sync mode to only backup changed items.

USAGE:
    python scripts/aws/dynamo/backup_dynamodb_table.py [table_name] [output_dir]
    
    Examples:
    # Full backup (or sync if directory exists)
    python scripts/aws/dynamo/backup_dynamodb_table.py GameCatalog
    python scripts/aws/dynamo/backup_dynamodb_table.py GameCatalog backup/dynamodb/GameCatalog
    
    # Sync mode (only backup changed/new items)
    python scripts/aws/dynamo/backup_dynamodb_table.py GameCatalog --sync
    
    # Force full re-backup (ignore sync metadata)
    python scripts/aws/dynamo/backup_dynamodb_table.py GameCatalog --force
"""

import sys
import os
import boto3
from datetime import datetime
from botocore.exceptions import ClientError, NoCredentialsError
from pathlib import Path
import argparse
import json
import hashlib
from decimal import Decimal

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

def format_size(size_bytes):
    """Format bytes to human-readable size."""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} PB"

def convert_decimal(obj):
    """
    Convert DynamoDB Decimal types to native Python types for JSON serialization.
    Recursively processes dictionaries, lists, and nested structures.
    """
    if isinstance(obj, Decimal):
        # Convert Decimal to int if it's a whole number, otherwise float
        if obj % 1 == 0:
            return int(obj)
        else:
            return float(obj)
    elif isinstance(obj, dict):
        return {key: convert_decimal(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimal(item) for item in obj]
    else:
        return obj

def calculate_item_hash(item):
    """Calculate MD5 hash of item JSON for change detection."""
    try:
        # Convert item to JSON string (sorted keys for consistency)
        item_json = json.dumps(item, sort_keys=True, default=str)
        # Calculate MD5 hash
        hash_md5 = hashlib.md5()
        hash_md5.update(item_json.encode('utf-8'))
        return hash_md5.hexdigest()
    except Exception as e:
        return None

def get_item_key(item, table):
    """
    Get the primary key of an item for identification.
    Uses the table's key schema to determine the key.
    """
    try:
        # Try to get table description to find key attributes
        key_attrs = []
        for key_schema in table.key_schema:
            key_attrs.append(key_schema['AttributeName'])
        
        # Build key identifier from key attributes
        if len(key_attrs) == 1:
            return str(item.get(key_attrs[0], 'unknown'))
        else:
            # Composite key - join with separator
            key_parts = [str(item.get(attr, '')) for attr in key_attrs]
            return '|'.join(key_parts)
    except Exception:
        # Fallback: try common key names
        for key_name in ['gameId', 'id', 'uuid', 'pk', 'sk']:
            if key_name in item:
                return str(item[key_name])
        return 'unknown'

def load_sync_metadata(output_dir):
    """Load metadata from .dynamodb-sync-metadata.json if it exists."""
    metadata_file = os.path.join(output_dir, '.dynamodb-sync-metadata.json')
    if not os.path.exists(metadata_file):
        return {}
    
    try:
        with open(metadata_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # Return the items dictionary, or empty dict if structure is unexpected
            return data.get('items', {})
    except (json.JSONDecodeError, IOError, KeyError) as e:
        print(f"⚠️  Warning: Could not load metadata file: {e}")
        print("   Starting with empty metadata (treating all items as new)")
        return {}

def save_sync_metadata(output_dir, metadata):
    """Save metadata dictionary to .dynamodb-sync-metadata.json."""
    metadata_file = os.path.join(output_dir, '.dynamodb-sync-metadata.json')
    try:
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)
        
        data = {
            'items': metadata,
            'last_sync': datetime.now().isoformat()
        }
        
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        return True
    except Exception as e:
        print(f"⚠️  Warning: Could not save metadata file: {e}")
        return False

def get_dynamodb_resource(region='us-east-1'):
    """Get DynamoDB resource."""
    try:
        return boto3.resource('dynamodb', region_name=region)
    except NoCredentialsError:
        print("❌ Error: AWS credentials not found.")
        print("   Please configure AWS credentials using:")
        print("   - AWS CLI: aws configure")
        print("   - Environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY")
        print("   - IAM role (if running on EC2)")
        return None
    except Exception as e:
        print(f"❌ Error connecting to DynamoDB: {e}")
        return None

def get_dynamodb_client(region='us-east-1'):
    """Get DynamoDB client."""
    try:
        return boto3.client('dynamodb', region_name=region)
    except NoCredentialsError:
        print("❌ Error: AWS credentials not found.")
        print("   Please configure AWS credentials using:")
        print("   - AWS CLI: aws configure")
        print("   - Environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY")
        print("   - IAM role (if running on EC2)")
        return None
    except Exception as e:
        print(f"❌ Error connecting to DynamoDB: {e}")
        return None

def list_all_tables(region='us-east-1'):
    """List all DynamoDB tables in the region."""
    try:
        client = get_dynamodb_client(region)
        if not client:
            return None
        
        print(f"📋 Discovering all DynamoDB tables in region: {region}...")
        table_names = []
        
        # Use paginator to handle accounts with many tables
        paginator = client.get_paginator('list_tables')
        for page in paginator.paginate():
            table_names.extend(page.get('TableNames', []))
        
        print(f"✅ Found {len(table_names)} table(s)")
        return sorted(table_names)
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'AccessDeniedException':
            print(f"❌ Error: Access denied to list DynamoDB tables")
            print("   Please check your AWS credentials and permissions")
        else:
            print(f"❌ Error listing tables: {e}")
        return None
    except Exception as e:
        print(f"❌ Unexpected error listing tables: {e}")
        return None

def scan_table(table_name, region='us-east-1'):
    """Scan entire DynamoDB table with pagination."""
    try:
        print(f"📋 Scanning table: {table_name}...")
        dynamodb = get_dynamodb_resource(region)
        if not dynamodb:
            return None
        
        table = dynamodb.Table(table_name)
        items = []
        
        # Use paginator to handle large tables
        response = table.scan()
        items.extend(response.get('Items', []))
        
        # Handle pagination
        while 'LastEvaluatedKey' in response:
            response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
            items.extend(response.get('Items', []))
            print(f"   Scanned {len(items)} items so far...")
        
        print(f"✅ Found {len(items)} items")
        return items
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'ResourceNotFoundException':
            print(f"❌ Error: Table '{table_name}' does not exist")
        elif error_code == 'AccessDeniedException':
            print(f"❌ Error: Access denied to table '{table_name}'")
            print("   Please check your AWS credentials and table permissions")
        else:
            print(f"❌ Error scanning table: {e}")
        return None
    except Exception as e:
        print(f"❌ Unexpected error scanning table: {e}")
        return None

def should_backup_item(item_hash, item_key, metadata, force=False):
    """
    Check if item should be backed up.
    Returns (should_backup, reason) tuple.
    """
    if force:
        return (True, "forced")
    
    if item_key not in metadata:
        return (True, "new")
    
    stored_hash = metadata[item_key].get('hash', '')
    if stored_hash == item_hash:
        return (False, "unchanged")
    
    return (True, "changed")

def backup_table(table_name, output_dir, region='us-east-1', metadata=None, force=False, sync_mode=False):
    """
    Backup all items from the table with optional sync support.
    Returns (backed_up, skipped, failed, updated_metadata, all_items).
    """
    if sync_mode:
        print(f"\n🔄 Syncing items to: {output_dir}")
    else:
        print(f"\n📥 Backing up items to: {output_dir}")
    print("=" * 70)
    
    if metadata is None:
        metadata = {}
    
    # Get DynamoDB resource and table
    dynamodb = get_dynamodb_resource(region)
    if not dynamodb:
        return 0, 0, 1, metadata, []
    
    try:
        table = dynamodb.Table(table_name)
    except Exception as e:
        print(f"❌ Error accessing table: {e}")
        return 0, 0, 1, metadata, []
    
    # Scan table
    items = scan_table(table_name, region)
    if items is None:
        return 0, 0, 1, metadata, []
    
    if len(items) == 0:
        print("⚠️  Table is empty. Nothing to backup.")
        return 0, 0, 0, metadata, []
    
    backed_up = 0
    skipped = 0
    failed = 0
    updated_metadata = metadata.copy()
    all_items = []
    
    for idx, item in enumerate(items, 1):
        # Convert Decimal types
        converted_item = convert_decimal(item)
        all_items.append(converted_item)
        
        # Get item key for identification
        item_key = get_item_key(item, table)
        
        # Calculate hash for change detection
        item_hash = calculate_item_hash(converted_item)
        if not item_hash:
            print(f"   ⚠️  Warning: Could not calculate hash for item {item_key}")
            item_hash = ''
        
        # Check if backup is needed
        should_backup, reason = should_backup_item(item_hash, item_key, metadata, force=force)
        
        # Show progress
        progress = f"[{idx}/{len(items)}]"
        if should_backup:
            if sync_mode:
                status = f"Backing up ({reason})"
            else:
                status = "Backing up"
            print(f"{progress} {status}: {item_key}")
            backed_up += 1
        else:
            if sync_mode:
                skipped += 1
                print(f"{progress} Skipped (unchanged): {item_key}")
            else:
                # In non-sync mode, still backup
                backed_up += 1
        
        # Update metadata
        updated_metadata[item_key] = {
            'hash': item_hash,
            'backed_up': datetime.now().isoformat()
        }
    
    # Save backup file
    timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    backup_filename = f"{table_name}-backup-{timestamp}.json"
    backup_path = os.path.join(output_dir, backup_filename)
    latest_filename = f"{table_name}-latest.json"
    latest_path = os.path.join(output_dir, latest_filename)
    
    try:
        os.makedirs(output_dir, exist_ok=True)
        
        # Save timestamped backup
        with open(backup_path, 'w', encoding='utf-8') as f:
            json.dump(all_items, f, indent=2, default=str)
        
        # Save/update latest backup
        with open(latest_path, 'w', encoding='utf-8') as f:
            json.dump(all_items, f, indent=2, default=str)
        
        print("=" * 70)
        if sync_mode:
            print(f"\n📊 Sync Summary:")
            print(f"   ✅ Backed up: {backed_up} items")
            print(f"   ⏭️  Skipped: {skipped} items (unchanged)")
        else:
            print(f"\n📊 Backup Summary:")
            print(f"   ✅ Successfully backed up: {backed_up} items")
        print(f"   📁 Backup file: {backup_filename}")
        print(f"   📁 Latest file: {latest_filename}")
        print(f"   📁 Output directory: {output_dir}")
        
    except Exception as e:
        print(f"   ❌ Error saving backup file: {e}")
        failed = 1
    
    return backed_up, skipped, failed, updated_metadata, all_items

def backup_all_tables(region='us-east-1', force=False, sync_mode=False, skip_confirmation=False):
    """
    Backup all DynamoDB tables in the region.
    Returns True if all backups succeeded, False otherwise.
    """
    print("=" * 70)
    print("DYNAMODB BACKUP ALL TABLES")
    print("=" * 70)
    print(f"Region: {region}")
    if sync_mode:
        print(f"Mode: Sync (only backup changed/new items)")
    else:
        print(f"Mode: Full backup")
    if force:
        print(f"Force: Enabled (ignoring sync metadata)")
    print()
    
    # Step 1: Get DynamoDB resource
    print("Step 1: Connecting to DynamoDB...")
    dynamodb = get_dynamodb_resource(region)
    if not dynamodb:
        return False
    
    # Step 2: List all tables
    print("\nStep 2: Discovering all tables...")
    table_names = list_all_tables(region)
    if table_names is None:
        return False
    
    if len(table_names) == 0:
        print("⚠️  No tables found in this region.")
        return True
    
    print(f"\n📊 Found {len(table_names)} table(s) to backup")
    
    # Step 3: Confirm before backing up
    if not skip_confirmation:
        try:
            response = input(f"\nContinue backing up all {len(table_names)} table(s)? (yes/no): ").strip().lower()
            if response not in ['yes', 'y']:
                print("❌ Backup cancelled by user")
                return False
        except (KeyboardInterrupt, EOFError):
            print("\n❌ Backup cancelled by user")
            return False
    else:
        print(f"\n⏩ Skipping confirmation (--yes flag set)")
    
    # Step 4: Backup each table
    print("\nStep 3: Backing up tables...")
    print("=" * 70)
    
    successful = 0
    failed = 0
    skipped_empty = 0
    total_items = 0
    
    for idx, table_name in enumerate(table_names, 1):
        print(f"\n[{idx}/{len(table_names)}] Processing table: {table_name}")
        print("-" * 70)
        
        output_dir = os.path.join('backup', 'dynamodb', table_name)
        
        # Load metadata if in sync mode
        metadata = {}
        if sync_mode and not force:
            metadata = load_sync_metadata(output_dir)
        
        # Scan table to check if empty
        items = scan_table(table_name, region)
        if items is None:
            print(f"❌ Failed to scan table: {table_name}")
            failed += 1
            continue
        
        if len(items) == 0:
            print(f"⏭️  Skipping empty table: {table_name}")
            skipped_empty += 1
            continue
        
        # Backup the table
        try:
            backed_up, skipped, table_failed, updated_metadata, all_items = backup_table(
                table_name, output_dir, region,
                metadata=metadata, force=force, sync_mode=sync_mode
            )
            
            if table_failed == 0:
                successful += 1
                total_items += backed_up
                print(f"✅ Successfully backed up {table_name}: {backed_up} items")
            else:
                failed += 1
                print(f"❌ Failed to backup {table_name}")
            
            # Save metadata if in sync mode
            if sync_mode and not force:
                save_sync_metadata(output_dir, updated_metadata)
                
        except Exception as e:
            print(f"❌ Error backing up {table_name}: {e}")
            failed += 1
            continue
    
    # Final summary
    print("\n" + "=" * 70)
    print("🎉 BACKUP ALL TABLES COMPLETED!")
    print("=" * 70)
    print(f"📊 Summary:")
    print(f"   Total tables: {len(table_names)}")
    print(f"   ✅ Successful: {successful}")
    print(f"   ❌ Failed: {failed}")
    print(f"   ⏭️  Skipped (empty): {skipped_empty}")
    print(f"   📦 Total items backed up: {total_items}")
    print()
    
    return failed == 0

def main():
    """Main backup function."""
    parser = argparse.ArgumentParser(
        description='Backup DynamoDB table(s) to local JSON files',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Backup a single table (or sync if directory exists)
  python scripts/backup/backup_dynamodb_table.py GameCatalog
  python scripts/backup/backup_dynamodb_table.py GameCatalog backup/dynamodb/GameCatalog
  
  # Backup all tables
  python scripts/backup/backup_dynamodb_table.py --all
  python scripts/backup/backup_dynamodb_table.py --all --yes
  
  # Sync mode (only backup changed/new items)
  python scripts/backup/backup_dynamodb_table.py GameCatalog --sync
  
  # Force full re-backup (ignore sync metadata)
  python scripts/backup/backup_dynamodb_table.py GameCatalog --force
  
  # Backup with different region
  python scripts/backup/backup_dynamodb_table.py GameCatalog --region us-west-2
  python scripts/backup/backup_dynamodb_table.py --all --region us-west-2
        """
    )
    parser.add_argument(
        'table_name',
        nargs='?',
        default=None,
        help='Name of the DynamoDB table to backup (required unless --all is used)'
    )
    parser.add_argument(
        'output_dir',
        nargs='?',
        default=None,
        help='Output directory for backup (default: backup/dynamodb/{table_name}). Only used with single table backup.'
    )
    parser.add_argument(
        '--all',
        action='store_true',
        help='Backup all DynamoDB tables in the region'
    )
    parser.add_argument(
        '--region',
        default='us-east-1',
        help='AWS region (default: us-east-1)'
    )
    parser.add_argument(
        '--yes', '-y',
        action='store_true',
        help='Skip confirmation prompt and proceed with backup'
    )
    parser.add_argument(
        '--sync',
        action='store_true',
        default=None,  # None means auto-detect based on directory existence
        help='Enable sync mode (only backup changed/new items). Default: auto-detect if output directory exists'
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='Force full re-backup, ignoring sync metadata (disables sync mode)'
    )
    
    args = parser.parse_args()
    
    # Validate arguments
    if not args.all and not args.table_name:
        parser.error("Either --all flag or table_name must be provided")
    
    if args.all and args.table_name:
        parser.error("Cannot specify both --all and table_name. Use --all to backup all tables, or specify a single table_name.")
    
    if args.all and args.output_dir:
        parser.error("Cannot specify output_dir with --all flag. Each table will be backed up to its own directory.")
    
    table_name = args.table_name
    region = args.region
    
    # Determine sync mode
    # --force disables sync
    # --sync enables sync
    # If neither specified, auto-detect: sync if directory exists, full backup if not
    force_mode = args.force
    if force_mode:
        sync_mode = False
    elif args.sync is not None:
        sync_mode = args.sync
    else:
        # For --all mode, default to full backup (no auto-detect)
        # For single table, auto-detect based on directory existence
        if args.all:
            sync_mode = False
        else:
            output_dir = args.output_dir if args.output_dir else os.path.join('backup', 'dynamodb', table_name)
            sync_mode = os.path.exists(output_dir) and os.path.isdir(output_dir)
    
    # Handle --all flag
    if args.all:
        return backup_all_tables(region, force=force_mode, sync_mode=sync_mode, skip_confirmation=args.yes)
    
    # Single table backup mode (existing logic)
    # Set default output directory if not provided
    if args.output_dir:
        output_dir = args.output_dir
    else:
        output_dir = os.path.join('backup', 'dynamodb', table_name)
    
    print("=" * 70)
    if sync_mode:
        print("DYNAMODB TABLE SYNC")
    else:
        print("DYNAMODB TABLE BACKUP")
    print("=" * 70)
    print(f"Table: {table_name}")
    print(f"Region: {region}")
    print(f"Output: {output_dir}")
    if sync_mode:
        print(f"Mode: Sync (only backup changed/new items)")
    else:
        print(f"Mode: Full backup")
    if force_mode:
        print(f"Force: Enabled (ignoring sync metadata)")
    print()
    
    # Step 1: Get DynamoDB resource
    print("Step 1: Connecting to DynamoDB...")
    dynamodb = get_dynamodb_resource(region)
    if not dynamodb:
        return False
    
    # Step 2: Load metadata if in sync mode
    metadata = {}
    if sync_mode and not force_mode:
        print("\nStep 2: Loading sync metadata...")
        metadata = load_sync_metadata(output_dir)
        if metadata:
            print(f"   Found metadata for {len(metadata)} items")
        else:
            print("   No existing metadata found (treating all items as new)")
    
    # Step 3: Scan table
    if sync_mode and not force_mode:
        print("\nStep 3: Scanning table...")
    else:
        print("\nStep 2: Scanning table...")
    items = scan_table(table_name, region)
    if items is None:
        return False
    
    if len(items) == 0:
        print("⚠️  Table is empty. Nothing to backup.")
        return True
    
    # Step 4: Confirm before backing up
    print(f"\n📊 Table Statistics:")
    print(f"   Items: {len(items)}")
    if sync_mode:
        print(f"\n⚠️  This will sync items to: {output_dir}")
        print(f"   (Only changed/new items will be backed up)")
    else:
        print(f"\n⚠️  This will backup all items to: {output_dir}")
    
    # Skip confirmation if --yes flag is set
    if not args.yes:
        try:
            response = input("\nContinue? (yes/no): ").strip().lower()
            if response not in ['yes', 'y']:
                print("❌ Backup cancelled by user")
                return False
        except (KeyboardInterrupt, EOFError):
            print("\n❌ Backup cancelled by user")
            return False
    else:
        print("\n⏩ Skipping confirmation (--yes flag set)")
    
    # Step 5: Backup/sync all items
    if sync_mode and not force_mode:
        print("\nStep 4: Syncing items...")
    else:
        print("\nStep 3: Backing up items...")
    backed_up, skipped, failed, updated_metadata, all_items = backup_table(
        table_name, output_dir, region, 
        metadata=metadata, force=force_mode, sync_mode=sync_mode
    )
    
    # Step 6: Save metadata
    if sync_mode and not force_mode:
        print("\nStep 5: Saving sync metadata...")
        save_sync_metadata(output_dir, updated_metadata)
    
    # Final summary
    print("\n" + "=" * 70)
    if sync_mode:
        if failed == 0:
            print("🎉 SYNC COMPLETED SUCCESSFULLY!")
        else:
            print(f"⚠️  SYNC COMPLETED WITH {failed} FAILURES")
    else:
        if failed == 0:
            print("🎉 BACKUP COMPLETED SUCCESSFULLY!")
        else:
            print(f"⚠️  BACKUP COMPLETED WITH {failed} FAILURES")
    print("=" * 70)
    print(f"✅ Backup location: {os.path.abspath(output_dir)}")
    if sync_mode:
        print(f"✅ Items backed up: {backed_up}/{len(items)}")
        print(f"✅ Items skipped: {skipped}/{len(items)}")
    else:
        print(f"✅ Items backed up: {backed_up}/{len(items)}")
    print()
    
    return failed == 0

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n❌ Backup cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

