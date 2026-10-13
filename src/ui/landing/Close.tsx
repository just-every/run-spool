import { CloseThread } from './Thread';
import { Ornament } from './Ornament';
export function Close({ repository }: { repository: string }) {
  return <section className="close-band" id="get" aria-labelledby="get-title"><CloseThread /><Ornament name="tape" /><h2 id="get-title">See exactly <span className="nowrap">what broke.</span></h2><a className="primary-button" href={repository}>Get Spool on GitHub</a></section>;
}
