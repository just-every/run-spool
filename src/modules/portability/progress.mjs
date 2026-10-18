import { skippedTablesLine } from './bookkeeping.mjs';
// Human progress for a long export or import. The caller sends events; this turns
// them into at most one line every few seconds, with an estimate of the time left
// once a phase has two samples. The first and last line of every phase always show.
// Rates are bytes per second measured on a 1.2 GB local install on a loaded machine
// (export 1725 s, import 2234 s); a quiet machine is faster.
const RATES = { export: 700_000, import: 550_000 };
const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];
export function formatBytes(bytes) {
  let value = bytes, unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) { value /= 1000; unit++; }
  return `${unit && value < 100 ? value.toFixed(1) : Math.round(value)} ${UNITS[unit]}`;
}
export function formatDuration(seconds) {
  if (seconds < 45) return 'under a minute';
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes < 90 ? `about ${minutes} min` : `about ${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
const left = seconds => `, ${formatDuration(seconds)} left`;
export function transferProgress(report, { interval = 3000, now = () => performance.now() } = {}) {
  let phase, first, printed = -Infinity, expected;
  const line = event => {
    const bytes = event.bytes === undefined ? '' : ` (${formatBytes(event.bytes)}${event.phase === 'building' && expected ? ` of about ${formatBytes(expected)}` : ''})`;
    const parts = event.total === undefined ? `${event.parts} part${event.parts === 1 ? '' : 's'} so far` : `${event.parts} of ${event.total} parts`;
    // Seconds left, from the rate since the phase's first sample.
    const eta = () => {
      const seconds = (now() - first.time) / 1000;
      if (event === first.event || seconds <= 0 || event.parts === event.total) return '';
      if (event.total !== undefined && event.parts > first.event.parts) return left((event.total - event.parts) * seconds / (event.parts - first.event.parts));
      if (event.phase === 'building' && expected && event.bytes > first.event.bytes && event.bytes < expected) return left((expected - event.bytes) * seconds / (event.bytes - first.event.bytes));
      return '';
    };
    switch (event.phase) {
      case 'building': return `Building the archive: ${parts}${bytes}${eta()}.`;
      case 'writing': return `Writing the archive: ${parts}${bytes}${eta()}.`;
      case 'staging': return `Staging the restore: ${parts}${bytes}${eta()}.`;
      case 'checking': return event.direction === 'export' ? 'Checking the written archive.' : 'Checking the whole archive before anything is restored.';
      case 'finishing': return `All ${event.total} parts are staged; verifying them and publishing the restore. This can take several minutes.`;
    }
  };
  return event => {
    if (event.phase === 'skipped') { report(skippedTablesLine(event.tables)); return; }
    if (event.phase === 'start') {
      const noun = event.direction === 'export' ? `Exporting about ${formatBytes(event.bytes)} of local data` : `Restoring a ${formatBytes(event.bytes)} archive`;
      if (event.direction === 'export') expected = event.bytes;
      report(`${noun}. ${event.bytes / RATES[event.direction] < 45 ? 'This takes under a minute.' : `An archive this size usually takes ${formatDuration(event.bytes / RATES[event.direction])}; a busy machine takes longer. Progress follows every few seconds.`}`);
      printed = now();
      return;
    }
    const time = now(), edge = event.phase !== phase;
    if (edge) { phase = event.phase; first = { time, event }; }
    // A phase's last event (all parts built, written or staged) prints whatever the clock says.
    const last = event.total !== undefined && event.parts === event.total;
    if (edge || last || time - printed >= interval) { report(line(event)); printed = time; }
  };
}
