-- Owner policy is distinct from expiry execution and never blocks erasure.
CREATE TABLE retention_policies(
 project TEXT NOT NULL UNIQUE,generation TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>0),
 windows TEXT NOT NULL,held INTEGER NOT NULL CHECK(held IN(0,1)),reason TEXT NOT NULL,updated INTEGER NOT NULL,
 PRIMARY KEY(project,generation)
);
