import { useEffect, useState } from 'react';
import { date } from './shared';
// /health carries the scheduled handler's last run, so an idle cron is told apart from one that never runs.
export function SchedulerStatus() {
  const [lastRun, setLastRun] = useState<string | null | undefined>(undefined);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let next: ReturnType<typeof setTimeout>;
    async function check() {
      try {
        const response = await fetch('/health', { signal: controller.signal });
        if (!response.ok) throw new Error('Health unavailable');
        const health = await response.json() as { alerts: { lastScheduledRun: string | null } };
        setLastRun(health.alerts.lastScheduledRun);
        setUnavailable(false);
        if (!health.alerts.lastScheduledRun) next = setTimeout(check, 60_000);
      } catch {
        if (!controller.signal.aborted) {
          setUnavailable(true);
          next = setTimeout(check, 60_000);
        }
      }
    }
    void check();
    return () => { controller.abort(); clearTimeout(next); };
  }, []);
  return <section className="evidence"><h2>Scheduled alert run</h2>
    <p role="status">{unavailable ? 'Scheduled run status unavailable.' : lastRun === undefined ? 'Checking…' : lastRun ? `Last ran ${date(Date.parse(lastRun))}.` : 'Waiting for first scheduled run.'}</p>
    <p className="muted">New-issue and regression alerts send on capture. Snooze expiry notices, digests, spike alerts and delivery retries use the minute schedule.</p>
  </section>;
}
