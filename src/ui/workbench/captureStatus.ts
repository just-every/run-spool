export interface CaptureOutcomes { rows: { reason: string; count: number }[] }

export function captureStatus(outcomes: CaptureOutcomes | null, issues: { count: number }[]) {
  if (!outcomes) return { title: 'Checking capture receipts', detail: 'Loading the project’s recorded capture outcomes.' };
  const accepted = outcomes.rows.some(row => row.reason === 'accepted' && row.count > 0);
  if (accepted) return { title: 'Capture is receiving events', detail: 'Spool accepted events in the last 24 hours. Open an issue to inspect the received stack and triage it.' };
  if (outcomes.rows.some(row => row.count > 0)) return { title: 'No accepted event in this window', detail: 'Spool recorded capture receipts, but no accepted events in the last 24 hours. Review the capture receipts for the recorded reasons and next steps.' };
  if (issues.length) return { title: 'No recent accepted events', detail: 'Earlier issues are available. No capture receipts are recorded in the last 24 hours.' };
  return { title: 'Waiting for your first accepted event', detail: 'Finish these steps, trigger an error in your application, then check for events.' };
}
