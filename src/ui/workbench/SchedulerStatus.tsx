import { useEffect, useState } from 'react';
import { date } from './shared';
// /health carries the scheduled handler's last run, so an idle cron is told apart from one that never runs.
export function SchedulerStatus() {
  const [lastRun, setLastRun] = useState<string | null | undefined>(undefined);
  useEffect(() => { void fetch('/health').then(response => response.json()).then((health: any) => setLastRun(health.alerts?.lastScheduledRun ?? null), () => setLastRun(undefined)); }, []);
  return <section className="evidence"><h2>Scheduled alert run</h2>
    <p role="status">{lastRun === undefined ? 'Checking…' : lastRun ? `Last ran ${date(Date.parse(lastRun))}.` : 'Has not run yet on this installation.'}</p>
    <p className="muted">New-issue and regression alerts are sent as soon as Spool admits the event. Spike alerts, delivery retries and anything still queued wait for this run, which is scheduled every minute.</p>
  </section>;
}
