-- SDK-024: per-project monitor-slug connections to an Uptime heartbeat capability URL, and a
-- bounded trace link for check-ins. Neither table is archived: archives never carry a capability
-- URL, so a restored project starts with no connection and sends nothing until the owner
-- reconnects. Existing projects have no row, which means forwarding off.
CREATE TABLE checkin_routes (
 project TEXT NOT NULL,
 slug TEXT NOT NULL CHECK(length(slug) BETWEEN 1 AND 64),
 url TEXT NOT NULL CHECK(length(url) BETWEEN 1 AND 2048),
 enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
 revision INTEGER NOT NULL CHECK(revision>=1),
 updated INTEGER NOT NULL,
 PRIMARY KEY(project,slug)
);
CREATE TABLE checkin_links (
 project TEXT NOT NULL,
 check_in_id TEXT NOT NULL CHECK(length(check_in_id) BETWEEN 1 AND 64),
 trace_id TEXT NOT NULL CHECK(length(trace_id)=32),
 slug TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('in_progress','ok','error')),
 outcome TEXT NOT NULL,
 received INTEGER NOT NULL,
 PRIMARY KEY(project,check_in_id)
);
CREATE INDEX checkin_links_trace ON checkin_links(project,trace_id,received DESC);
