import { useEffect, useId, useState, type ReactNode } from 'react';
import { Icon } from './icons';
import './fold.css';

/** A long-tail section on a record page: one row (title, one meta line of its current state, chevron) that opens
 * in place. The body stays mounted while closed, so its reads keep the meta line current and its drafts survive. */
export function Fold({ title, meta, label, className, id, headingId, initialOpen = false, children }: { title: string; meta: ReactNode; label?: string; className?: string; id?: string; headingId?: string; initialOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(initialOpen), body = useId();
  // A route or a hand-off that asks for this section opens it, as it would have scrolled to it.
  useEffect(() => { if (initialOpen) setOpen(true); }, [initialOpen]);
  return <section id={id} className={`fold${open ? ' open' : ''}${className ? ' ' + className : ''}`} aria-label={label ?? title}>
    <div className="fold-row">
      <h2 className="rail-title" id={headingId}><button type="button" aria-expanded={open} aria-controls={body} onClick={() => setOpen(value => !value)}>{title}</button></h2>
      <p className="meta fold-meta">{meta}</p>
      <span className="fold-chevron"><Icon name="down" /></span>
    </div>
    <div id={body} className="fold-body" hidden={!open}>{children}</div>
  </section>;
}
