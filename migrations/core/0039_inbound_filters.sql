-- Missing rows deliberately mean the published default policy at revision 0:
-- browser extensions and known crawlers on; all other filters off.
CREATE TABLE inbound_filter_policies (
 project TEXT PRIMARY KEY NOT NULL REFERENCES projects(id),
 revision INTEGER NOT NULL CHECK(revision>0),
 policy TEXT NOT NULL CHECK(json_valid(policy) AND length(policy)<=65536),
 updated INTEGER NOT NULL CHECK(updated>=0)
);
CREATE TRIGGER portability_inbound_filter_policies_insert BEFORE INSERT ON inbound_filter_policies WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_inbound_filter_policies_update BEFORE UPDATE ON inbound_filter_policies WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_inbound_filter_policies_delete BEFORE DELETE ON inbound_filter_policies WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
