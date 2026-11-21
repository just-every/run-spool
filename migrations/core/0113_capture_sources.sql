-- Short-lived, payload-free receipt counters for the Capture connection status.
CREATE TABLE capture_sources (
 project TEXT NOT NULL REFERENCES projects(id),
 window INTEGER NOT NULL,
 origin TEXT NOT NULL,
 count INTEGER NOT NULL,
 PRIMARY KEY(project,window,origin)
);
