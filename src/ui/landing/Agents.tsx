import { Band, DrawingCard } from './Band';
// Copies the Project keys section of Settings (src/ui/workbench/SettingsView.tsx).
export function Agents() {
  return <Band id="agents" drawingOrnaments={['robot']} title="Hand it to your coding agent." body="Create a read-only agent key. Your agent reads that project's issues and evidence, and changes nothing.">
    <DrawingCard title="Project keys"><p className="drawing-note">Agent keys read this project’s evidence.</p><p className="inner-box key-line"><span><span className="mark">Read-only agent</span> · Active</span><code>4f1c9e2a7b03…</code></p></DrawingCard>
  </Band>;
}
