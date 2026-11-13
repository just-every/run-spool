import { skippedTablesLine } from './bookkeeping.mjs';
// Human progress for a long export or import. The caller sends events; this turns
// them into at most one line every few seconds, with an estimate of the time left
// once a phase has two samples and a known total. The first and last line of every
// phase always show. Local disk allocation includes free pages and transient state;
// it cannot predict archive bytes or building time.
// Import rate measured on a 1.2 GB archive on a loaded machine (2234 s).
const IMPORT_RATE = 550_000;
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
  let phase, first, printed = -Infinity;
  const line = event => {
    const bytes = event.bytes === undefined ? '' : ` (${formatBytes(event.bytes)})`;
    const parts = event.total === undefined ? `${event.parts} part${event.parts === 1 ? '' : 's'} so far` : `${event.parts} of ${event.total} parts`;
    // Seconds left, from the rate since the phase's first sample.
    const eta = () => {
      const seconds = (now() - first.time) / 1000;
      if (event === first.event || seconds <= 0 || event.parts === event.total) return '';
      if (event.total !== undefined && event.parts > first.event.parts) return left((event.total - event.parts) * seconds / (event.parts - first.event.parts));
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
    if(event.phase==='schema-unverified') { report('Schema unverified: '+JSON.stringify(event.receipt)); return; }
    if (event.phase === 'skipped') { report(skippedTablesLine(event.tables)); return; }
    if (event.phase === 'start') {
      if (event.direction === 'export') {
        report(`Exporting local data (${formatBytes(event.bytes)} on disk). Archive size and time remaining are not known yet. Progress follows every few seconds.`);
      } else {
        report(`Restoring a ${formatBytes(event.bytes)} archive. ${event.bytes / IMPORT_RATE < 45 ? 'This takes under a minute.' : `An archive this size usually takes ${formatDuration(event.bytes / IMPORT_RATE)}; a busy machine takes longer. Progress follows every few seconds.`}`);
      }
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
