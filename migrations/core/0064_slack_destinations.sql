-- ALERT-002: private reconnect-only Slack configuration, plus safe historical acknowledgment.
CREATE TABLE slack_destinations (
 id TEXT PRIMARY KEY,
 project TEXT NOT NULL,
 label TEXT NOT NULL CHECK(length(label) BETWEEN 1 AND 100),
 channel_id TEXT NOT NULL CHECK(length(channel_id) BETWEEN 1 AND 100),
 bot_token TEXT NOT NULL CHECK(length(bot_token) BETWEEN 16 AND 512),
 created INTEGER NOT NULL
);
CREATE INDEX slack_destinations_project ON slack_destinations(project);
CREATE TRIGGER slack_destination_capacity BEFORE INSERT ON slack_destinations WHEN (SELECT COUNT(*) FROM slack_destinations WHERE project=NEW.project)>=20 BEGIN SELECT RAISE(ABORT,'slack_destination_budget'); END;
CREATE TABLE slack_delivery_meta (
 project TEXT NOT NULL,
 delivery_id TEXT NOT NULL PRIMARY KEY,
 message_id TEXT
);
