-- Definitions only: every read recomputes the currently retained evidence.
CREATE TABLE spool_reporting_items (
 id TEXT PRIMARY KEY,
 organization TEXT REFERENCES spool_organizations(id),
 kind TEXT NOT NULL CHECK(kind IN ('dashboard','table','report')),
 name TEXT NOT NULL,
 author TEXT,
 revision INTEGER NOT NULL CHECK(revision>0),
 created INTEGER NOT NULL,
 updated INTEGER NOT NULL
);
CREATE INDEX spool_reporting_items_org ON spool_reporting_items(organization,updated,id);
CREATE TABLE spool_reporting_projects (
 item TEXT NOT NULL REFERENCES spool_reporting_items(id) ON DELETE CASCADE,
 project TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 PRIMARY KEY(item,project)
);
CREATE TABLE spool_reporting_widgets (
 item TEXT NOT NULL REFERENCES spool_reporting_items(id) ON DELETE CASCADE,
 id TEXT NOT NULL,
 project TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 position INTEGER NOT NULL CHECK(position>=0 AND position<12),
 name TEXT NOT NULL,
 config TEXT NOT NULL,
 view_id TEXT,
 PRIMARY KEY(item,id),
 UNIQUE(item,position),
 FOREIGN KEY(item,project) REFERENCES spool_reporting_projects(item,project) ON DELETE CASCADE,
 CHECK(json_valid(config))
);
CREATE INDEX spool_reporting_widgets_project ON spool_reporting_widgets(project,item);
CREATE TABLE spool_reporting_shares (
 item TEXT NOT NULL REFERENCES spool_reporting_items(id) ON DELETE CASCADE,
 id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('team','role')),
 target TEXT NOT NULL,
 active INTEGER NOT NULL CHECK(active IN (0,1)),
 created INTEGER NOT NULL,
 PRIMARY KEY(item,id),
 UNIQUE(item,kind,target)
);
CREATE TRIGGER spool_reporting_capacity BEFORE INSERT ON spool_reporting_items
 WHEN (SELECT COUNT(*) FROM spool_reporting_items WHERE organization IS NEW.organization AND kind=NEW.kind)>=25
 BEGIN SELECT RAISE(ABORT,'reporting_item_capacity'); END;
CREATE TRIGGER spool_reporting_move_capacity BEFORE UPDATE OF organization,kind ON spool_reporting_items
 WHEN (NEW.organization IS NOT OLD.organization OR NEW.kind<>OLD.kind)
 AND (SELECT COUNT(*) FROM spool_reporting_items WHERE organization IS NEW.organization AND kind=NEW.kind AND id<>OLD.id)>=25
 BEGIN SELECT RAISE(ABORT,'reporting_item_capacity'); END;
CREATE TRIGGER spool_reporting_widget_capacity BEFORE INSERT ON spool_reporting_widgets
 WHEN (SELECT COUNT(*) FROM spool_reporting_widgets WHERE item=NEW.item)>=12
 BEGIN SELECT RAISE(ABORT,'reporting_widget_capacity'); END;
-- A saved table is only metadata referring to the existing review view store.
CREATE TRIGGER spool_reporting_view_removed AFTER DELETE ON review_views BEGIN
 DELETE FROM spool_reporting_widgets WHERE project=OLD.project AND view_id=OLD.id;
END;
