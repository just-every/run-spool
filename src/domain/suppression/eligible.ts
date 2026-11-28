// Same identity and native-client definition as SDK008 identities/read.ts.
export const affectedIdentitySql=`COALESCE(x.user_key,CASE WHEN json_extract(e.payload,'$.sentry') IS NULL AND json_extract(e.payload,'$.client') IS NOT NULL THEN 'native:'||json_extract(e.payload,'$.client') END)`;
export const userCountSql=(project:string,issue:string)=>`(SELECT COUNT(DISTINCT ${affectedIdentitySql}) FROM events e LEFT JOIN event_identities x ON x.project=e.project AND x.event=e.id AND x.occurrence=e.occurrence WHERE e.project=${project} AND e.issue=${issue})`;


// Whether an active suppression of issue_suppressions has met its condition at `time` (a SQL parameter).
export const suppressionEligible=(time:string)=>`CASE mode
   WHEN 'until' THEN deadline<=${time} WHEN 'snooze' THEN deadline<=${time}
   WHEN 'count' THEN observed_count>=occurrence_target
   WHEN 'users' THEN ${userCountSql('issue_suppressions.project','issue_suppressions.issue')}>=user_target
   WHEN 'escalating' THEN (SELECT COUNT(*) FROM events e WHERE e.project=issue_suppressions.project AND e.issue=issue_suppressions.issue AND e.received>${time}-window_ms AND e.received<=${time})>forecast
   ELSE 0 END`;
