-- Keep populated notice rows and their released schema unchanged. This
-- operational metadata never restores as runnable work or a recipient receipt.
CREATE TABLE follow_up_notice_meta (
 notice TEXT PRIMARY KEY REFERENCES follow_up_notices(id),
 project TEXT NOT NULL REFERENCES projects(id),
 provider TEXT NOT NULL CHECK(provider='slack'),
 message_id TEXT
);
