"""
AWS Configuration
=================

Shared configuration for AWS scripts (S3 sync, CloudFront invalidation, etc.).
``CATEGORY`` drives both GameCatalog.category and the ``games/<CATEGORY>/`` S3 prefix.
Update ``BUCKET`` / ``CATEGORY`` to retarget deploy and catalog sync.
"""

# Default S3 bucket name
BUCKET = 'llg-games'

# Game type segment in S3 and GameCatalog.category
CATEGORY = 'pull-tabs'

# Default S3 prefix (path within bucket): games/<CATEGORY>/
# All files will be synced to: s3://{BUCKET}/{S3_PREFIX}{path}
S3_PREFIX = f'games/{CATEGORY}/'

# Default paths to sync when no arguments provided (raw source for editor)
DEFAULT_PATHS = [
    'assets',
    'phaserjs_editor_scripts_base',
    'js',
    'src',
    'index.html',
]

# Paths to sync for production (bundled build from dist/)
# Used with --from-dir dist when deploying production build
PRODUCTION_PATHS = [
    'index.html',
    'assets',
    'js',
    'src/config/themes',
    'src/config/game',
]

# File extensions to skip (never sync or delete from S3)
SKIP_EXTENSIONS = {
    '.psd'  # Photoshop files - never sync to S3
}
