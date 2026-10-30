export const legacyDigestStarted = (mail='q') => `EXISTS(
 SELECT 1 FROM alert_scheduled_mail a JOIN oa_operators o ON o.id=${mail}.operator_id AND o.role='owner'
 WHERE a.project=${mail}.project AND a.scope='personal' AND a.historical=0
 AND a.kind||'_digest'=${mail}.type AND ${mail}.source=${mail}.type||':'||a.period
 AND a.state IN('running','accepted','uncertain'))`;
