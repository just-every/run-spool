export interface CaptureOutcomes {
 captureKeys?: { total: number; active: number };
 rows: { reason: string; count: number }[];
 recentCapture?: { count: number; sources: { origin: string | null; count: number }[] };
}

export function captureStatus(outcomes: CaptureOutcomes | null, issues: { count: number }[]) {
 if (!outcomes) return { title: 'Checking for events', detail: 'Checking the last hour.' };
 if (outcomes.captureKeys && outcomes.captureKeys.total > 0 && outcomes.captureKeys.active === 0) return { title: 'Capture credentials stopped', detail: 'No active capture key remains. Create a capture key in Settings and update your application.' };
 const recent = outcomes.recentCapture;
 if (recent?.count) {
  const sources = recent.sources.map(row => `${row.count} from ${row.origin ?? 'requests without a website address'}`);
  const recorded = recent.sources.reduce((total, row) => total + row.count, 0);
  if (recorded < recent.count) sources.push(`${recent.count - recorded} with no recorded website address`);
  return { title: 'Capture is receiving events', detail: `${recent.count} ${recent.count === 1 ? 'event' : 'events'} in the last hour: ${sources.join('; ')}.` };
 }
 if (outcomes.rows.some(row => row.count > 0)) return { title: 'No events received in the last hour', detail: 'Check capture receipts for earlier events or rejected requests.' };
 if (issues.length) return { title: 'No recent events', detail: 'Earlier issues are still available.' };
 return { title: 'Waiting for your first event', detail: 'Connect your application and trigger an error. It will appear here automatically.' };
}
