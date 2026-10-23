-- A declared build is immutable; late maps complete its original set.
CREATE TABLE source_map_builds(project TEXT NOT NULL REFERENCES projects(id),release TEXT NOT NULL,build TEXT NOT NULL,expected TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(project,release,build));
CREATE TABLE source_map_build_files(project TEXT NOT NULL REFERENCES projects(id),release TEXT NOT NULL,build TEXT NOT NULL,name TEXT NOT NULL,debug TEXT NOT NULL,digest TEXT NOT NULL,PRIMARY KEY(project,release,build,name));
