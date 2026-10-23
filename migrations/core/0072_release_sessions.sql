-- SDK-005: observed sessions only. Raw session did/IP/user-agent are never retained.
CREATE TABLE project_identity_keys(project TEXT PRIMARY KEY,key TEXT NOT NULL CHECK(length(key)=64));
CREATE TABLE health_sessions(
 project TEXT NOT NULL,sid TEXT NOT NULL,release TEXT NOT NULL,environment TEXT NOT NULL,
 started INTEGER NOT NULL,updated INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN ('ok','exited','errored','crashed','abnormal','unhandled')),
 errors INTEGER NOT NULL,user_hash TEXT,PRIMARY KEY(project,sid)
);
CREATE INDEX health_sessions_window ON health_sessions(project,started,release,environment);
CREATE TABLE health_aggregates(
 project TEXT NOT NULL,release TEXT NOT NULL,environment TEXT NOT NULL,started INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('exited','errored','crashed','abnormal','unhandled')),quantity INTEGER NOT NULL CHECK(quantity>0 AND quantity<=1000000000),
 PRIMARY KEY(project,release,environment,started,status)
);
CREATE INDEX health_aggregates_window ON health_aggregates(project,started);
CREATE TRIGGER health_session_capacity BEFORE INSERT ON health_sessions WHEN NOT EXISTS(SELECT 1 FROM health_sessions WHERE project=NEW.project AND sid=NEW.sid) AND (SELECT COUNT(*) FROM health_sessions WHERE project=NEW.project)>=50000 BEGIN SELECT RAISE(ABORT,'session_capacity'); END;
CREATE TRIGGER health_aggregate_capacity BEFORE INSERT ON health_aggregates WHEN NOT EXISTS(SELECT 1 FROM health_aggregates WHERE project=NEW.project AND release=NEW.release AND environment=NEW.environment AND started=NEW.started AND status=NEW.status) AND (SELECT COUNT(*) FROM health_aggregates WHERE project=NEW.project)>=10000 BEGIN SELECT RAISE(ABORT,'session_capacity'); END;
CREATE TRIGGER health_aggregate_quantity BEFORE UPDATE ON health_aggregates WHEN NEW.quantity>1000000000 BEGIN SELECT RAISE(ABORT,'session_capacity'); END;
