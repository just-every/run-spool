CREATE TABLE alert_rule_configs(rule_id TEXT PRIMARY KEY,project TEXT NOT NULL,revision INTEGER NOT NULL,config TEXT NOT NULL);
CREATE TABLE alert_rule_previews(id TEXT PRIMARY KEY,project TEXT NOT NULL,rule_id TEXT,digest TEXT NOT NULL,policy_revision INTEGER NOT NULL,created INTEGER NOT NULL);
CREATE INDEX alert_rule_previews_project ON alert_rule_previews(project,created);
CREATE TABLE alert_decisions(id TEXT PRIMARY KEY,project TEXT NOT NULL,rule_id TEXT NOT NULL,revision INTEGER NOT NULL,issue TEXT NOT NULL,start INTEGER NOT NULL,end INTEGER NOT NULL,fired INTEGER NOT NULL,reason TEXT NOT NULL,UNIQUE(rule_id,revision,issue,start));
CREATE INDEX alert_decisions_project ON alert_decisions(project,end);
CREATE TABLE alert_reactivation_markers(project TEXT NOT NULL,issue TEXT NOT NULL,revision INTEGER NOT NULL,PRIMARY KEY(project,issue));
