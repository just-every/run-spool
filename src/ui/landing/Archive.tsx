import { Band, DrawingCard } from './Band';
// Copies Archive and restore in Settings (src/ui/workbench/ArchiveSettings.tsx).
export function Archive() {
  return <Band id="archive" drawingOrnaments={['bundle']} title="Take it all with you." body="Export everything to one file. Restore it into a fresh copy of Spool, on any computer.">
    <DrawingCard title="Archive and restore"><span className="highlight-button drawn-button">Download private archive</span></DrawingCard>
  </Band>;
}
