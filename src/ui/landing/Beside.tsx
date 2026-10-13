import { Band, DrawingCard } from './Band';
// The start of the snippet the Capture view gives you (src/ui/workbench/CaptureView.tsx).
export function Beside() {
  return <Band id="try" ornaments={['needle']} title="Try it beside what you have." body="Add Spool's capture helper next to your current error tracker and compare the two.">
    <DrawingCard className="code-card"><pre><code><span className="mark">installBrowserCapture</span>{'({\n  project: "web-app",\n  release: "r42",\n});'}</code></pre></DrawingCard>
  </Band>;
}
