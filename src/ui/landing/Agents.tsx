import { Band, DrawingCard } from './Band';
// Copies the Project keys section of Settings (src/ui/workbench/SettingsView.tsx).
export function Agents() {
  return <Band id="agents" drawingOrnaments={['robot']} title="Hand it to your coding agent." body="Agent keys are read-only except for inert grouping proposals. Answer all six policy questions and choose Yes or No for paid AI.">
    <DrawingCard title="Project keys"><p className="drawing-note">Agent keys read one project’s evidence. The owner reviews grouping proposals.</p><p className="inner-box key-line"><span><span className="mark">Agent key</span> · Active</span><code>4f1c9e2a7b03…</code></p></DrawingCard>
  </Band>;
}
