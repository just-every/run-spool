// Project keys belong to the person whose session minted them. They count only while that
// person is active at the identity fence (oa_operators.version) recorded at minting: a fence from the
// linked Auth install or a suspension moves the version, so they never count again.
// A guarded owner transfer advances only live bindings across its role changes;
// restoring a person never brings back an earlier credential. SQL condition for a `credentials` lookup.
export const mintedByCurrentPerson = `(credentials.minted_by IS NULL AND credentials.kind='ingest' OR EXISTS(
 SELECT 1 FROM oa_operators o WHERE o.id=credentials.minted_by AND o.version=credentials.minted_version AND o.status='active'
 AND (o.role='owner' OR EXISTS(SELECT 1 FROM spool_members m JOIN spool_project_teams t ON t.organization=m.organization AND t.project=credentials.project
  WHERE m.operator_id=o.id AND m.state='active' AND (m.role='admin' OR m.role='member' AND EXISTS(
   SELECT 1 FROM spool_project_grants g WHERE g.member=m.id AND g.project=credentials.project AND g.role IN ('maintainer','member'))))))
 AND NOT EXISTS(SELECT 1 FROM spool_service_credentials link WHERE link.hash=credentials.hash AND NOT EXISTS(
  SELECT 1 FROM spool_service_accounts a JOIN spool_service_scopes scope ON scope.service=a.id
  JOIN spool_project_teams t ON t.project=scope.project AND t.organization=a.organization
  WHERE a.id=link.service AND a.version=link.version AND a.state='active' AND a.sponsor=credentials.minted_by
   AND scope.project=credentials.project AND scope.kind=credentials.kind)))`;
