-- Older cached keys included build metadata and did not preserve every semver
-- prerelease ordering. Runtime reindexes keys before reading/comparing releases.
UPDATE release_metadata SET version_key=NULL;
