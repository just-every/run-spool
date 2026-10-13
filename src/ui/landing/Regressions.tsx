import { Band } from './Band';
// Copies an Issues list row before and after a later release brings the error back (src/ui/workbench/IssueList.tsx).
export function Regressions() {
  return <Band id="regressions" drawingOrnaments={['pincushion']} title="Know when it comes back." body="Resolve an issue. If it returns in a later release, Spool opens it again and names that release.">
    <div className="release-flow">
      <div className="issue-card"><code>ReferenceError: track is not defined</code><p className="chip-row"><span className="state-chip">Resolved</span><code>r42</code></p></div>
      <span className="flow-arrow" aria-hidden="true" />
      <div className="issue-card"><code>ReferenceError: track is not defined</code><p className="chip-row"><span className="state-chip">Open</span><span className="attention-badge"><span className="mark">Regressed in r43</span></span><code>r43</code></p></div>
    </div>
  </Band>;
}
