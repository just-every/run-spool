-- Owner policy is distinct from expiry execution and never blocks erasure.
CREATE TABLE retention_policies(
 project TEXT NOT NULL UNIQUE,generation TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>0),
 windows TEXT NOT NULL,held INTEGER NOT NULL CHECK(held IN(0,1)),reason TEXT NOT NULL,updated INTEGER NOT NULL,
 PRIMARY KEY(project,generation)
);
-- Preserve the existing SDK intake and its budgets. Its opportunistic session
-- cleanup is expiry too: held rows survive that cleanup, while erasure and
-- validated restore retain their own independent authority.
CREATE TRIGGER retention_held_session_expiry BEFORE DELETE ON health_sessions
WHEN EXISTS(SELECT 1 FROM retention_policies WHERE project=OLD.project AND held=1)
 AND EXISTS(SELECT 1 FROM audit_context WHERE slot=1 AND action='capture.sentry')
BEGIN SELECT RAISE(IGNORE); END;
CREATE TRIGGER retention_held_aggregate_expiry BEFORE DELETE ON health_aggregates
WHEN EXISTS(SELECT 1 FROM retention_policies WHERE project=OLD.project AND held=1)
 AND EXISTS(SELECT 1 FROM audit_context WHERE slot=1 AND action='capture.sentry')
BEGIN SELECT RAISE(IGNORE); END;
