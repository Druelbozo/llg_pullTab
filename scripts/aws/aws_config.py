"""
AWS Configuration
=================

Shared configuration for AWS scripts (S3 sync, CloudFront invalidation, etc.).
Update these values to change the default bucket and prefix for all AWS operations.
"""

# Default S3 bucket name
BUCKET = 'llg-games'

# Default S3 prefix (path within bucket)
# All files will be synced to: s3://{BUCKET}/{S3_PREFIX}/{path}/
S3_PREFIX = 'games/pull-tabs/'

