export interface CaptureOutcomes { rows: { reason: string; count: number }[] }

export function captureStatus(outcomes: CaptureOutcomes | null, issues: { count: number }[]) {
  if (!outcomes) return { title: 'Checking for events', detail: 'Checking the last 24 hours.' };
  const accepted = outcomes.rows.some(row => row.reason === 'accepted' && row.count > 0);
  if (accepted) return { title: 'Capture is receiving events', detail: 'Events received in the last 24 hours.' };
  if (outcomes.rows.some(row => row.count > 0)) return { title: 'No events received in the last 24 hours', detail: 'Check capture receipts for the reason.' };
  if (issues.length) return { title: 'No recent events', detail: 'Earlier issues are still available.' };
  return { title: 'Waiting for your first event', detail: 'Connect your application and trigger an error. It will appear here automatically.' };
}
