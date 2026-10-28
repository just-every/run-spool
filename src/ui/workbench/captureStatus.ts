export interface CaptureOutcomes { captureKeys: { active: number; stopped: number; revoked: number }; rows: { reason: string; count: number }[] }

export function captureStatus(outcomes: CaptureOutcomes | null, issues: { count: number }[]) {
  if (!outcomes) return { title: 'Checking for events', detail: 'Checking the last 24 hours.' };
  const keys = outcomes.captureKeys;
  if (!keys.active) return { title: 'Capture is stopped', detail: 'No active capture keys. Create a capture key in Settings to receive new events. Earlier capture receipts remain available.' };
  const stopped = keys.stopped + keys.revoked;
  const credentialDetail = stopped ? ` ${stopped} capture ${stopped === 1 ? 'key is' : 'keys are'} stopped; only active keys can send new events.` : '';
  const accepted = outcomes.rows.some(row => row.reason === 'accepted' && row.count > 0);
  if (accepted) return { title: 'Capture is receiving events', detail: 'Events received in the last 24 hours.' + credentialDetail };
  if (outcomes.rows.some(row => row.count > 0)) return { title: 'No events received in the last 24 hours', detail: 'Check capture receipts for the reason.' + credentialDetail };
  if (issues.length) return { title: 'No recent events', detail: 'Earlier issues are still available.' + credentialDetail };
  return { title: 'Waiting for your first event', detail: 'Connect your application and trigger an error. It will appear here automatically.' + credentialDetail };
}
