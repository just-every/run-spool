// Both Settings and Alerts describe the owner's same personal calendar digest.
// Keep their controls, but arbitrate the period in the existing durable queues.
export const ownerDigestEnabled = (project:string,kind:string) => `EXISTS(
 SELECT 1 FROM spool_personal_digest_settings d JOIN oa_operators o ON o.id=d.operator_id
 WHERE d.project=${project} AND d.historical=0 AND o.role='owner' AND o.status='active'
 AND CASE ${kind} WHEN 'daily' THEN d.daily ELSE d.weekly END=1)`;

export const personalDigestExists = (project:string,kind:string,period:string) => `EXISTS(
 SELECT 1 FROM spool_personal_mail p JOIN oa_operators o ON o.id=p.operator_id
 WHERE p.project=${project} AND o.role='owner' AND p.historical=0 AND p.state<>'canceled'
 AND p.type=${kind}||'_digest' AND p.source=p.type||':'||${period})`;

export const legacyDigestStarted = (mail='q') => `EXISTS(
 SELECT 1 FROM alert_scheduled_mail a JOIN oa_operators o ON o.id=${mail}.operator_id AND o.role='owner'
 WHERE a.project=${mail}.project AND a.scope='personal' AND a.historical=0
 AND a.kind||'_digest'=${mail}.type AND ${mail}.source=${mail}.type||':'||a.period
 AND a.state IN('running','accepted','uncertain'))`;
