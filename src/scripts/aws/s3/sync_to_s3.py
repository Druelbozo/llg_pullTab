#!/usr/bin/env python3
"""
S3 Bucket Upload Script: Upload and sync project files to S3 bucket
====================================================================

This script uploads local project files to an S3 bucket, maintaining directory structure.

USAGE:
    python scripts/aws/s3/sync_to_s3.py [path1] [path2] ...
    
    Examples:
    # Sync specific paths
    python scripts/aws/s3/sync_to_s3.py /Themes
    python scripts/aws/s3/sync_to_s3.py /index.html
    python scripts/aws/s3/sync_to_s3.py /Themes /css /index.html
    
    # Sync default paths (assets, css, phaserjs_editor_scripts_base, src, Themes, index.html, favicon.ico)
    python scripts/aws/s3/sync_to_s3.py
    
    # Dry-run to preview changes
    python scripts/aws/s3/sync_to_s3.py /Themes --dry-run
    
    # Force upload all files (ignore hash checks)
    python scripts/aws/s3/sync_to_s3.py /Themes --force
"""

import sys
import os
import boto3
from datetime import datetime
from botocore.exceptions import ClientError
from pathlib import Path
import argparse
import json
import hashlib
import difflib
from contextlib import redirect_stdout, redirect_stderr
from io import StringIO

# Import SSO authentication utility
# Add parent directory (scripts/aws) to path to import aws_sso_auth
_aws_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _aws_dir not in sys.path:
    sys.path.insert(0, _aws_dir)
from aws_sso_auth import ensure_sso_authenticated, get_boto3_session

# Import shared S3 configuration
from s3_config import BUCKET, S3_PREFIX

# Default paths to sync when no arguments provided
DEFAULT_PATHS = [
    'assets',
    'css',
    'phaserjs_editor_scripts_base',
    'src',
    'Themes',
    'index.html',
    'favicon.ico'
]

# File extensions to skip (never sync or delete from S3)
SKIP_EXTENSIONS = {
    '.psd'  # Photoshop files - never sync to S3
}

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

def get_content_type(file_path):
    """
    Determine Content-Type (MIME type) based on file extension.
    Supports all file types found in DEFAULT_PATHS and common web file types.
    """
    # Get file extension (lowercase)
    ext = os.path.splitext(file_path)[1].lower()
    
    # MIME type mapping
    mime_types = {
        # JavaScript
        '.js': 'application/javascript',
        # JSON
        '.json': 'application/json',
        '.scene': 'application/json',  # Phaser Editor scene files are JSON
        # HTML
        '.html': 'text/html',
        # CSS
        '.css': 'text/css',
        # Images
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
        '.ico': 'image/x-icon',
        # Fonts
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.otf': 'font/otf',
        # Audio
        '.ogg': 'audio/ogg',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
    }
    
    return mime_types.get(ext, 'application/octet-stream')

def get_s3_client(region='us-east-1'):
    """Get S3 client using AWS SSO authentication."""
    # Ensure SSO authentication is active
    if not ensure_sso_authenticated():
        print("❌ Error: Failed to authenticate with AWS SSO")
        print("   Please ensure you have completed the SSO setup.")
        return None
    
    try:
        # Get boto3 session with SSO profile
        session = get_boto3_session()
        # Create S3 client from session
        return session.client('s3', region_name=region)
    except Exception as e:
        print(f"❌ Error connecting to S3: {e}")
        return None

def calculate_local_etag(file_path):
    """Calculate MD5 hash of local file (S3 ETags are typically MD5)."""
    if not os.path.exists(file_path):
        return None
    
    try:
        hash_md5 = hashlib.md5()
        with open(file_path, 'rb') as f:
            # Read file in chunks to handle large files efficiently
            for chunk in iter(lambda: f.read(4096), b''):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    except (IOError, OSError) as e:
        return None

def find_project_root():
    """
    Find the project root directory (directory containing index.html).
    Starts from script location and walks up the directory tree.
    folder$0
    Returns the project root path, or None if not found.
    """
    # Start from the script's directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Walk up the directory tree looking for index.html
    while True:
        index_path = os.path.join(current_dir, 'index.html')
        if os.path.exists(index_path):
            return current_dir
        
        # Move up one level
        parent_dir = os.path.dirname(current_dir)
        if parent_dir == current_dir:
            # Reached filesystem root
            break
        current_dir = parent_dir
    
    return None

def parse_project_path(project_root, project_path, bucket_override=None, prefix_override=None):
    """
    Parse a project-relative path and map it to S3 bucket and prefix.
    
    Paths are synced to: {BUCKET}/{S3_PREFIX}{path}/
    - Files at root (e.g., 'index.html') → {S3_PREFIX}/index.html
    - Directories (e.g., '/src') → {S3_PREFIX}/src/{files}
    
    Args:
        project_root: Absolute path to project root directory
        project_path: Path relative to project root (e.g., '/Themes', 'Themes', '/index.html')
        bucket_override: Optional bucket name override
        prefix_override: Optional S3 prefix override
    
    Returns (bucket_name, s3_prefix, local_path) tuple.
    - bucket_name: S3 bucket name (default: from s3_config.BUCKET)
    - s3_prefix: S3 prefix (e.g., '{S3_PREFIX}Themes/' for dirs, '{S3_PREFIX}' for files)
    - local_path: Absolute local file/directory path
    """
    # Normalize project_path: remove leading slash if present
    project_path = project_path.lstrip('/').lstrip('\\')
    
    # Build absolute local path
    local_path = os.path.join(project_root, project_path)
    local_path = os.path.normpath(local_path)
    
    # Use overrides if provided
    bucket_name = bucket_override if bucket_override else BUCKET
    
    if prefix_override:
        s3_prefix = prefix_override
        if not s3_prefix.endswith('/') and s3_prefix:
            s3_prefix += '/'
    else:
        # Build S3 prefix: {S3_PREFIX}{project_path}/
        # Preserve folder structure
        # Check if path exists and is a directory
        if os.path.exists(local_path) and os.path.isdir(local_path):
            # For directories, append the directory name to the prefix
            s3_prefix = S3_PREFIX + project_path.replace('\\', '/')
            if not s3_prefix.endswith('/'):
                s3_prefix += '/'
        elif os.path.exists(local_path) and os.path.isfile(local_path):
            # For files, the prefix is just the base prefix
            # The filename will be added during sync
            s3_prefix = S3_PREFIX
        else:
            # Path doesn't exist locally - determine if it's likely a directory or file
            # If it has a file extension and no slashes in the basename, treat as file
            # Otherwise, treat as directory
            project_path_clean = project_path.replace('\\', '/')
            basename = os.path.basename(project_path_clean)
            has_extension = '.' in basename and basename.split('.')[-1] not in ['', '/']
            is_likely_file = has_extension and '/' not in basename
            
            if is_likely_file:
                # Treat as file - prefix is just the base prefix
                s3_prefix = S3_PREFIX
            else:
                # Treat as directory - append the path to the prefix
                s3_prefix = S3_PREFIX + project_path_clean
                if not s3_prefix.endswith('/'):
                    s3_prefix += '/'
    
    return bucket_name, s3_prefix, local_path

def scan_local_files(local_path):
    """
    Recursively scan local file or directory and calculate MD5 hashes for all files.
    Returns dict: {relative_path: {'hash': md5_hash, 'size': size, 'path': full_path}}
    
    For directories, relative_path is relative to the directory.
    For single files, relative_path is just the filename.
    """
    local_files = {}
    local_path = os.path.normpath(local_path)
    
    if not os.path.exists(local_path):
        return local_files
    
    # Files to skip by name
    skip_files = {
        '.s3-sync-metadata.json',
        'generate-index.js',
        'README.md'
    }
    
    # File extensions to skip (use module-level constant)
    skip_extensions = SKIP_EXTENSIONS
    
    if os.path.isfile(local_path):
        # Single file: relative path is just the filename
        filename = os.path.basename(local_path)
        # Skip if filename is in skip list or has a skip extension
        file_ext = os.path.splitext(filename)[1].lower()
        if filename not in skip_files and file_ext not in skip_extensions:
            file_hash = calculate_local_etag(local_path)
            if file_hash:
                file_size = os.path.getsize(local_path)
                local_files[filename] = {
                    'hash': file_hash,
                    'size': file_size,
                    'path': local_path
                }
    else:
        # Directory: scan recursively
        for root, dirs, files in os.walk(local_path):
            # Skip 'archive' directories project-wide
            dirs[:] = [d for d in dirs if d != 'archive']
            
            for file in files:
                # Skip files by name
                if file in skip_files:
                    continue
                
                # Skip files by extension
                file_ext = os.path.splitext(file)[1].lower()
                if file_ext in skip_extensions:
                    continue
                
                file_path = os.path.join(root, file)
                
                # Get relative path from local_path
                try:
                    rel_path = os.path.relpath(file_path, local_path)
                except ValueError:
                    # If paths are on different drives (Windows), use absolute path
                    rel_path = file_path
                
                # Normalize to forward slashes
                rel_path = rel_path.replace('\\', '/')
                
                # Calculate hash and size
                file_hash = calculate_local_etag(file_path)
                if file_hash:
                    file_size = os.path.getsize(file_path)
                    local_files[rel_path] = {
                        'hash': file_hash,
                        'size': file_size,
                        'path': file_path
                    }
    
    return local_files

def list_all_objects(s3_client, bucket_name, prefix=None):
    """List all objects in the S3 bucket, optionally filtered by prefix."""
    try:
        if prefix:
            print(f"📋 Listing objects in bucket: {bucket_name} (prefix: {prefix})...")
        else:
            print(f"📋 Listing objects in bucket: {bucket_name}...")
        objects = []
        paginator = s3_client.get_paginator('list_objects_v2')
        
        # Use prefix parameter if provided
        pagination_params = {'Bucket': bucket_name}
        if prefix:
            pagination_params['Prefix'] = prefix
        
        page_iterator = paginator.paginate(**pagination_params)
        
        for page in page_iterator:
            if 'Contents' in page:
                objects.extend(page['Contents'])
        
        print(f"✅ Found {len(objects)} objects")
        return objects
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'NoSuchBucket':
            print(f"❌ Error: Bucket '{bucket_name}' does not exist")
        elif error_code == 'AccessDenied':
            print(f"❌ Error: Access denied to bucket '{bucket_name}'")
            print("   Please check your AWS credentials and bucket permissions")
        else:
            print(f"❌ Error listing objects: {e}")
        return None
    except Exception as e:
        print(f"❌ Unexpected error listing objects: {e}")
        return None

def calculate_filename_similarity(name1, name2):
    """
    Calculate similarity score between two filenames (0.0 to 1.0).
    Uses difflib.SequenceMatcher for similarity calculation.
    """
    return difflib.SequenceMatcher(None, name1, name2).ratio()

def detect_renames(local_files, s3_objects, s3_prefix, similarity_threshold=0.7, already_matched_files=None):
    """
    Detect renamed files by matching content hash and filename similarity.
    
    Args:
        already_matched_files: Set of local file paths that are already in sync with S3.
                              These files should not be considered for rename detection.
    
    Returns dict: {old_s3_key: {'new_local_path': path, 'similarity': score}}
    """
    if already_matched_files is None:
        already_matched_files = set()
    renames = {}
    
    # Build hash map for local files: {hash: [list of (path, filename)]}
    # Exclude files that are already matched/in-sync
    local_hash_map = {}
    for rel_path, file_info in local_files.items():
        # Skip files that are already matched/in-sync - they shouldn't be considered for renames
        if rel_path in already_matched_files:
            continue
        file_hash = file_info['hash']
        filename = os.path.basename(rel_path)
        if file_hash not in local_hash_map:
            local_hash_map[file_hash] = []
        local_hash_map[file_hash].append((rel_path, filename))
    
    # Build hash map for S3 objects: {hash: [list of (key, filename)]}
    s3_hash_map = {}
    local_paths_set = set(local_files.keys())
    
    # Build a map of ALL local files by hash (including matched ones) to check if S3 files
    # match already-matched local files (should skip those to avoid false renames)
    all_local_hash_to_paths = {}
    for rel_path, file_info in local_files.items():
        file_hash = file_info['hash']
        if file_hash not in all_local_hash_to_paths:
            all_local_hash_to_paths[file_hash] = []
        all_local_hash_to_paths[file_hash].append(rel_path)
    
    for obj in s3_objects:
        key = obj['Key']
        # Skip folder markers
        if key.endswith('/') and obj.get('Size', 0) == 0:
            continue
        
        # Get relative path (strip prefix)
        if s3_prefix and key.startswith(s3_prefix):
            rel_path = key[len(s3_prefix):]
        else:
            rel_path = key
        
        # Skip if this file exists locally with same name (not a rename)
        if rel_path in local_paths_set:
            continue
        
        s3_etag = obj.get('ETag', '').strip('"')
        if s3_etag:
            # Skip S3 files that have the same hash as already-matched local files
            # This prevents false rename detection when multiple files have the same content
            # (e.g., if test1.js is already matched, don't consider test2.js with same hash as a rename)
            if s3_etag in all_local_hash_to_paths:
                matching_local_paths = all_local_hash_to_paths[s3_etag]
                # Check if any of the matching local files are already matched/in-sync
                if any(path in already_matched_files for path in matching_local_paths):
                    # This S3 file has the same hash as an already-matched local file
                    # Skip it to avoid false rename detection (it will be deleted as orphaned if needed)
                    continue
            
            if s3_etag not in s3_hash_map:
                s3_hash_map[s3_etag] = []
            filename = os.path.basename(rel_path)
            s3_hash_map[s3_etag].append((key, rel_path, filename))
    
    # Find renames: S3 file with hash matching local file, but different name
    # Track which local files have been claimed as rename targets
    claimed_local_files = set()
    
    # First pass: collect all potential renames with their similarity scores
    potential_renames = []
    for s3_hash, s3_entries in s3_hash_map.items():
        if s3_hash in local_hash_map:
            # Found matching hash - check for similar filenames
            for s3_key, s3_rel_path, s3_filename in s3_entries:
                for local_rel_path, local_filename in local_hash_map[s3_hash]:
                    # Calculate similarity
                    similarity = calculate_filename_similarity(s3_filename, local_filename)
                    if similarity >= similarity_threshold:
                        potential_renames.append({
                            's3_key': s3_key,
                            's3_filename': s3_filename,
                            'local_path': local_rel_path,
                            'local_filename': local_filename,
                            'similarity': similarity
                        })
    
    # Sort by similarity (highest first) to prioritize best matches
    potential_renames.sort(key=lambda x: x['similarity'], reverse=True)
    
    # Second pass: assign renames, ensuring each local file is only claimed once
    for rename_candidate in potential_renames:
        s3_key = rename_candidate['s3_key']
        local_path = rename_candidate['local_path']
        
        # Skip if this S3 key is already assigned or local file is already claimed
        if s3_key not in renames and local_path not in claimed_local_files:
            renames[s3_key] = {
                'new_local_path': local_path,
                'similarity': rename_candidate['similarity'],
                'old_filename': rename_candidate['s3_filename'],
                'new_filename': rename_candidate['local_filename']
            }
            claimed_local_files.add(local_path)
    
    return renames

def upload_file(s3_client, bucket_name, local_path, s3_key, dry_run=False, verbose=False):
    """Upload a single file to S3 with correct Content-Type metadata."""
    if dry_run:
        return True
    
    try:
        # Determine Content-Type based on file extension
        content_type = get_content_type(local_path)
        
        # Debug output: show Content-Type being set
        if verbose:
            filename = os.path.basename(local_path)
            print(f"      [DEBUG] Setting Content-Type: {content_type} for {filename}")
        
        # Upload with Content-Type metadata
        s3_client.upload_file(
            local_path,
            bucket_name,
            s3_key,
            ExtraArgs={'ContentType': content_type}
        )
        return True
    except Exception as e:
        print(f"   ⚠️  Warning: Failed to upload {s3_key}: {e}")
        return False

def delete_s3_object(s3_client, bucket_name, s3_key, dry_run=False):
    """Delete a single object from S3."""
    if dry_run:
        return True
    
    try:
        s3_client.delete_object(Bucket=bucket_name, Key=s3_key)
        return True
    except Exception as e:
        print(f"   ⚠️  Warning: Failed to delete {s3_key}: {e}")
        return False

def sync_to_s3(s3_client, bucket_name, local_dir, local_files, s3_objects, s3_prefix, 
               force=False, dry_run=False, sync_scope_prefix=None, verbose=False):
    """
    Main sync logic: upload new files, update changed files, delete orphaned files.
    
    Args:
        sync_scope_prefix: If provided, only consider files within this prefix as orphaned.
                          This prevents deleting files outside the sync scope.
    
    Returns (uploaded, updated, deleted, renamed, folders_deleted, folders_added, failed) tuple.
    """
    print(f"\n🔄 Syncing local files to S3 bucket: {bucket_name}")
    if s3_prefix:
        print(f"   S3 prefix: {s3_prefix}")
    if dry_run:
        print("   [DRY RUN MODE - No changes will be made]")
    print("=" * 70)
    
    # Build maps for comparison
    # S3 objects keyed by relative path (without prefix)
    s3_files = {}
    s3_folder_markers = []  # Track folder markers separately
    for obj in s3_objects:
        key = obj['Key']
        # Track folder markers separately
        if key.endswith('/') and obj.get('Size', 0) == 0:
            # This is a folder marker - track it
            if sync_scope_prefix is None or key.startswith(sync_scope_prefix):
                s3_folder_markers.append(key)
            continue
        
        # Get relative path
        if s3_prefix and key.startswith(s3_prefix):
            rel_path = key[len(s3_prefix):]
        else:
            rel_path = key
        
        s3_etag = obj.get('ETag', '').strip('"')
        s3_files[rel_path] = {
            'key': key,
            'hash': s3_etag,
            'size': obj.get('Size', 0)
        }
    
    # FIRST: Identify files that are already in sync (same name, same hash)
    # These should not be considered for rename detection
    already_matched_files = set()
    for rel_path, file_info in local_files.items():
        if rel_path in s3_files:
            local_hash = file_info['hash']
            s3_hash = s3_files[rel_path]['hash']
            # File is already in sync - same name, same hash
            if local_hash == s3_hash:
                already_matched_files.add(rel_path)
    
    # Rename detection removed - renamed files will be treated as delete + upload
    renames = {}
    
    # Track what we're doing
    uploaded = 0
    updated = 0
    deleted = 0
    renamed = 0
    folders_deleted = 0
    folders_added = 0
    failed = 0
    
    # Check if we're creating a new folder
    # A folder is new if:
    # 1. We have local files to upload
    # 2. No files exist in S3 for this prefix (folder doesn't exist yet)
    # 3. We're syncing a directory (sync_scope_prefix ends with '/' indicates directory scope)
    folder_is_new = False
    if local_files and len(s3_files) == 0:
        # Check if this is a directory sync (not a file)
        # For directories, sync_scope_prefix ends with '/' 
        # For files, sync_scope_prefix is the full S3 key (no trailing '/')
        is_directory_sync = sync_scope_prefix and sync_scope_prefix.endswith('/')
        
        # Only count as new folder if it's a directory sync
        if is_directory_sync:
            folder_is_new = True
    
    # Process local files
    local_items = list(local_files.items())
    for idx, (rel_path, file_info) in enumerate(local_items, 1):
        
        # Skip if file is already in sync (already matched) - unless force is enabled
        # When force is enabled, we still need to upload to update Content-Type metadata
        if rel_path in already_matched_files and not force:
            continue
        
        local_hash = file_info['hash']
        local_size = file_info['size']
        local_path = file_info['path']
        
        # Build S3 key
        if s3_prefix:
            s3_key = s3_prefix + rel_path
        else:
            s3_key = rel_path
        
        # Check if file exists in S3
        if rel_path in s3_files:
            s3_hash = s3_files[rel_path]['hash']
            # Check if file needs update
            if force or local_hash != s3_hash:
                # File exists but hash differs - update it
                progress = f"[{idx}/{len(local_items)}]"
                print(f"{progress} Updating: {rel_path} ({format_size(local_size)})")
                if upload_file(s3_client, bucket_name, local_path, s3_key, dry_run=dry_run, verbose=verbose):
                    updated += 1
                else:
                    failed += 1
            else:
                # File unchanged (shouldn't happen since we already filtered these out, but keep for safety)
                progress = f"[{idx}/{len(local_items)}]"
                print(f"{progress} Skipped (unchanged): {rel_path} ({format_size(local_size)})")
        else:
            # New file - upload it
            progress = f"[{idx}/{len(local_items)}]"
            print(f"{progress} Uploading (new): {rel_path} ({format_size(local_size)})")
            if upload_file(s3_client, bucket_name, local_path, s3_key, dry_run=dry_run, verbose=verbose):
                uploaded += 1
                # If this is the first file uploaded to a new folder, count it as a folder added
                if folder_is_new and uploaded == 1:
                    folders_added = 1
            else:
                failed += 1
    
    # Delete orphaned files (exist in S3 but not locally)
    # Only consider files within the sync scope
    # Also skip files with extensions we ignore (e.g., .psd files)
    orphaned_keys = []
    for rel_path, s3_info in s3_files.items():
        s3_key = s3_info['key']
        
        # Skip files with ignored extensions (never delete these from S3)
        file_ext = os.path.splitext(rel_path)[1].lower()
        if file_ext in SKIP_EXTENSIONS:
            continue
        
        # Skip if exists locally
        if rel_path not in local_files:
            # Only delete files within the sync scope
            if sync_scope_prefix is None or s3_key.startswith(sync_scope_prefix):
                orphaned_keys.append((s3_key, rel_path, s3_info['size']))
    
    if orphaned_keys:
        print(f"\n🗑️  Deleting {len(orphaned_keys)} orphaned file(s)...")
        for s3_key, rel_path, size in orphaned_keys:
            print(f"   Deleting: {rel_path} ({format_size(size)})")
            if delete_s3_object(s3_client, bucket_name, s3_key, dry_run=dry_run):
                deleted += 1
            else:
                failed += 1
    
    # Handle folder markers and count folder deletions
    # A folder is effectively deleted when we delete all files in it
    # Delete folder markers if we deleted all files in a directory (when local_files is empty)
    # This happens when a folder doesn't exist locally but exists on S3
    if not local_files and len(orphaned_keys) > 0:
        # We deleted all files - the folder is effectively deleted
        # Delete folder markers if they exist
        if s3_folder_markers:
            print(f"\n📁 Deleting {len(s3_folder_markers)} folder marker(s)...")
            for folder_marker_key in s3_folder_markers:
                # Extract folder name for display
                if s3_prefix and folder_marker_key.startswith(s3_prefix):
                    # Get the folder name relative to the prefix
                    folder_rel_path = folder_marker_key[len(s3_prefix):].rstrip('/')
                    folder_name = folder_rel_path.split('/')[-1] if '/' in folder_rel_path else folder_rel_path
                else:
                    folder_name = folder_marker_key.rstrip('/').split('/')[-1] if '/' in folder_marker_key else folder_marker_key.rstrip('/')
                print(f"   Deleting folder: {folder_name}")
                if delete_s3_object(s3_client, bucket_name, folder_marker_key, dry_run=dry_run):
                    folders_deleted += 1
                else:
                    failed += 1
        
        # Count the folder as deleted even if there are no folder markers
        # (since deleting all files effectively deletes the folder)
        # Only count it if we haven't already counted folder markers
        # AND only if this is a directory sync (not a single file)
        if folders_deleted == 0:
            # Check if sync_scope_prefix represents a directory (not just a file)
            # For directories, sync_scope_prefix ends with '/' (e.g., "{S3_PREFIX}test/")
            # For files, sync_scope_prefix is the full S3 key without trailing '/' (e.g., "{S3_PREFIX}index2.html")
            # We must explicitly check that sync_scope_prefix ends with '/' to ensure it's a directory
            is_directory_sync = False
            if sync_scope_prefix:
                # Only directories have sync_scope_prefix ending with '/'
                # Files have sync_scope_prefix as the full S3 key (no trailing '/')
                is_directory_sync = sync_scope_prefix.endswith('/')
            
            # Only count as folder deletion if this is a directory sync
            # This ensures we don't count single file deletions as folder deletions
            if is_directory_sync:
                folders_deleted = 1
    
    # Check if we need to create folder markers for new directories
    # If we uploaded files and the directory didn't exist before, we might want to create a folder marker
    # Actually, S3 doesn't require folder markers - they're optional. Let's skip creating them for now
    # since they're not necessary and can clutter the bucket.
    
    print("=" * 70)
    return uploaded, updated, deleted, renamed, folders_deleted, folders_added, failed

def sync_single_path(s3_client, project_root, project_path, bucket_override=None, 
                     prefix_override=None, region='us-east-1', force=False, 
                     dry_run=False, yes=False, return_preview_info=False, verbose=False):
    """
    Sync a single path (file or directory) to S3.
    
    Args:
        return_preview_info: If True, also return preview information dict.
    
    Returns (uploaded, updated, deleted, renamed, folders_deleted, folders_added, failed) tuple.
    If return_preview_info is True, returns (uploaded, updated, deleted, renamed, folders_deleted, folders_added, failed, preview_info) tuple.
    preview_info dict contains: {'new_files': [...], 'changed_files': [...], 'renames': {...}, 'orphaned_files': [...], 'local_files': {...}, 's3_objects': [...], 's3_prefix': '...', 'bucket_name': '...'}
    """
    # Parse the path
    bucket_name, s3_prefix, local_path = parse_project_path(
        project_root, project_path,
        bucket_override=bucket_override,
        prefix_override=prefix_override
    )
    
    # Check if local path exists
    local_path_exists = os.path.exists(local_path)
    
    # Determine if it's a file or directory (or what it should be based on path)
    if local_path_exists:
        is_file = os.path.isfile(local_path)
        path_type = "file" if is_file else "directory"
    else:
        # Path doesn't exist locally - determine type from project_path
        # If it has an extension or no slash, treat as file; otherwise directory
        project_path_clean = project_path.lstrip('/').lstrip('\\')
        if '.' in os.path.basename(project_path_clean) and '/' not in project_path_clean.replace('\\', '/'):
            is_file = True
            path_type = "file (not found locally)"
        else:
            is_file = False
            path_type = "directory (not found locally)"
    
    print(f"\n{'=' * 70}")
    print(f"Processing {path_type}: {project_path}")
    print(f"{'=' * 70}")
    print(f"Local path: {local_path}")
    if not local_path_exists:
        print(f"⚠️  Local path does not exist - will delete from S3 if found")
    print(f"Bucket: {bucket_name}")
    print(f"S3 prefix: {s3_prefix}")
    
    # Scan local files (will be empty if path doesn't exist)
    if local_path_exists:
        print(f"\nScanning local {path_type}...")
        local_files = scan_local_files(local_path)
        if not local_files:
            print(f"⚠️  No files found in {path_type}.")
            # Continue to check S3 and delete if needed
            local_files = {}
    else:
        # Path doesn't exist locally - no local files
        print(f"\n⚠️  Local path does not exist - will check S3 for files to delete")
        local_files = {}
    
    if local_files:
        print(f"✅ Found {len(local_files)} file(s)")
        total_local_size = sum(f['size'] for f in local_files.values())
        print(f"   Total size: {format_size(total_local_size)}")
    else:
        print(f"ℹ️  No local files (path does not exist locally)")
    
    # Determine sync scope prefix - this limits what we consider for orphaned files
    # For files, use the specific file's S3 key as the scope
    # For directories, use the directory's prefix as the scope
    if is_file:
        # For single files, the scope is just that file
        # Build the S3 key for the file
        if local_path_exists:
            filename = os.path.basename(local_path)
        else:
            # Path doesn't exist - get filename from project_path
            project_path_clean = project_path.lstrip('/').lstrip('\\')
            filename = os.path.basename(project_path_clean)
        sync_scope_prefix = s3_prefix + filename
    else:
        # For directories, the scope is the directory prefix
        sync_scope_prefix = s3_prefix
    
    # List S3 objects - for single files, we only need to check that specific file
    # For directories, list all objects within the directory prefix
    print(f"\nListing S3 bucket contents...")
    if is_file:
        # For single files, check if the specific file exists
        if local_path_exists:
            filename = os.path.basename(local_path)
        else:
            # Path doesn't exist - get filename from project_path
            project_path_clean = project_path.lstrip('/').lstrip('\\')
            filename = os.path.basename(project_path_clean)
        s3_key = s3_prefix + filename
        s3_objects = []
        try:
            # Try to get the specific object
            response = s3_client.head_object(Bucket=bucket_name, Key=s3_key)
            # If it exists, create a mock object entry
            etag = response.get('ETag', '')
            # ETag from head_object may have quotes, strip them
            if etag.startswith('"') and etag.endswith('"'):
                etag = etag[1:-1]
            s3_objects.append({
                'Key': s3_key,
                'ETag': etag,
                'Size': response.get('ContentLength', 0)
            })
            print(f"✅ Found existing file in S3: {s3_key}")
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                print(f"ℹ️  File does not exist in S3 yet: {s3_key}")
            else:
                print(f"⚠️  Error checking file in S3: {e}")
                if return_preview_info:
                    return 0, 0, 0, 0, 0, 0, 1, None
                return 0, 0, 0, 0, 0, 0, 1
    else:
        # For directories, list all objects with the prefix
        s3_objects = list_all_objects(s3_client, bucket_name, prefix=s3_prefix)
        if s3_objects is None:
            if return_preview_info:
                return 0, 0, 0, 0, 0, 0, 1, None
            return 0, 0, 0, 0, 0, 0, 1
    
    # Preview changes
    print(f"\n📊 Preview of changes:")
    s3_files = {}
    for obj in s3_objects:
        key = obj['Key']
        if key.endswith('/') and obj.get('Size', 0) == 0:
            continue
        # Only consider files within the sync scope
        if sync_scope_prefix and not key.startswith(sync_scope_prefix):
            continue
        if s3_prefix and key.startswith(s3_prefix):
            rel_path = key[len(s3_prefix):]
        else:
            rel_path = key
        s3_files[rel_path] = obj.get('ETag', '').strip('"')
    
    # Identify changes
    new_files = [p for p in local_files.keys() if p not in s3_files]
    changed_files = []
    for rel_path, file_info in local_files.items():
        if rel_path in s3_files:
            # Include files that will be updated (hash differs OR force is enabled)
            if force or file_info['hash'] != s3_files[rel_path]:
                changed_files.append(rel_path)
    
    # FIRST: Identify files that are already in sync (same name, same hash) for preview
    # These should not be considered for rename detection
    already_matched_files_preview = set()
    for rel_path, file_info in local_files.items():
        if rel_path in s3_files:
            local_hash = file_info['hash']
            s3_hash = s3_files[rel_path]
            # File is already in sync - same name, same hash
            if local_hash == s3_hash:
                already_matched_files_preview.add(rel_path)
    
    # Rename detection removed - renamed files will be treated as delete + upload
    renames = {}
    
    # Only consider orphaned files within the sync scope
    # Skip files with ignored extensions (e.g., .psd files - never delete these from S3)
    orphaned_files = [p for p in s3_files.keys() 
                     if p not in local_files 
                     and os.path.splitext(p)[1].lower() not in SKIP_EXTENSIONS]
    
    # Track folder markers for preview
    folder_markers = []
    for obj in s3_objects:
        key = obj['Key']
        if key.endswith('/') and obj.get('Size', 0) == 0:
            if sync_scope_prefix is None or key.startswith(sync_scope_prefix):
                folder_markers.append(key)
    
    # Determine if folders will be deleted
    # A folder is considered deleted when:
    # 1. All files in the folder are deleted (local_files is empty and orphaned_files exist), OR
    # 2. There are folder markers that will be deleted
    folders_to_delete = []
    if not local_files and len(orphaned_files) > 0:
        # We're deleting all files - the folder will effectively be deleted
        # Extract folder name from project_path
        if not is_file:
            folder_name = project_path.lstrip('/').lstrip('\\').split('/')[-1].split('\\')[-1]
            if folder_name:
                folders_to_delete.append(folder_name)
        
        # Also add any folder markers that will be deleted
        if folder_markers:
            for folder_marker_key in folder_markers:
                if s3_prefix and folder_marker_key.startswith(s3_prefix):
                    folder_rel_path = folder_marker_key[len(s3_prefix):].rstrip('/')
                    folder_name = folder_rel_path.split('/')[-1] if '/' in folder_rel_path else folder_rel_path
                else:
                    folder_name = folder_marker_key.rstrip('/').split('/')[-1] if '/' in folder_marker_key else folder_marker_key.rstrip('/')
                # Avoid duplicates
                if folder_name and folder_name not in folders_to_delete:
                    folders_to_delete.append(folder_name)
    
    # Determine if folders will be added
    # A folder is considered added when:
    # 1. We're syncing a directory (not a file)
    # 2. The directory doesn't exist on S3 (no files exist with the s3_prefix, or all files are new)
    # 3. We're uploading new files to that directory
    folders_to_add = []
    if not is_file and local_files:
        # Check if this is a new folder (all files are new)
        if len(s3_files) == 0 and len(new_files) > 0:
            # No files exist in S3 for this prefix, and we have new files to upload
            # This means we're adding a new folder
            folder_name = project_path.lstrip('/').lstrip('\\').split('/')[-1].split('\\')[-1]
            if folder_name:
                folders_to_add.append(folder_name)
    
    # Prepare preview info if requested
    preview_info = None
    if return_preview_info:
        # Build detailed preview info with full paths for summary
        preview_new_files = []
        for file_path in new_files:
            file_size = local_files[file_path]['size']
            # For directories, include project path prefix; for files, project_path is the file itself
            if is_file:
                full_path = project_path
            else:
                full_path = f"{project_path}/{file_path}" if file_path else project_path
            preview_new_files.append({'path': full_path, 'size': file_size})
        
        preview_changed_files = []
        for file_path in changed_files:
            file_size = local_files[file_path]['size']
            if is_file:
                full_path = project_path
            else:
                full_path = f"{project_path}/{file_path}" if file_path else project_path
            preview_changed_files.append({'path': full_path, 'size': file_size})
        
        preview_orphaned_files = []
        for file_path in orphaned_files:
            s3_key = s3_prefix + file_path if s3_prefix else file_path
            s3_obj = next((obj for obj in s3_objects if obj['Key'] == s3_key), None)
            file_size = s3_obj.get('Size', 0) if s3_obj else 0
            if is_file:
                full_path = project_path
            else:
                full_path = f"{project_path}/{file_path}" if file_path else project_path
            preview_orphaned_files.append({'path': full_path, 'size': file_size})
        
        # Prepare folder preview info
        preview_folders_to_delete = []
        if folders_to_delete:
            for folder_name in folders_to_delete:
                preview_folders_to_delete.append({'name': folder_name})
        
        preview_folders_to_add = []
        if folders_to_add:
            for folder_name in folders_to_add:
                preview_folders_to_add.append({'name': folder_name})
        
        preview_info = {
            'new_files': preview_new_files,
            'changed_files': preview_changed_files,
            'renames': [],
            'orphaned_files': preview_orphaned_files,
            'folders_to_delete': preview_folders_to_delete,
            'folders_to_add': preview_folders_to_add,
            'bucket_name': bucket_name,
            's3_prefix': s3_prefix,
            'project_path': project_path
        }
    
    # Display counts
    print(f"   📤 New files to upload: {len(new_files)}")
    if new_files:
        for file_path in sorted(new_files):
            file_size = local_files[file_path]['size']
            print(f"      + {file_path} ({format_size(file_size)})")
    
    print(f"   🔄 Files to update: {len(changed_files)}")
    if changed_files:
        for file_path in sorted(changed_files):
            file_size = local_files[file_path]['size']
            print(f"      ~ {file_path} ({format_size(file_size)})")
    
    print(f"   🗑️  Files to delete: {len(orphaned_files)}")
    if orphaned_files:
        for file_path in sorted(orphaned_files):
            # Get size from S3 object
            s3_key = s3_prefix + file_path if s3_prefix else file_path
            s3_obj = next((obj for obj in s3_objects if obj['Key'] == s3_key), None)
            file_size = s3_obj.get('Size', 0) if s3_obj else 0
            print(f"      - {file_path} ({format_size(file_size)})")
    
    # Show folder deletions and additions only if there are any
    if folders_to_delete:
        print(f"   📁 Folders to delete: {len(folders_to_delete)}")
        for folder_name in sorted(folders_to_delete):
            print(f"      - {folder_name}")
    
    if folders_to_add:
        print(f"   📁 Folders to add: {len(folders_to_add)}")
        for folder_name in sorted(folders_to_add):
            print(f"      + {folder_name}")
    
    # Behavior:
    # - If --dry-run flag: Only show preview, don't ask confirmation, don't do actual sync
    # - If --yes flag: Skip preview, skip confirmation, do actual sync immediately
    # - Default (no flags): Show preview (dry-run), ask confirmation, if yes then do actual sync
    
    if dry_run:
        # --dry-run flag: Just show preview, no confirmation needed
        uploaded, updated, deleted, renamed, folders_deleted, folders_added, failed = sync_to_s3(
            s3_client, bucket_name, local_path, local_files, s3_objects, s3_prefix,
            force=force, dry_run=True, sync_scope_prefix=sync_scope_prefix, verbose=verbose
        )
    elif yes:
        # --yes flag: Skip preview and confirmation, do actual sync immediately
        uploaded, updated, deleted, renamed, folders_deleted, folders_added, failed = sync_to_s3(
            s3_client, bucket_name, local_path, local_files, s3_objects, s3_prefix,
            force=force, dry_run=False, sync_scope_prefix=sync_scope_prefix, verbose=verbose
        )
    else:
        # Default: Show preview first (dry-run), then ask for confirmation
        if len(new_files) > 0 or len(changed_files) > 0 or len(orphaned_files) > 0 or len(folders_to_delete) > 0 or len(folders_to_add) > 0:
            print(f"\n{'=' * 70}")
            print("DRY RUN PREVIEW")
            print(f"{'=' * 70}")
            # Show preview
            sync_to_s3(
                s3_client, bucket_name, local_path, local_files, s3_objects, s3_prefix,
                force=force, dry_run=True, sync_scope_prefix=sync_scope_prefix, verbose=verbose
            )
            # Ask for confirmation
            try:
                response = input(f"\nProceed with actual sync for {project_path}? (yes/no): ").strip().lower()
                if response not in ['yes', 'y']:
                    print(f"❌ Skipped: {project_path}")
                    if return_preview_info:
                        return 0, 0, 0, 0, 0, 0, 0, preview_info
                    return 0, 0, 0, 0, 0, 0, 0
            except (KeyboardInterrupt, EOFError):
                print(f"\n❌ Skipped: {project_path}")
                if return_preview_info:
                    return 0, 0, 0, 0, 0, 0, 0, preview_info
                return 0, 0, 0, 0, 0, 0, 0
            # Do actual sync
            print(f"\n{'=' * 70}")
            print("PROCEEDING WITH ACTUAL SYNC")
            print(f"{'=' * 70}")
            uploaded, updated, deleted, renamed, folders_deleted, folders_added, failed = sync_to_s3(
                s3_client, bucket_name, local_path, local_files, s3_objects, s3_prefix,
                force=force, dry_run=False, sync_scope_prefix=sync_scope_prefix, verbose=verbose
            )
        else:
            # No changes, just show that
            print(f"\n✅ No changes needed for {project_path}")
            uploaded, updated, deleted, renamed, folders_deleted, folders_added, failed = 0, 0, 0, 0, 0, 0, 0
    
    if return_preview_info:
        return uploaded, updated, deleted, renamed, folders_deleted, folders_added, failed, preview_info
    return uploaded, updated, deleted, renamed, folders_deleted, folders_added, failed

def main():
    """Main upload function."""
    parser = argparse.ArgumentParser(
        description='Upload and sync project files to S3 bucket',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Sync specific paths
  python scripts/aws/s3/sync_to_s3.py /Themes
  python scripts/aws/s3/sync_to_s3.py /index.html
  python scripts/aws/s3/sync_to_s3.py /Themes /css /index.html
  
  # Sync default paths (assets, css, phaserjs_editor_scripts_base, src, Themes, index.html, favicon.ico)
  python scripts/aws/s3/sync_to_s3.py
  
  # Dry-run to preview changes
  python scripts/aws/s3/sync_to_s3.py /Themes --dry-run
  
  # Force upload all files (ignore hash checks)
  python scripts/aws/s3/sync_to_s3.py /Themes --force
  
  # Override bucket or prefix
  python scripts/aws/s3/sync_to_s3.py /Themes --bucket my-bucket
  python scripts/aws/s3/sync_to_s3.py /Themes --prefix custom-prefix/
        """
    )
    parser.add_argument(
        'paths',
        nargs='*',
        help='Project-relative paths to sync (e.g., /Themes, /index.html). If not provided, syncs default paths.'
    )
    parser.add_argument(
        '--bucket',
        default=None,
        help=f'Override bucket name (default: {BUCKET})'
    )
    parser.add_argument(
        '--prefix',
        default=None,
        help=f'Override S3 prefix (default: {S3_PREFIX})'
    )
    parser.add_argument(
        '--region',
        default='us-east-1',
        help='AWS region (default: us-east-1)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview changes without actually uploading/deleting'
    )
    parser.add_argument(
        '--yes', '-y',
        action='store_true',
        help='Skip dry-run preview and confirmation, proceed directly with upload'
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='Force upload all files, ignoring hash checks'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Show debug output including Content-Type being set for each file'
    )
    parser.add_argument(
        '--preview-paths',
        action='store_true',
        help='Show detailed preview for each path before summary. If not provided, only shows summary of changes.'
    )
    
    args = parser.parse_args()
    
    # Find project root
    project_root = find_project_root()
    if not project_root:
        print("❌ Error: Could not find project root (directory containing index.html)")
        print("   Please run this script from within the project directory or a subdirectory.")
        return False
    
    # Determine which paths to sync
    if args.paths:
        paths_to_sync = args.paths
    else:
        paths_to_sync = DEFAULT_PATHS
        print("ℹ️  No paths specified, using default paths:")
        for path in paths_to_sync:
            print(f"   - {path}")
    
    print("\n" + "=" * 70)
    print("S3 BUCKET UPLOAD SYNC")
    print("=" * 70)
    print(f"Project root: {project_root}")
    print(f"Bucket: {args.bucket if args.bucket else BUCKET}")
    print(f"Region: {args.region}")
    print(f"S3 base prefix: {args.prefix if args.prefix else S3_PREFIX}")
    if args.dry_run:
        print(f"Mode: DRY RUN (preview only)")
    else:
        print(f"Mode: SYNC (will upload/update/delete files)")
    if args.force:
        print(f"Force: Enabled (ignoring hash checks)")
    print(f"Paths to sync: {len(paths_to_sync)}")
    print()
    
    # Get S3 client
    print("Connecting to S3...")
    s3_client = get_s3_client(args.region)
    if not s3_client:
        return False
    print("✅ Connected to S3")
    
    # Process each path
    total_uploaded = 0
    total_updated = 0
    total_deleted = 0
    total_renamed = 0
    total_folders_deleted = 0
    total_folders_added = 0
    total_failed = 0
    
    # Determine bucket and prefix for summary
    bucket_name = args.bucket if args.bucket else BUCKET
    s3_base_prefix = args.prefix if args.prefix else S3_PREFIX
    
    # If not --dry-run and not --yes, show all previews first, then ask once, then sync all
    if not args.dry_run and not args.yes:
        # First pass: Show previews for all paths and collect preview info
        show_preview_details = args.preview_paths
        
        if show_preview_details:
            print(f"\n{'=' * 70}")
            print("PREVIEWING ALL PATHS")
            print(f"{'=' * 70}")
        
        all_preview_info = []
        for idx, path in enumerate(paths_to_sync, 1):
            if show_preview_details:
                print(f"\n{'=' * 70}")
                print(f"Path {idx}/{len(paths_to_sync)}: {path}")
                print(f"{'=' * 70}")
            
            # Just show preview, don't sync yet - but collect preview info
            # Suppress output if --preview-paths is not provided
            if show_preview_details:
                result = sync_single_path(
                    s3_client, project_root, path,
                    bucket_override=args.bucket,
                    prefix_override=args.prefix,
                    region=args.region,
                    force=args.force,
                    dry_run=True,  # Always dry-run for preview
                    yes=True,  # Skip confirmation in preview mode
                    return_preview_info=True,
                    verbose=args.verbose
                )
            else:
                # Suppress output while collecting preview info
                stdout_capture = StringIO()
                stderr_capture = StringIO()
                with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                    result = sync_single_path(
                        s3_client, project_root, path,
                        bucket_override=args.bucket,
                        prefix_override=args.prefix,
                        region=args.region,
                        force=args.force,
                        dry_run=True,  # Always dry-run for preview
                        yes=True,  # Skip confirmation in preview mode
                        return_preview_info=True,
                        verbose=args.verbose
                    )
            
            if len(result) == 8:  # Includes preview_info
                uploaded, updated, deleted, renamed, folders_deleted, folders_added, failed, preview_info = result
                if preview_info:
                    all_preview_info.append(preview_info)
            else:
                uploaded, updated, deleted, renamed, folders_deleted, folders_added, failed = result
        
        # Ask for confirmation once for all paths with comprehensive summary
        print(f"\n{'=' * 70}")
        print("SUMMARY OF ALL CHANGES")
        print(f"{'=' * 70}")
        
        # Show paths being synced
        print(f"Total paths to sync: {len(paths_to_sync)}")
        for path in paths_to_sync:
            print(f"   - {path}")
        
        # Aggregate all changes from all preview info
        all_new_files = []
        all_changed_files = []
        all_orphaned_files = []
        all_folders_to_delete = []
        all_folders_to_add = []
        
        for preview_info in all_preview_info:
            if preview_info:
                all_new_files.extend(preview_info['new_files'])
                all_changed_files.extend(preview_info['changed_files'])
                all_orphaned_files.extend(preview_info['orphaned_files'])
                all_folders_to_delete.extend(preview_info.get('folders_to_delete', []))
                all_folders_to_add.extend(preview_info.get('folders_to_add', []))
        
        # Display structured summary matching "Preview of changes" format
        print(f"\n📊 Preview of changes:")
        print(f"   📤 New files to upload: {len(all_new_files)}")
        if all_new_files:
            for file_info in sorted(all_new_files, key=lambda x: x['path']):
                print(f"      + {file_info['path']} ({format_size(file_info['size'])})")
        
        print(f"   🔄 Files to update: {len(all_changed_files)}")
        if all_changed_files:
            for file_info in sorted(all_changed_files, key=lambda x: x['path']):
                print(f"      ~ {file_info['path']} ({format_size(file_info['size'])})")
        
        print(f"   🗑️  Files to delete: {len(all_orphaned_files)}")
        if all_orphaned_files:
            for file_info in sorted(all_orphaned_files, key=lambda x: x['path']):
                print(f"      - {file_info['path']} ({format_size(file_info['size'])})")
        
        # Show folders only if there are any
        if all_folders_to_delete:
            print(f"   📁 Folders to delete: {len(all_folders_to_delete)}")
            for folder_info in sorted(all_folders_to_delete, key=lambda x: x['name']):
                print(f"      - {folder_info['name']}")
        
        if all_folders_to_add:
            print(f"   📁 Folders to add: {len(all_folders_to_add)}")
            for folder_info in sorted(all_folders_to_add, key=lambda x: x['name']):
                print(f"      + {folder_info['name']}")
        
        # Check if there are any changes
        has_changes = (len(all_new_files) > 0 or len(all_changed_files) > 0 or 
                      len(all_orphaned_files) > 0 or 
                      len(all_folders_to_delete) > 0 or len(all_folders_to_add) > 0)
        
        if not has_changes:
            # No changes found, skip confirmation and inform user
            print(f"\n✅ No changes detected. Everything is already in sync.")
            print(f"   Total paths checked: {len(paths_to_sync)}")
            for path in paths_to_sync:
                print(f"      - {path}")
            return True
        
        # Show bucket and prefix info
        print(f"\n🔄 Syncing local files to S3 bucket: {bucket_name}")
        print(f"   S3 prefix: {s3_base_prefix}")
        
        try:
            response = input(f"\nProceed with syncing all {len(paths_to_sync)} path(s)? (yes/no): ").strip().lower()
            if response not in ['yes', 'y']:
                print("❌ Sync cancelled by user")
                return False
        except (KeyboardInterrupt, EOFError):
            print("\n❌ Sync cancelled by user")
            return False
        
        # Second pass: Actually sync all paths
        print(f"\n{'=' * 70}")
        print("PROCEEDING WITH ACTUAL SYNC FOR ALL PATHS")
        print(f"{'=' * 70}")
        
        for idx, path in enumerate(paths_to_sync, 1):
            print(f"\n{'=' * 70}")
            print(f"Path {idx}/{len(paths_to_sync)}: {path}")
            print(f"{'=' * 70}")
            
            uploaded, updated, deleted, renamed, folders_deleted, folders_added, failed = sync_single_path(
                s3_client, project_root, path,
                bucket_override=args.bucket,
                prefix_override=args.prefix,
                region=args.region,
                force=args.force,
                dry_run=False,  # Actual sync
                yes=True,  # Skip confirmation since we already confirmed
                verbose=args.verbose
            )
            
            total_uploaded += uploaded
            total_updated += updated
            total_deleted += deleted
            total_renamed += renamed
            total_folders_deleted += folders_deleted
            total_folders_added += folders_added
            total_failed += failed
    else:
        # --dry-run or --yes: Process each path normally (with or without confirmation per path)
        for idx, path in enumerate(paths_to_sync, 1):
            print(f"\n{'=' * 70}")
            print(f"Path {idx}/{len(paths_to_sync)}: {path}")
            print(f"{'=' * 70}")
            
            uploaded, updated, deleted, renamed, folders_deleted, folders_added, failed = sync_single_path(
                s3_client, project_root, path,
                bucket_override=args.bucket,
                prefix_override=args.prefix,
                region=args.region,
                force=args.force,
                dry_run=args.dry_run,
                yes=args.yes,
                verbose=args.verbose
            )
            
            total_uploaded += uploaded
            total_updated += updated
            total_deleted += deleted
            total_renamed += renamed
            total_folders_deleted += folders_deleted
            total_folders_added += folders_added
            total_failed += failed
    
    # Final summary
    print("\n" + "=" * 70)
    if args.dry_run:
        print("🎯 DRY RUN COMPLETED")
    else:
        if total_failed == 0:
            print("🎉 SYNC COMPLETED SUCCESSFULLY!")
        else:
            print(f"⚠️  SYNC COMPLETED WITH {total_failed} FAILURES")
    print("=" * 70)
    print(f"✅ Project root: {project_root}")
    print(f"✅ S3 bucket: {args.bucket if args.bucket else BUCKET}")
    print(f"✅ S3 base prefix: {args.prefix if args.prefix else S3_PREFIX}")
    print(f"✅ Paths processed: {len(paths_to_sync)}")
    print(f"✅ Files uploaded: {total_uploaded}")
    print(f"✅ Files updated: {total_updated}")
    if total_deleted > 0:
        print(f"✅ Files deleted: {total_deleted}")
    if total_folders_deleted > 0:
        print(f"✅ Folders deleted: {total_folders_deleted}")
    if total_folders_added > 0:
        print(f"✅ Folders added: {total_folders_added}")
    if total_failed > 0:
        print(f"❌ Failed operations: {total_failed}")
    print()
    
    return total_failed == 0

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n❌ Upload cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

