-- Preserve applied 0001 history; make the artifact budget a transaction constraint.
CREATE TRIGGER artifact_capacity BEFORE INSERT ON artifacts WHEN (SELECT COUNT(*) FROM artifacts WHERE project=NEW.project)>=20 BEGIN SELECT RAISE(ABORT,'artifact_budget'); END;
