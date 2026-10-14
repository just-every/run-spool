// A correction plan names an occurrence, not a reusable event ID. Applied and
// undone plans remain custody history; an unapplied preview establishes none.
// Callers supply SQL expressions, never request text.
export function correctionMembership(event: string, issue: string, since?: string) {
 return `EXISTS(SELECT 1 FROM grouping_corrections c,json_each(c.plan,'$.moves') m
  WHERE c.project=${event}.project AND c.state IN ('applied','undone')
   AND json_extract(m.value,'$.event')=${event}.id
   AND json_extract(m.value,'$.occurrence')=${event}.occurrence
   AND ${issue} IN (json_extract(m.value,'$.from'),json_extract(m.value,'$.to'))
   ${since ? `AND EXISTS(SELECT 1 FROM audit a WHERE a.project=c.project AND a.kind IN ('grouping_applied','grouping_undone') AND json_extract(a.detail,'$.correction')=c.id AND a.created>=${since})` : ''})`;
}

export function originalMembership(event: string, issue: string) {
 return `EXISTS(SELECT 1 FROM event_grouping g WHERE g.project=${event}.project
  AND g.event=${event}.id AND g.occurrence=${event}.occurrence AND g.original_issue=${issue})`;
}
