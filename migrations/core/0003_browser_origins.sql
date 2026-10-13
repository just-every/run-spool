-- Additive: existing projects have no permitted foreign browser origins.
CREATE TABLE browser_origins(project TEXT NOT NULL REFERENCES projects(id),origin TEXT NOT NULL CHECK(length(origin)>0 AND length(origin)<=1024),created INTEGER NOT NULL,PRIMARY KEY(project,origin));
CREATE TRIGGER browser_origin_capacity BEFORE INSERT ON browser_origins WHEN NOT EXISTS(SELECT 1 FROM browser_origins WHERE project=NEW.project AND origin=NEW.origin) AND (SELECT COUNT(*) FROM browser_origins WHERE project=NEW.project)>=20 BEGIN SELECT RAISE(ABORT,'browser_origin_budget'); END;
-- Ephemeral transaction guard: successful admission inserts and deletes its tuple in one batch.
-- The composite FK aborts admission if origin membership was removed before its transaction.
CREATE TABLE browser_origin_guards(id TEXT PRIMARY KEY,project TEXT NOT NULL,origin TEXT NOT NULL,FOREIGN KEY(project,origin) REFERENCES browser_origins(project,origin));
