import { Wordmark } from '../Wordmark';
/** The public header shared by the landing and the docs pages. On the landing its rule runs on as the hero's thread. */
export function SiteHeader({ repository, thread = false, current }: { repository: string; thread?: boolean; current?: 'docs' }) {
  return <header className="landing-header">
    <div className="brand-run"><a className="wordmark-link" href="/"><Wordmark /></a>{thread && <span className="thread-run" aria-hidden="true" />}</div>
    <nav className="landing-nav" aria-label="Spool"><a href="/docs" aria-current={current === 'docs' ? 'page' : undefined}>Docs</a><a href={repository}>GitHub</a><a href="/sign-in">Sign in</a></nav>
  </header>;
}
