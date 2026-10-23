export const slackHistoryTables = ['slack_delivery_meta'];
export function validateSlackHistory(data:any) {
 const seen=new Set<string>();
 for(const row of data.slack_delivery_meta??[]) {
  if(!row||Object.keys(row).sort().join()!=='delivery_id,message_id,project'||seen.has(row.delivery_id)||!data.alert_history.some((h:any)=>h.project===row.project&&h.id===row.delivery_id&&h.channel==='webhook')||(row.message_id!==null&&(typeof row.message_id!=='string'||!/^\d{1,16}\.\d{1,10}$/.test(row.message_id))))throw new Error('Archive Slack acknowledgment');
  seen.add(row.delivery_id);
 }
}
