import { bandPaths, crossLR, crossRL, footerNarrow, footerWide, heroLead, heroRun, heroTail, knots, loop, narrowLead, narrowSwing, narrowTail, stepSegments, wide } from './thread-paths';

// The page's one thread, drawn in pieces that join end to end. Each is decorative (aria-hidden, no text).
// Stretched pieces use preserveAspectRatio="none" with a non-scaling stroke so the line stays an even 2px.
const Path = ({ d }: { d: string }) => <path d={d} vectorEffect="non-scaling-stroke" />;
const Stretched = ({ className, box, d }: { className: string; box: string; d: string }) =>
  <svg className={`thread ${className}`} viewBox={box} preserveAspectRatio="none" aria-hidden="true" focusable="false"><Path d={d} /></svg>;
/** A fixed-size drawing: a 1px anchor whose origin is the point it is attached to, drawn 1:1 in px around it. */
const Anchored = ({ className, d }: { className: string; d: string }) =>
  <svg className={`thread thread-pt ${className}`} width="1" height="1" aria-hidden="true" focusable="false"><Path d={d} /></svg>;

const Wide = ({ className, d }: { className: string; d: string }) => <Stretched className={`t-wide tw ${className}`} box="0 0 1000 1000" d={d} />;

/** A band's thread on wide screens: one piece stretched over the band (two around the loop). */
export function BandThreads({ id }: { id: string }) {
  switch (id) {
    case 'free': return <Wide className="tw-free" d={wide.free} />;
    case 'agents': return <Wide className="tw-agents" d={wide.agents} />;
    case 'regressions': return <><Wide className="tw-reg-a" d={wide.regressionsA} /><Anchored className="t-wide tw-loop" d={loop} /><Wide className="tw-reg-b" d={wide.regressionsB} /></>;
    case 'private': return <Wide className="tw-private" d={wide.private} />;
    case 'archive': return <Wide className="tw-archive" d={wide.archive} />;
    case 'try': return <><Wide className="tw-try-a" d={wide.tryA} /><Wide className="tw-try-b" d={wide.tryB} /></>;
    default: return <Wide className="tw-run" d={wide.run} />;
  }
}

/** A band's margin strip on narrow screens (its wobble varies by band). On phones it keeps to the left margin or the right one and
 *  crosses the page in the padding between bands (`cross`, from the previous band's side to this one's). */
export function BandStrip({ variant, side, place }: { variant: number; side: 'l' | 'r'; place: 'first' | 'mid' | 'last' }) {
  return <>
    {place !== 'first' && <Stretched className={`cross cross-${side === 'r' ? 'lr' : 'rl'}`} box="0 0 100 100" d={side === 'r' ? crossLR : crossRL} />}
    <Stretched className={`t-narrow band-thread s-${side} strip-${place}`} box="0 0 100 400" d={bandPaths[variant % bandPaths.length]} />
  </>;
}

/** Pieces that sit directly in the hero band: header run (wide) or margin drop (narrow), and the exit into the first band. */
export function HeroThreads() {
  return <>
    <Anchored className="t-wide hero-lead" d={heroLead} />
    <Stretched className="t-wide hero-run" box="0 0 477 130" d={heroRun} />
    <Stretched className="t-wide hero-tail" box="0 0 100 96" d={heroTail} />
    <Stretched className="t-narrow narrow-lead" box="0 0 100 33" d={narrowLead} />
    <Stretched className="t-narrow narrow-tail" box="0 0 100 100" d={narrowTail} />
  </>;
}

/** The hero copy's strip down the left margin (narrow screens). */
export const CopyThread = () => <Stretched className="t-narrow copy-thread" box="0 0 100 400" d={bandPaths[0]} />;

/** Inside each numbered step: the numeral's knot (wide), the stretch down to the next numeral, and on narrow screens the swing from the margin. */
export function StepThreads({ index }: { index: number }) {
  return <>
    <Anchored className="t-wide knot" d={knots[index]} />
    {index === 0 && <Stretched className="t-narrow step-swing" box="0 0 100 100" d={narrowSwing} />}
    <Stretched className={index === 2 ? 'step-seg seg-last' : 'step-seg'} box="0 0 80 100" d={stepSegments[index]} />
  </>;
}

/** The close band: along the top padding and down the right of the heading (wide) or the margin strip (narrow). */
export function CloseThread() {
  return <>
    <Wide className="close-thread" d={wide.close} />
    <Stretched className="t-narrow band-thread" box="0 0 100 400" d={bandPaths[6]} />
  </>;
}

/** The footer: down from the rule and onto the spool's winding. */
export function FooterThread() {
  return <>
    <Anchored className="t-wide footer-wind" d={footerWide} />
    <Stretched className="t-narrow band-thread footer-strip" box="0 0 100 400" d={bandPaths[3]} />
    <Stretched className="t-narrow footer-swing" box="0 0 100 40" d={footerNarrow} />
  </>;
}
