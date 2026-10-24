-- Review stores an alert boundary, never an owner identity or issue mutation.
CREATE TABLE review_stamps(project TEXT NOT NULL,issue TEXT NOT NULL,generation TEXT NOT NULL,alert TEXT NOT NULL,reviewed INTEGER NOT NULL,UNIQUE(project,issue),PRIMARY KEY(project,issue,generation));
CREATE TABLE review_views(project TEXT NOT NULL,id TEXT NOT NULL,generation TEXT NOT NULL,query TEXT NOT NULL,UNIQUE(project,id),PRIMARY KEY(project,id,generation));
CREATE TRIGGER review_view_capacity BEFORE INSERT ON review_views WHEN NOT EXISTS(SELECT 1 FROM review_views WHERE project=NEW.project AND id=NEW.id) AND (SELECT COUNT(*) FROM review_views WHERE project=NEW.project)>=25 BEGIN SELECT RAISE(ABORT,'review_view_capacity'); END;
