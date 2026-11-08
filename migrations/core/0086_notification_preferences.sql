CREATE TABLE spool_notification_preferences (
 project TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 actor_label TEXT NOT NULL,
 operator_id TEXT,
 email TEXT NOT NULL CHECK(json_valid(email)),
 revision INTEGER NOT NULL CHECK(revision>=1),
 updated INTEGER NOT NULL,
 historical INTEGER NOT NULL DEFAULT 0 CHECK(historical IN (0,1)),
 PRIMARY KEY(project,actor_label),
 CHECK(historical=1 OR operator_id IS NOT NULL)
);
CREATE UNIQUE INDEX spool_notification_preferences_person ON spool_notification_preferences(project,operator_id) WHERE historical=0;
