import { useId, useState, type ReactNode } from 'react';
import { Icon } from './icons';

/** A long-tail section on a record page: one row (title, one meta line of its current state, chevron) that opens
 * in place. The body stays mounted while closed, so its reads keep the meta line current and its drafts survive. */
export function Fold({ title, meta, label, className, children }: { title: string; meta: ReactNode; label?: string; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false), body = useId();
  return <section className={`fold${open ? ' open' : ''}${className ? ' ' + className : ''}`} aria-label={label ?? title}>
    <div className="fold-row">
      <h2 className="rail-title"><button type="button" aria-expanded={open} aria-controls={body} onClick={() => setOpen(value => !value)}>{title}</button></h2>
      <p className="meta fold-meta">{meta}</p>
      <span className="fold-chevron"><Icon name="down" /></span>
    </div>
    <div id={body} className="fold-body" hidden={!open}>{children}</div>
  </section>;
}
