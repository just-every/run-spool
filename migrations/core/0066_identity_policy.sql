-- SDK-008: explicit project choices; absence is drop for all four fields.
CREATE TABLE identity_policies(project TEXT NOT NULL UNIQUE,revision INTEGER NOT NULL,policy TEXT NOT NULL,updated INTEGER NOT NULL,PRIMARY KEY(project,revision));
CREATE TABLE event_identities(
 project TEXT NOT NULL,event TEXT NOT NULL,occurrence TEXT NOT NULL,payload TEXT NOT NULL,user_key TEXT,reason TEXT NOT NULL,
 PRIMARY KEY(project,event,occurrence),FOREIGN KEY(project,event) REFERENCES events(project,id) ON DELETE CASCADE
);
CREATE INDEX event_identities_users ON event_identities(project,user_key);
