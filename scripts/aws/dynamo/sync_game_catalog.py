#!/usr/bin/env python3
"""
GameCatalog Sync Script: Sync game config files to DynamoDB GameCatalog table
============================================================================

Reads game config files from src/config/game, converts them to GameCatalog
entries, and adds/updates them in the DynamoDB GameCatalog table.
``category``, launch ``url``, and thumbnail ``imageUrl`` / ``videoUrl`` bases use
``CATEGORY`` from ``aws_config.py`` (same segment as ``S3_PREFIX``,
``games/<CATEGORY>/``).

USAGE:
    python scripts/aws/dynamo/sync_game_catalog.py [--dry-run] [--region us-east-1] [--yes]

    Examples:
    # Dry run (build entries, print JSON, do not write to DynamoDB)
    python scripts/aws/dynamo/sync_game_catalog.py --dry-run

    # Sync to DynamoDB
    python scripts/aws/dynamo/sync_game_catalog.py --yes
"""

import sys
import json
import copy
import subprocess
import argparse
from pathlib import Path
from datetime import datetime
from decimal import Decimal

# Add project root for imports
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import boto3
from botocore.exceptions import ClientError

# Import catalog category from aws_config (S3 uses S3_PREFIX = games/<CATEGORY>/)
sys.path.insert(0, str(SCRIPT_DIR.parent))
from aws_config import CATEGORY

# Import SSO authentication utility
from sso.aws_sso_auth import ensure_sso_authenticated, get_boto3_session

# Fix Windows console encoding for emoji support
if sys.platform == 'win32':
    try:
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8')
        if hasattr(sys.stderr, 'reconfigure'):
            sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

CONFIG_DIR = PROJECT_ROOT / 'src' / 'config' / 'game'
THUMBNAILS_DIR = PROJECT_ROOT / 'assets' / 'images' / 'thumbnails'
PLAY_BASE = 'https://play.luckyladygames.com'
BASE_URL = f'{PLAY_BASE}/games/{CATEGORY}/assets/images/thumbnails/'
GAME_URL = f'{PLAY_BASE}/games/{CATEGORY}/'


def discover_config_files():
    """Discover game config files, excluding game-config.js and archive/."""
    configs = []
    for f in CONFIG_DIR.rglob('*.js'):
        if f.name == 'game-config.js':
            continue
        if 'archive' in f.parts:
            continue
        game_id = f.stem
        configs.append((game_id, f))
    return sorted(configs, key=lambda x: x[0])


def load_config(game_id):
    """Load config via Node subprocess. Returns dict or None."""
    try:
        result = subprocess.run(
            ['node', str(SCRIPT_DIR / 'load_config.mjs'), game_id],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode != 0:
            print(f"   Warning: Failed to load config for {game_id}: {result.stderr}")
            return None
        return json.loads(result.stdout.strip())
    except subprocess.TimeoutExpired:
        print(f"   Warning: Timeout loading config for {game_id}")
        return None
    except json.JSONDecodeError as e:
        print(f"   Warning: Invalid JSON from config {game_id}: {e}")
        return None


def game_id_to_title(game_id):
    """Convert gameId to Title Case (e.g. jacks-or-better -> Jacks Or Better)."""
    return ' '.join(word.capitalize() for word in game_id.split('-'))


def find_thumbnail(game_id, extension):
    """Find first file in thumbnails dir whose name starts with game_id and has given extension."""
    if not THUMBNAILS_DIR.exists():
        return None
    prefix = game_id.lower()
    ext = extension.lower() if extension.startswith('.') else f'.{extension}'
    for f in THUMBNAILS_DIR.iterdir():
        if f.is_file() and f.name.lower().startswith(prefix) and f.suffix.lower() == ext:
            return f.name
    return None


def convert_decimal(obj):
    """Convert DynamoDB Decimal types to native Python types."""
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    if isinstance(obj, dict):
        return {k: convert_decimal(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [convert_decimal(v) for v in obj]
    return obj


def get_existing_item(dynamodb, table_name, game_id):
    """Fetch existing GameCatalog item by gameId. Returns None if not found."""
    try:
        table = dynamodb.Table(table_name)
        response = table.get_item(Key={'gameId': game_id})
        item = response.get('Item')
        if item is None:
            return None
        return convert_decimal(item)
    except ClientError:
        return None


# Schema defaults for migration (add missing fields to legacy entries only)
SCHEMA_DEFAULTS = {
    'co-branded': False,
    'isActive': False,
}


def _thumbnail_urls(game_id):
    """Get imageUrl and videoUrl from thumbnails dir."""
    png_name = find_thumbnail(game_id, '.png')
    if png_name:
        image_url = BASE_URL + png_name
    else:
        print(f"   Warning: No thumbnail found for {game_id}, using placeholder")
        image_url = BASE_URL + f'{game_id}.png'
    mp4_name = find_thumbnail(game_id, '.mp4')
    video_url = (BASE_URL + mp4_name) if mp4_name else None
    return image_url, video_url


def build_new_entry(game_id, config):
    """Build a full GameCatalog entry for a new game."""
    metadata = dict(config)
    title = game_id_to_title(game_id)
    image_url, video_url = _thumbnail_urls(game_id)
    now = int(datetime.now().timestamp())

    entry = {
        'metadata': metadata,
        'productType': 'casino',
        'rules': '',
        'url': GAME_URL,
        'rtp': 0,
        'providerId': 'LLG',
        'volatility': 1,
        'locales': ['en'],
        'level': 1,
        'brandId': 'LLG',
        'tags': [],
        'gameId': game_id,
        'category': CATEGORY,
        'title': title,
        'descriptionShort': title,
        'descriptionLong': title,
        'imageUrl': image_url,
        'createdAt': now,
        'updatedAt': now,
        'co-branded': False,
        'isActive': False,
    }
    if video_url:
        entry['videoUrl'] = video_url
    return entry


def build_update_entry(game_id, config, existing_db_item):
    """Build update for existing entry: only metadata, imageUrl, videoUrl; add missing schema fields."""
    entry = copy.deepcopy(existing_db_item)

    # Overwrite syncable fields only
    entry['metadata'] = dict(config)
    entry['category'] = CATEGORY
    entry['url'] = GAME_URL
    entry['imageUrl'], video_url = _thumbnail_urls(game_id)
    entry['updatedAt'] = int(datetime.now().timestamp())
    if video_url:
        entry['videoUrl'] = video_url
    elif 'videoUrl' in entry:
        del entry['videoUrl']  # Remove if no longer present in thumbnails

    # Schema migration: add missing fields with defaults (do not overwrite if key exists)
    for key, default in SCHEMA_DEFAULTS.items():
        if key not in entry:
            entry[key] = default

    return entry


def get_dynamodb_resource(region='us-east-1'):
    """Get DynamoDB resource using AWS SSO authentication."""
    if not ensure_sso_authenticated():
        print("❌ Error: Failed to authenticate with AWS SSO")
        return None

    try:
        session = get_boto3_session()
        return session.resource('dynamodb', region_name=region)
    except Exception as e:
        print(f"Error connecting to DynamoDB: {e}")
        return None


def put_item(dynamodb, table_name, item, region='us-east-1'):
    """Put item to DynamoDB. Converts Python types for DynamoDB."""

    def convert_for_dynamodb(obj):
        if isinstance(obj, dict):
            return {k: convert_for_dynamodb(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [convert_for_dynamodb(v) for v in obj]
        elif isinstance(obj, float):
            return Decimal(str(obj))
        elif isinstance(obj, int) and not isinstance(obj, bool):
            return obj
        return obj

    try:
        table = dynamodb.Table(table_name)
        dynamo_item = convert_for_dynamodb(item)
        table.put_item(Item=dynamo_item)
        return True
    except ClientError as e:
        print(f"   Error putting {item.get('gameId', '?')}: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description='Sync game config files to DynamoDB GameCatalog table',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument('--dry-run', action='store_true', help='Build entries and print JSON, do not write to DynamoDB')
    parser.add_argument('--region', default='us-east-1', help='AWS region (default: us-east-1)')
    parser.add_argument('--yes', '-y', action='store_true', help='Skip confirmation prompt')
    args = parser.parse_args()

    print("=" * 70)
    print(f"GAMECATALOG SYNC ({CATEGORY})")
    print("=" * 70)
    print(f"Config dir: {CONFIG_DIR}")
    print(f"Thumbnails: {THUMBNAILS_DIR}")
    print(f"Category: {CATEGORY}")
    print(f"Base URL: {BASE_URL}")
    print(f"Game URL: {GAME_URL}")
    if args.dry_run:
        print("Mode: DRY RUN (no DynamoDB writes)")
    else:
        print("Mode: SYNC (will write to DynamoDB)")
    print()

    # Discover configs
    configs = discover_config_files()
    print(f"Found {len(configs)} game config(s)")
    if not configs:
        print("No config files to sync.")
        return False

    # Connect to DynamoDB (needed for both dry-run and sync to fetch existing entries)
    dynamodb = get_dynamodb_resource(args.region)
    if not dynamodb:
        return False

    # Build entries: for each game, fetch existing from DB and build new or update entry
    entries = []
    for game_id, _ in configs:
        config = load_config(game_id)
        if config is None:
            print(f"   Skipping {game_id} (failed to load config)")
            continue
        existing = get_existing_item(dynamodb, 'GameCatalog', game_id)
        if existing is None:
            entry = build_new_entry(game_id, config)
        else:
            entry = build_update_entry(game_id, config, existing)
        entries.append(entry)

    print(f"Built {len(entries)} entries")
    print()

    if args.dry_run:
        print("Dry run - entries (first 2):")
        for i, e in enumerate(entries[:2]):
            print(json.dumps(e, indent=2, default=str))
        if len(entries) > 2:
            print(f"... and {len(entries) - 2} more")
        return True

    # Confirmation
    if not args.yes:
        try:
            response = input(f"Sync {len(entries)} entries to GameCatalog? (yes/no): ").strip().lower()
            if response not in ['yes', 'y']:
                print("Sync cancelled.")
                return False
        except (KeyboardInterrupt, EOFError):
            print("\nSync cancelled.")
            return False
    else:
        print("Skipping confirmation (--yes flag set)")

    success = 0
    failed = 0
    for i, entry in enumerate(entries, 1):
        game_id = entry['gameId']
        if put_item(dynamodb, 'GameCatalog', entry, args.region):
            success += 1
            print(f"   [{i}/{len(entries)}] OK: {game_id}")
        else:
            failed += 1
            print(f"   [{i}/{len(entries)}] FAILED: {game_id}")

    print()
    print("=" * 70)
    if failed == 0:
        print("SYNC COMPLETED SUCCESSFULLY")
    else:
        print(f"SYNC COMPLETED WITH {failed} FAILURE(S)")
    print("=" * 70)
    print(f"Success: {success}/{len(entries)}")
    print()

    return failed == 0


if __name__ == '__main__':
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\nSync cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
