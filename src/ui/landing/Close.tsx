import { CloseThread } from './Thread';
import { Ornament } from './Ornament';
export function Close({ repository, variant }: { repository: string; variant?: 'site' }) {
  return <section className="close-band" id="get" aria-labelledby="get-title"><CloseThread /><Ornament name="tape" /><h2 id="get-title">See exactly <span className="nowrap">what broke.</span></h2><a className="primary-button" href={variant === 'site' ? '/run' : repository}>{variant === 'site' ? 'Run Spool' : 'Get Spool on GitHub'}</a></section>;
}
