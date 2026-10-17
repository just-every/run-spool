import { Wordmark } from '../Wordmark';
import { FooterThread } from './Thread';

/** The landing's footer ends the page's thread, wound onto one engraved spool (public/theme/landing/spool.png, the pick's spool with its tail drawn as the thread); other pages pass no `thread` and get the plain footer. */
export function Footer({ repository, thread, variant }: { repository: string; thread?: boolean; variant?: 'site' }) {
  const links = <><Wordmark /><nav aria-label="Project"><a href="/docs">Docs</a>{variant === 'site' && <a href="/contract">Contract</a>}<a href={`${repository}/blob/main/LICENSE`}>MIT License</a><a href={repository}>GitHub</a></nav></>;
  if (!thread) return <footer className="landing-footer">{links}</footer>;
  return <footer className="landing-footer has-thread"><div className="footer-row"><FooterThread />{links}<img className="footer-spool" src="/theme/landing/spool.png" alt="" aria-hidden="true" width="128" height="108" /></div></footer>;
}
