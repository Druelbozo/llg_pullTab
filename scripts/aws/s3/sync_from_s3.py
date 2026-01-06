#!/usr/bin/env python3
"""
S3 Bucket Download Script: Download and sync files from S3 bucket to local filesystem
=======================================================================================

This script downloads S3 bucket files to local project filesystem, maintaining directory structure
and intelligently detecting file renames.

USAGE:
    python scripts/aws/s3/sync_from_s3.py [path1] [path2] ...
    
    Examples:
    # Sync specific paths
    python scripts/aws/s3/sync_from_s3.py /Themes
    python scripts/aws/s3/sync_from_s3.py /index.html
    python scripts/aws/s3/sync_from_s3.py /Themes /css /index.html
    
    # Sync default paths (assets, css, phaserjs_editor_scripts_base, src, Themes, index.html, favicon.ico)
    python scripts/aws/s3/sync_from_s3.py
    
    # Dry-run to preview changes
    python scripts/aws/s3/sync_from_s3.py /Themes --dry-run
    
    # Force download all files (ignore hash checks)
    python scripts/aws/s3/sync_from_s3.py /Themes --force
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

# Import SSO authentication utility
# Add parent directory (scripts/aws) to path to import aws_sso_auth
_aws_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _aws_dir not in sys.path:
    sys.path.insert(0, _aws_dir)
from sso.aws_sso_auth import ensure_sso_authenticated, get_boto3_session

# Import shared AWS configuration
from aws_config import BUCKET, S3_PREFIX

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
    Added for consistency with sync_to_s3.py.
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
    
    Paths are synced from: {BUCKET}/{S3_PREFIX}/{path}/
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
    
    # Files to skip
    skip_files = {
        '.s3-sync-metadata.json',
        'generate-index.js',
        'README.md'
    }
    
    if os.path.isfile(local_path):
        # Single file: relative path is just the filename
        filename = os.path.basename(local_path)
        if filename not in skip_files:
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
            for file in files:
                # Skip metadata and local-only files
                if file in skip_files:
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

def create_local_directory(file_path):
    """Ensure the directory for a file exists, creating it if necessary."""
    directory = os.path.dirname(file_path)
    if directory and not os.path.exists(directory):
        try:
            os.makedirs(directory, exist_ok=True)
            return True
        except (IOError, OSError) as e:
            print(f"   ⚠️  Warning: Failed to create directory {directory}: {e}")
            return False
    return True

def download_file(s3_client, bucket_name, s3_key, local_path, dry_run=False):
    """Download a single file from S3 to local filesystem."""
    if dry_run:
        return True
    
    try:
        # Ensure directory exists
        if not create_local_directory(local_path):
            return False
        
        # Download file
        s3_client.download_file(bucket_name, s3_key, local_path)
        return True
    except Exception as e:
        print(f"   ⚠️  Warning: Failed to download {s3_key}: {e}")
        return False

def delete_local_file(local_path, dry_run=False):
    """Delete a single local file."""
    if dry_run:
        return True
    
    try:
        if os.path.exists(local_path):
            os.remove(local_path)
            # Try to remove empty parent directories
            parent_dir = os.path.dirname(local_path)
            try:
                if parent_dir and os.path.exists(parent_dir) and not os.listdir(parent_dir):
                    os.rmdir(parent_dir)
            except (IOError, OSError):
                # Directory not empty or can't remove, that's okay
                pass
        return True
    except Exception as e:
        print(f"   ⚠️  Warning: Failed to delete {local_path}: {e}")
        return False

def detect_renames(local_files, s3_objects, s3_prefix, similarity_threshold=0.7, already_matched_files=None):
    """
    Detect renamed files by matching content hash and filename similarity.
    REVERSE DIRECTION: Detects when S3 file was renamed (local has old name, S3 has new name).
    
    Args:
        already_matched_files: Set of local file paths that are already in sync with S3.
                              These files should not be considered for rename detection.
    
    Returns dict: {old_local_path: {'new_s3_key': key, 'new_s3_rel_path': path, 'similarity': score, 'old_filename': str, 'new_filename': str}}
    """
    if already_matched_files is None:
        already_matched_files = set()
    renames = {}
    
    # Build hash map for S3 files: {hash: [list of (key, rel_path, filename)]}
    s3_hash_map = {}
    s3_paths_set = set()
    
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
        
        s3_paths_set.add(rel_path)
        
        s3_etag = obj.get('ETag', '').strip('"')
        if s3_etag:
            if s3_etag not in s3_hash_map:
                s3_hash_map[s3_etag] = []
            filename = os.path.basename(rel_path)
            s3_hash_map[s3_etag].append((key, rel_path, filename))
    
    # Build hash map for local files: {hash: [list of (path, filename)]}
    # Exclude files that are already matched/in-sync
    local_hash_map = {}
    for rel_path, file_info in local_files.items():
        # Skip files that are already matched/in-sync - they shouldn't be considered for renames
        if rel_path in already_matched_files:
            continue
        # Skip if this file exists in S3 with same name (not a rename)
        if rel_path in s3_paths_set:
            continue
        file_hash = file_info['hash']
        filename = os.path.basename(rel_path)
        if file_hash not in local_hash_map:
            local_hash_map[file_hash] = []
        local_hash_map[file_hash].append((rel_path, filename))
    
    # Build a map of ALL S3 files by hash (including matched ones) to check if local files
    # match already-matched S3 files (should skip those to avoid false renames)
    all_s3_hash_to_paths = {}
    for obj in s3_objects:
        key = obj['Key']
        if key.endswith('/') and obj.get('Size', 0) == 0:
            continue
        if s3_prefix and key.startswith(s3_prefix):
            rel_path = key[len(s3_prefix):]
        else:
            rel_path = key
        s3_etag = obj.get('ETag', '').strip('"')
        if s3_etag:
            if s3_etag not in all_s3_hash_to_paths:
                all_s3_hash_to_paths[s3_etag] = []
            all_s3_hash_to_paths[s3_etag].append(rel_path)
    
    # Find renames: Local file with hash matching S3 file, but different name
    # This means S3 file was renamed (local has old name, S3 has new name)
    claimed_local_files = set()
    
    # First pass: collect all potential renames with their similarity scores
    potential_renames = []
    for local_hash, local_entries in local_hash_map.items():
        if local_hash in s3_hash_map:
            # Found matching hash - check for similar filenames
            for local_rel_path, local_filename in local_entries:
                # Skip local files that have the same hash as already-matched S3 files
                if local_hash in all_s3_hash_to_paths:
                    matching_s3_paths = all_s3_hash_to_paths[local_hash]
                    if any(path in already_matched_files for path in matching_s3_paths):
                        # This local file has the same hash as an already-matched S3 file
                        # Skip it to avoid false rename detection
                        continue
                
                for s3_key, s3_rel_path, s3_filename in s3_hash_map[local_hash]:
                    # Calculate similarity
                    similarity = calculate_filename_similarity(local_filename, s3_filename)
                    if similarity >= similarity_threshold:
                        potential_renames.append({
                            'local_path': local_rel_path,
                            'local_filename': local_filename,
                            's3_key': s3_key,
                            's3_rel_path': s3_rel_path,
                            's3_filename': s3_filename,
                            'similarity': similarity
                        })
    
    # Sort by similarity (highest first) to prioritize best matches
    potential_renames.sort(key=lambda x: x['similarity'], reverse=True)
    
    # Second pass: assign renames, ensuring each local file is only claimed once
    for rename_candidate in potential_renames:
        local_path = rename_candidate['local_path']
        
        # Skip if this local path is already assigned or already claimed
        if local_path not in renames and local_path not in claimed_local_files:
            renames[local_path] = {
                'new_s3_key': rename_candidate['s3_key'],
                'new_s3_rel_path': rename_candidate['s3_rel_path'],
                'similarity': rename_candidate['similarity'],
                'old_filename': rename_candidate['local_filename'],
                'new_filename': rename_candidate['s3_filename']
            }
            claimed_local_files.add(local_path)
    
    return renames

def sync_from_s3(s3_client, bucket_name, project_root, local_files, s3_objects, s3_prefix, 
                 local_base_path, force=False, dry_run=False, sync_scope_prefix=None):
    """
    Main sync logic: download new files, update changed files, delete orphaned local files, handle renames.
    REVERSE DIRECTION: S3 -> Local
    
    Args:
        project_root: Project root directory
        local_base_path: Base local path for syncing (directory or file)
        sync_scope_prefix: If provided, only consider files within this prefix as orphaned.
                          This prevents deleting files outside the sync scope.
    
    Returns (downloaded, updated, deleted, renamed, folders_deleted, folders_added, failed) tuple.
    """
    print(f"\n🔄 Syncing S3 files to local directory: {project_root}")
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
    
    # SECOND: Detect renames, but exclude files that are already matched/in-sync
    renames = detect_renames(local_files, s3_objects, s3_prefix, already_matched_files=already_matched_files)
    
    # Track what we're doing
    downloaded = 0
    updated = 0
    deleted = 0
    renamed = 0
    folders_deleted = 0
    folders_added = 0
    failed = 0
    
    # Files to process (exclude those that will be renamed)
    rename_old_paths = set(renames.keys())
    rename_new_paths = {info['new_s3_rel_path'] for info in renames.values()}
    
    # Check if we're creating a new folder locally
    # A folder is new if:
    # 1. We have S3 files to download
    # 2. No files exist locally for this path (folder doesn't exist yet)
    # 3. We're syncing a directory (sync_scope_prefix ends with '/' indicates directory scope)
    folder_is_new = False
    if len(s3_files) > 0 and len(local_files) == 0:
        # Check if this is a directory sync (not a file)
        is_directory_sync = sync_scope_prefix and sync_scope_prefix.endswith('/')
        
        # Only count as new folder if it's a directory sync
        if is_directory_sync:
            folder_is_new = True
    
    # Determine if local_base_path is a file or directory
    is_file_sync = os.path.isfile(local_base_path) if os.path.exists(local_base_path) else (not sync_scope_prefix or not sync_scope_prefix.endswith('/'))
    
    # Process S3 files (download new, update changed)
    s3_items = list(s3_files.items())
    for idx, (rel_path, s3_info) in enumerate(s3_items, 1):
        # Skip if this will be handled as a rename
        if rel_path in rename_new_paths:
            continue
        
        s3_key = s3_info['key']
        s3_hash = s3_info['hash']
        s3_size = s3_info['size']
        
        # Build local file path
        if is_file_sync:
            # Single file sync - use local_base_path directly
            local_file_path = local_base_path
        else:
            # Directory sync - build path relative to local_base_path
            local_file_path = os.path.join(local_base_path, rel_path)
            local_file_path = os.path.normpath(local_file_path)
        
        # Check if file exists locally
        if rel_path in local_files:
            local_hash = local_files[rel_path]['hash']
            local_size = local_files[rel_path]['size']
            # Check if file needs update
            if force or local_hash != s3_hash:
                # File exists but hash differs - update it
                progress = f"[{idx}/{len(s3_items)}]"
                print(f"{progress} Updating: {rel_path} ({format_size(s3_size)})")
                if download_file(s3_client, bucket_name, s3_key, local_file_path, dry_run=dry_run):
                    updated += 1
                else:
                    failed += 1
            else:
                # File unchanged (already in sync)
                progress = f"[{idx}/{len(s3_items)}]"
                print(f"{progress} Skipped (unchanged): {rel_path} ({format_size(s3_size)})")
        else:
            # New file - download it
            progress = f"[{idx}/{len(s3_items)}]"
            print(f"{progress} Downloading (new): {rel_path} ({format_size(s3_size)})")
            if download_file(s3_client, bucket_name, s3_key, local_file_path, dry_run=dry_run):
                downloaded += 1
                # If this is the first file downloaded to a new folder, count it as a folder added
                if folder_is_new and downloaded == 1:
                    folders_added = 1
            else:
                failed += 1
    
    # Handle renames
    if renames:
        print(f"\n🔄 Processing {len(renames)} rename(s)...")
        for old_local_path, rename_info in renames.items():
            new_s3_key = rename_info['new_s3_key']
            new_s3_rel_path = rename_info['new_s3_rel_path']
            similarity = rename_info['similarity']
            old_filename = rename_info['old_filename']
            new_filename = rename_info['new_filename']
            
            # Build new local path
            if is_file_sync:
                new_local_path = local_base_path
            else:
                new_local_path = os.path.join(local_base_path, new_s3_rel_path)
                new_local_path = os.path.normpath(new_local_path)
            
            # Build old local path
            old_file_info = local_files[old_local_path]
            old_local_file_path = old_file_info['path']
            old_local_size = old_file_info['size']
            
            print(f"   Renaming: {old_filename} -> {new_filename} (similarity: {similarity:.2%})")
            
            # Delete old local file
            if delete_local_file(old_local_file_path, dry_run=dry_run):
                # Download with new name
                if download_file(s3_client, bucket_name, new_s3_key, new_local_path, dry_run=dry_run):
                    renamed += 1
                else:
                    failed += 1
            else:
                failed += 1
    
    # Delete orphaned local files (exist locally but not in S3, and not being renamed)
    # Only consider files within the sync scope
    orphaned_local_files = []
    for rel_path, file_info in local_files.items():
        # Skip if being renamed
        if rel_path in rename_old_paths:
            continue
        # Skip if exists in S3
        if rel_path not in s3_files:
            # Only delete files within the sync scope
            local_file_path = file_info['path']
            # Check if file is within scope
            if sync_scope_prefix is None:
                orphaned_local_files.append((local_file_path, rel_path, file_info['size']))
            else:
                # For directory syncs, check if file path is under local_base_path
                if not is_file_sync:
                    try:
                        rel_to_base = os.path.relpath(local_file_path, local_base_path)
                        # Normalize to forward slashes
                        rel_to_base = rel_to_base.replace('\\', '/')
                        # Build S3 key to check scope
                        s3_check_key = s3_prefix + rel_to_base
                        if s3_check_key.startswith(sync_scope_prefix):
                            orphaned_local_files.append((local_file_path, rel_path, file_info['size']))
                    except ValueError:
                        # Paths on different drives (Windows), skip scope check
                        orphaned_local_files.append((local_file_path, rel_path, file_info['size']))
                else:
                    # File sync - check if it matches
                    orphaned_local_files.append((local_file_path, rel_path, file_info['size']))
    
    # ALWAYS ask for confirmation before deleting local files (safety requirement)
    if orphaned_local_files and not dry_run:
        print(f"\n⚠️  {len(orphaned_local_files)} local file(s) will be deleted (they don't exist in S3):")
        for local_file_path, rel_path, size in orphaned_local_files[:10]:  # Show first 10
            print(f"   - {rel_path} ({format_size(size)})")
        if len(orphaned_local_files) > 10:
            print(f"   ... and {len(orphaned_local_files) - 10} more file(s)")
        try:
            response = input("\nProceed with deleting these local files? (yes/no): ").strip().lower()
            if response not in ['yes', 'y']:
                print("   ⏩ Skipping file deletions (user cancelled)")
                orphaned_local_files = []
        except (KeyboardInterrupt, EOFError):
            print("\n   ⏩ Skipping file deletions (user cancelled)")
            orphaned_local_files = []
    
    if orphaned_local_files:
        print(f"\n🗑️  Deleting {len(orphaned_local_files)} orphaned local file(s)...")
        for local_file_path, rel_path, size in orphaned_local_files:
            print(f"   Deleting: {rel_path} ({format_size(size)})")
            if delete_local_file(local_file_path, dry_run=dry_run):
                deleted += 1
            else:
                failed += 1
    
    # Handle folder deletions
    # A folder is effectively deleted when we delete all files in it
    # This happens when a folder exists locally but doesn't exist in S3
    if len(local_files) > 0 and len(s3_files) == 0 and len(orphaned_local_files) > 0:
        # We deleted all files - the folder is effectively deleted
        # Only count it if this is a directory sync (not a single file)
        is_directory_sync = sync_scope_prefix and sync_scope_prefix.endswith('/')
        if is_directory_sync:
            folders_deleted = 1
    
    print("=" * 70)
    return downloaded, updated, deleted, renamed, folders_deleted, folders_added, failed

def sync_single_path(s3_client, project_root, project_path, bucket_override=None, 
                     prefix_override=None, region='us-east-1', force=False, 
                     dry_run=False, yes=False, return_preview_info=False):
    """
    Sync a single path (file or directory) from S3 to local.
    
    Args:
        return_preview_info: If True, also return preview information dict.
    
    Returns (downloaded, updated, deleted, renamed, folders_deleted, folders_added, failed) tuple.
    If return_preview_info is True, returns (downloaded, updated, deleted, renamed, folders_deleted, folders_added, failed, preview_info) tuple.
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
            path_type = "file (will be created)"
        else:
            is_file = False
            path_type = "directory (will be created)"
    
    print(f"\n{'=' * 70}")
    print(f"Processing {path_type}: {project_path}")
    print(f"{'=' * 70}")
    print(f"Local path: {local_path}")
    if not local_path_exists:
        print(f"ℹ️  Local path does not exist - will download from S3")
    print(f"Bucket: {bucket_name}")
    print(f"S3 prefix: {s3_prefix}")
    
    # Scan local files (will be empty if path doesn't exist)
    if local_path_exists:
        print(f"\nScanning local {path_type}...")
        local_files = scan_local_files(local_path)
        if not local_files:
            print(f"ℹ️  No files found in {path_type}.")
            local_files = {}
    else:
        # Path doesn't exist locally - no local files
        print(f"\nℹ️  Local path does not exist - will download all files from S3")
        local_files = {}
    
    if local_files:
        print(f"✅ Found {len(local_files)} local file(s)")
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
                print(f"ℹ️  File does not exist in S3: {s3_key}")
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
        s3_files[rel_path] = {
            'hash': obj.get('ETag', '').strip('"'),
            'size': obj.get('Size', 0)
        }
    
    # Identify changes (REVERSE: what S3 has that local doesn't, or what differs)
    new_files = [p for p in s3_files.keys() if p not in local_files]
    changed_files = []
    for rel_path, file_info in local_files.items():
        if rel_path in s3_files:
            if file_info['hash'] != s3_files[rel_path]['hash']:
                changed_files.append(rel_path)
    
    # FIRST: Identify files that are already in sync (same name, same hash) for preview
    # These should not be considered for rename detection
    already_matched_files_preview = set()
    for rel_path, file_info in local_files.items():
        if rel_path in s3_files:
            local_hash = file_info['hash']
            s3_hash = s3_files[rel_path]['hash']
            # File is already in sync - same name, same hash
            if local_hash == s3_hash:
                already_matched_files_preview.add(rel_path)
    
    # SECOND: Detect renames, but exclude files that are already matched/in-sync
    # Filter renames to only consider files within scope
    all_renames = detect_renames(local_files, s3_objects, s3_prefix, already_matched_files=already_matched_files_preview)
    renames = {}
    for old_local_path, rename_info in all_renames.items():
        # Only include renames where files are within scope
        # Check if the old local path or new S3 path is within scope
        if sync_scope_prefix:
            new_s3_key = rename_info['new_s3_key']
            if new_s3_key.startswith(sync_scope_prefix):
                renames[old_local_path] = rename_info
        else:
            renames[old_local_path] = rename_info
    
    # Only consider orphaned local files within the sync scope
    orphaned_files = [p for p in local_files.keys() if p not in s3_files and p not in renames]
    
    # Track folder markers for preview (S3 folder markers)
    folder_markers = []
    for obj in s3_objects:
        key = obj['Key']
        if key.endswith('/') and obj.get('Size', 0) == 0:
            if sync_scope_prefix is None or key.startswith(sync_scope_prefix):
                folder_markers.append(key)
    
    # Determine if folders will be deleted
    # A folder is considered deleted when:
    # 1. All files in the folder are deleted (s3_files is empty and orphaned_files exist), OR
    # 2. Local folder exists but no S3 files for it
    folders_to_delete = []
    if len(s3_files) == 0 and len(orphaned_files) > 0:
        # We're deleting all files - the folder will effectively be deleted
        # Extract folder name from project_path
        if not is_file:
            folder_name = project_path.lstrip('/').lstrip('\\').split('/')[-1].split('\\')[-1]
            if folder_name:
                folders_to_delete.append(folder_name)
    
    # Determine if folders will be added
    # A folder is considered added when:
    # 1. We're syncing a directory (not a file)
    # 2. The directory doesn't exist locally (no local files, or all files are new downloads)
    # 3. We're downloading new files to that directory
    folders_to_add = []
    if not is_file and len(s3_files) > 0:
        # Check if this is a new folder (all files are new downloads, no local files)
        if len(local_files) == 0 and len(new_files) > 0:
            # No local files exist, and we have new files to download
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
            file_size = s3_files[file_path]['size']
            # For directories, include project path prefix; for files, project_path is the file itself
            if is_file:
                full_path = project_path
            else:
                full_path = f"{project_path}/{file_path}" if file_path else project_path
            preview_new_files.append({'path': full_path, 'size': file_size})
        
        preview_changed_files = []
        for file_path in changed_files:
            file_size = s3_files[file_path]['size']
            if is_file:
                full_path = project_path
            else:
                full_path = f"{project_path}/{file_path}" if file_path else project_path
            preview_changed_files.append({'path': full_path, 'size': file_size})
        
        preview_renames_list = []
        for old_local_path, rename_info in renames.items():
            old_filename = rename_info['old_filename']
            new_filename = rename_info['new_filename']
            similarity = rename_info['similarity']
            # For directories, include project path prefix; for files, project_path is the file itself
            if is_file:
                old_full = project_path
                new_full = project_path
            else:
                old_full = f"{project_path}/{old_filename}" if old_filename else project_path
                new_full = f"{project_path}/{new_filename}" if new_filename else project_path
            preview_renames_list.append({
                'old_path': old_full,
                'new_path': new_full,
                'old_filename': old_filename,
                'new_filename': new_filename,
                'similarity': similarity
            })
        
        preview_orphaned_files = []
        for file_path in orphaned_files:
            file_info = local_files[file_path]
            file_size = file_info['size']
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
            'renames': preview_renames_list,
            'orphaned_files': preview_orphaned_files,
            'folders_to_delete': preview_folders_to_delete,
            'folders_to_add': preview_folders_to_add,
            'bucket_name': bucket_name,
            's3_prefix': s3_prefix,
            'project_path': project_path
        }
    
    # Display counts
    print(f"   📥 New files to download: {len(new_files)}")
    if new_files:
        for file_path in sorted(new_files):
            file_size = s3_files[file_path]['size']
            print(f"      + {file_path} ({format_size(file_size)})")
    
    print(f"   🔄 Files to update: {len(changed_files)}")
    if changed_files:
        for file_path in sorted(changed_files):
            file_size = s3_files[file_path]['size']
            print(f"      ~ {file_path} ({format_size(file_size)})")
    
    print(f"   🔀 Files to rename: {len(renames)}")
    if renames:
        for old_local_path, rename_info in sorted(renames.items(), key=lambda x: x[0]):
            old_filename = rename_info['old_filename']
            new_filename = rename_info['new_filename']
            similarity = rename_info['similarity']
            print(f"      → {old_filename} → {new_filename} (similarity: {similarity:.2%})")
    
    print(f"   🗑️  Files to delete: {len(orphaned_files)}")
    if orphaned_files:
        for file_path in sorted(orphaned_files):
            # Get size from local file
            file_info = local_files[file_path]
            file_size = file_info['size']
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
    # - If --yes flag: Skip preview, skip confirmation, do actual sync immediately (except for deletions - always ask)
    # - Default (no flags): Show preview (dry-run), ask confirmation, if yes then do actual sync
    
    if dry_run:
        # --dry-run flag: Just show preview, no confirmation needed
        downloaded, updated, deleted, renamed, folders_deleted, folders_added, failed = sync_from_s3(
            s3_client, bucket_name, project_root, local_files, s3_objects, s3_prefix,
            local_base_path=local_path,
            force=force, dry_run=True, sync_scope_prefix=sync_scope_prefix
        )
    elif yes:
        # --yes flag: Skip preview and confirmation, do actual sync immediately
        # But deletions will still ask for confirmation (safety requirement)
        downloaded, updated, deleted, renamed, folders_deleted, folders_added, failed = sync_from_s3(
            s3_client, bucket_name, project_root, local_files, s3_objects, s3_prefix,
            local_base_path=local_path,
            force=force, dry_run=False, sync_scope_prefix=sync_scope_prefix
        )
    else:
        # Default: Show preview first (dry-run), then ask for confirmation
        if len(new_files) > 0 or len(changed_files) > 0 or len(orphaned_files) > 0 or len(renames) > 0 or len(folders_to_delete) > 0 or len(folders_to_add) > 0:
            print(f"\n{'=' * 70}")
            print("DRY RUN PREVIEW")
            print(f"{'=' * 70}")
            # Show preview
            sync_from_s3(
                s3_client, bucket_name, project_root, local_files, s3_objects, s3_prefix,
                local_base_path=local_path,
                force=force, dry_run=True, sync_scope_prefix=sync_scope_prefix
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
            downloaded, updated, deleted, renamed, folders_deleted, folders_added, failed = sync_from_s3(
                s3_client, bucket_name, project_root, local_files, s3_objects, s3_prefix,
                local_base_path=local_path,
                force=force, dry_run=False, sync_scope_prefix=sync_scope_prefix
            )
        else:
            # No changes, just show that
            print(f"\n✅ No changes needed for {project_path}")
            downloaded, updated, deleted, renamed, folders_deleted, folders_added, failed = 0, 0, 0, 0, 0, 0, 0
    
    if return_preview_info:
        return downloaded, updated, deleted, renamed, folders_deleted, folders_added, failed, preview_info
    return downloaded, updated, deleted, renamed, folders_deleted, folders_added, failed

def main():
    """Main download function."""
    parser = argparse.ArgumentParser(
        description='Download and sync files from S3 bucket to local filesystem',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Sync specific paths
  python scripts/aws/s3/sync_from_s3.py /Themes
  python scripts/aws/s3/sync_from_s3.py /index.html
  python scripts/aws/s3/sync_from_s3.py /Themes /css /index.html
  
  # Sync default paths (assets, css, phaserjs_editor_scripts_base, src, Themes, index.html, favicon.ico)
  python scripts/aws/s3/sync_from_s3.py
  
  # Dry-run to preview changes
  python scripts/aws/s3/sync_from_s3.py /Themes --dry-run
  
  # Force download all files (ignore hash checks)
  python scripts/aws/s3/sync_from_s3.py /Themes --force
  
  # Override bucket or prefix
  python scripts/aws/s3/sync_from_s3.py /Themes --bucket my-bucket
  python scripts/aws/s3/sync_from_s3.py /Themes --prefix custom-prefix/
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
        help='Preview changes without actually downloading/deleting'
    )
    parser.add_argument(
        '--yes', '-y',
        action='store_true',
        help='Skip dry-run preview and confirmation, proceed directly with download (deletions will still prompt for safety)'
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='Force download all files, ignoring hash checks'
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
    print("S3 BUCKET DOWNLOAD SYNC")
    print("=" * 70)
    print(f"Project root: {project_root}")
    print(f"Bucket: {args.bucket if args.bucket else BUCKET}")
    print(f"Region: {args.region}")
    print(f"S3 base prefix: {args.prefix if args.prefix else S3_PREFIX}")
    if args.dry_run:
        print(f"Mode: DRY RUN (preview only)")
    else:
        print(f"Mode: SYNC (will download/update/delete files)")
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
    total_downloaded = 0
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
        print(f"\n{'=' * 70}")
        print("PREVIEWING ALL PATHS")
        print(f"{'=' * 70}")
        
        all_preview_info = []
        for idx, path in enumerate(paths_to_sync, 1):
            print(f"\n{'=' * 70}")
            print(f"Path {idx}/{len(paths_to_sync)}: {path}")
            print(f"{'=' * 70}")
            
            # Just show preview, don't sync yet - but collect preview info
            result = sync_single_path(
                s3_client, project_root, path,
                bucket_override=args.bucket,
                prefix_override=args.prefix,
                region=args.region,
                force=args.force,
                dry_run=True,  # Always dry-run for preview
                yes=True,  # Skip confirmation in preview mode
                return_preview_info=True
            )
            if len(result) == 8:  # Includes preview_info
                downloaded, updated, deleted, renamed, folders_deleted, folders_added, failed, preview_info = result
                if preview_info:
                    all_preview_info.append(preview_info)
            else:
                downloaded, updated, deleted, renamed, folders_deleted, folders_added, failed = result
        
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
        all_renames = []
        all_orphaned_files = []
        all_folders_to_delete = []
        all_folders_to_add = []
        
        for preview_info in all_preview_info:
            if preview_info:
                all_new_files.extend(preview_info['new_files'])
                all_changed_files.extend(preview_info['changed_files'])
                all_renames.extend(preview_info['renames'])
                all_orphaned_files.extend(preview_info['orphaned_files'])
                all_folders_to_delete.extend(preview_info.get('folders_to_delete', []))
                all_folders_to_add.extend(preview_info.get('folders_to_add', []))
        
        # Display structured summary matching "Preview of changes" format
        print(f"\n📊 Preview of changes:")
        print(f"   📥 New files to download: {len(all_new_files)}")
        if all_new_files:
            for file_info in sorted(all_new_files, key=lambda x: x['path']):
                print(f"      + {file_info['path']} ({format_size(file_info['size'])})")
        
        print(f"   🔄 Files to update: {len(all_changed_files)}")
        if all_changed_files:
            for file_info in sorted(all_changed_files, key=lambda x: x['path']):
                print(f"      ~ {file_info['path']} ({format_size(file_info['size'])})")
        
        print(f"   🔀 Files to rename: {len(all_renames)}")
        if all_renames:
            for rename_info in sorted(all_renames, key=lambda x: x['old_path']):
                print(f"      → {rename_info['old_filename']} → {rename_info['new_filename']} (similarity: {rename_info['similarity']:.2%})")
        
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
        
        # Show bucket and prefix info
        print(f"\n🔄 Syncing S3 files to local directory: {project_root}")
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
            
            downloaded, updated, deleted, renamed, folders_deleted, folders_added, failed = sync_single_path(
                s3_client, project_root, path,
                bucket_override=args.bucket,
                prefix_override=args.prefix,
                region=args.region,
                force=args.force,
                dry_run=False,  # Actual sync
                yes=True  # Skip confirmation since we already confirmed (but deletions will still ask)
            )
            
            total_downloaded += downloaded
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
            
            downloaded, updated, deleted, renamed, folders_deleted, folders_added, failed = sync_single_path(
                s3_client, project_root, path,
                bucket_override=args.bucket,
                prefix_override=args.prefix,
                region=args.region,
                force=args.force,
                dry_run=args.dry_run,
                yes=args.yes
            )
            
            total_downloaded += downloaded
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
    print(f"✅ Files downloaded: {total_downloaded}")
    print(f"✅ Files updated: {total_updated}")
    if total_renamed > 0:
        print(f"✅ Files renamed: {total_renamed}")
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
        print("\n❌ Download cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

