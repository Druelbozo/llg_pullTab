"""
S3 Configuration
================

Shared configuration for S3 sync scripts.
Update these values to change the default bucket and prefix for all S3 operations.
"""

# Default S3 bucket name
BUCKET = 'llg-games'

# Default S3 prefix (path within bucket)
# All files will be synced to: s3://{BUCKET}/{S3_PREFIX}{path}/
S3_PREFIX = 'games/pull-tabs/'

