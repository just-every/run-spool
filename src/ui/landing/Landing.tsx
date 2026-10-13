import { Hero } from './Hero';
import { Free } from './Free';
import { Agents } from './Agents';
import { Regressions } from './Regressions';
import { Privacy } from './Privacy';
import { Archive } from './Archive';
import { Beside } from './Beside';
import { RunIt } from './RunIt';
import { Close } from './Close';
import { Footer } from './Footer';
import { PublicHead } from './PublicHead';
/** The public page served at / to visitors without an owner session. Static HTML, no script; the site variant omits installation links. */
export function LandingPage({ repository, variant, styles = [] }: { repository: string; variant?: 'site'; styles?: string[] }) {
  return <html lang="en">
    <PublicHead title="Spool — see exactly what broke" description="Spool catches your JavaScript errors and points to the exact line in your own source. 100% free, open source alternative to Sentry, Bugsnag and Rollbar." stylesheet="/theme/landing.css" styles={styles} />
    <body className="landing">
      <main className="landing-page"><Hero repository={repository} variant={variant} /><Free /><Agents /><Regressions /><Privacy /><Archive /><Beside /><RunIt /><Close repository={repository} variant={variant} /></main>
      <Footer repository={repository} thread />
    </body>
  </html>;
}
