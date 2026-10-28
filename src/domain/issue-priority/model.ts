export const priorities=['high','medium','low'] as const;
export const prioritySql=(alias='i')=>`COALESCE((SELECT COALESCE(p.manual,CASE p.automatic WHEN 3 THEN 'high' WHEN 2 THEN 'medium' ELSE 'low' END) FROM issue_priorities p WHERE p.project=${alias}.project AND p.issue=${alias}.id),'high')`;
