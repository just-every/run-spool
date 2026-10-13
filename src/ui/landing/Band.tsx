import type { ReactNode } from 'react';
import { BandStrip, BandThreads } from './Thread';
import { Ornament, type OrnamentName } from './Ornament';
// Each band draws the thread's piece with its own wobble. On phones the thread keeps to the left margin or the right one, alternating by band.
const variants = ['free', 'agents', 'regressions', 'private', 'archive', 'try', 'run'];
/** One landing section. Each has its own arrangement of copy and drawing (the `l-` class, see landing.css); on wide screens the thread runs
 *  through it as one stretched piece. Ornaments sit against the band, or against the drawing when they belong to it. */
export function Band({ id, title, body, ornaments = [], drawingOrnaments = [], children }: { id: string; title: string; body: string; ornaments?: OrnamentName[]; drawingOrnaments?: OrnamentName[]; children: ReactNode }) {
  const index = Math.max(0, variants.indexOf(id));
  return <section className={`band l-${id}`} id={id} aria-labelledby={`${id}-title`}>
    <BandThreads id={id} />
    <BandStrip variant={index} side={index % 2 ? 'r' : 'l'} place={index === 0 ? 'first' : index === variants.length - 1 ? 'last' : 'mid'} />
    <div className="band-copy"><h2 id={`${id}-title`}>{title}</h2><p>{body}</p></div>
    <div className="band-drawing">{children}{drawingOrnaments.map((name) => <Ornament key={name} name={name} />)}</div>
    {ornaments.map((name) => <Ornament key={name} name={name} />)}
  </section>;
}

/** A ruled drawing card copied from the product's own UI. */
export function DrawingCard({ title, className = '', children }: { title?: string; className?: string; children: ReactNode }) {
  return <div className={`card drawing-card ${className}`.trim()}>{title && <p className="card-title">{title}</p>}{children}</div>;
}
