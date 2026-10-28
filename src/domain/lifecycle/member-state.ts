// State transitions and archive decisions change this token; event counts do not.
export const memberStateSql=(alias='i')=>`json_array(${alias}.state,${alias}.resolved_seq,
 (SELECT COUNT(*) FROM issue_activity a WHERE a.project=${alias}.project AND a.issue=${alias}.id
 AND a.kind IN ('state','regression','resolution','suppression_started','suppression_expired')))`;
