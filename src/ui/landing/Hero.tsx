import { SiteHeader } from './SiteHeader';
import { Ticks } from './Ticks';
import { CopyThread, HeroThreads, StepThreads } from './Thread';
// Every string in the drawing is copied from the real workbench for the same error: the issue header,
// the first two stack rows and the evidence packet in the right rail (src/ui/workbench/IssueView.tsx, EvidenceRail.tsx).
export function Hero({ repository, variant }: { repository: string; variant?: 'site' }) {
  return <section className="hero-band" id="top" aria-labelledby="hero-title">
    <HeroThreads />
    <SiteHeader repository={repository} variant={variant} />
    <div className="hero-copy">
      <CopyThread />
      <h1 id="hero-title">See exactly <span className="nowrap">what broke.</span></h1>
      <p className="hero-subhead">Spool catches your JavaScript errors and points to the exact line in your own source.</p>
      <p className="hero-alt">100% free, open source alternative to <strong>Sentry</strong>, <strong>Bugsnag</strong> and <strong>Rollbar</strong></p>
      <div className="hero-actions"><a className="primary-button" href={variant === 'site' ? '/run' : repository}>{variant === 'site' ? 'Run Spool' : 'Get Spool'}</a><a className="underlined-link" href="#run">Run it on your computer</a></div>
    </div>
    <div className="hero-drawing" role="img" aria-label="Spool catches a TypeError on release r42, maps it to line 42 of src/account.ts in your original source, and has its evidence packet ready to download.">
      <ol className="thread-steps">
        <li className="step"><StepThreads index={0} /><span className="numeral" aria-hidden="true">1</span><div className="card step-card"><p className="card-title">Caught</p><div className="inner-box"><code className="step-error">TypeError: Cannot read properties of undefined (reading 'city')</code><p className="chip-row"><span className="state-chip">Open</span><span className="attention-badge">New</span><code>r42 · production</code></p></div></div></li>
        <li className="step"><StepThreads index={1} /><span className="numeral" aria-hidden="true">2</span><div className="card step-card"><p className="card-title">Mapped</p><div className="mini-stack">
          <p className="mini-row mark-bar"><span className="mini-index">1</span><code>src/account.ts:42:25</code><span className="mini-tag">Original source</span><Ticks /></p>
          <p className="mini-row"><span className="mini-index">2</span><code>src/profile-form.ts:17:11</code><span className="mini-tag">Original source</span></p>
        </div></div></li>
        <li className="step"><StepThreads index={2} /><span className="numeral" aria-hidden="true">3</span><div className="card step-card"><p className="card-title">Ready</p><div className="packet-row"><span className="packet-title">Evidence packet</span><span className="highlight-button">↓ Download evidence</span></div></div></li>
      </ol>
    </div>
  </section>;
}
