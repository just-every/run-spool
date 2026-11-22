-- Find the same native JavaScript location before and after debug-ID stamping.
CREATE INDEX event_stamp_grouping ON events (
  project, json_extract(payload,'$.type'), json_extract(payload,'$.frames[0].file'),
  json_extract(payload,'$.frames[0].function'), json_extract(payload,'$.frames[0].column'),
  json_extract(payload,'$.frames[0].line')
) WHERE historical=0 AND json_type(payload,'$.sentry') IS NULL AND json_type(payload,'$.language') IS NULL;
