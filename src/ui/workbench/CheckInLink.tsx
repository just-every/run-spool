import { date } from './shared';

// The only link the SDK data carries: the occurrence and the check-in share a trace id.
export function CheckInLink({ checkIns }: { checkIns?: { monitor: string; status: string; checkInId: string; received: number }[] }) {
 if (!checkIns?.length) return null;
 return <section aria-label="Cron check-ins on this trace"><h3>Cron check-ins on this trace</h3>
  <p className="muted">This occurrence shares its trace id with these check-ins. The SDK sends no other link.</p>
  <ul>{checkIns.map(row => <li key={row.checkInId}><strong>{row.monitor}</strong> · {row.status.replace('_', ' ')} · <code>{row.checkInId}</code> · {date(row.received)}</li>)}</ul></section>;
}
