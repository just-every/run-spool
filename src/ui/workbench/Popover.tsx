import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './icons';
import { Tip } from './Tip';

/** A toolbar control that opens its panel in place. Its open state is its own, so background refreshes never
 * close it; Escape, a press outside or the panel's own close() do, and focus returns to the control. Where the
 * layout folds its label away (phone width), the control is icon-only and its tip names it. */
export function Popover({ label, icon, count, align = 'start', className, children }: {
  label: string; icon?: IconName; count?: number; align?: 'start' | 'end'; className?: string; children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false), id = useId();
  const root = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); button.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); close(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); };
  }, [open]);
  return <div className={`popover${className ? ' ' + className : ''}`} ref={root}>
    <Tip label={label} className="tool-tip"><button ref={button} type="button" className="tool-button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      {icon && <Icon name={icon} />}<span className="tool-label">{label}</span>{!!count && <span className="tool-count" aria-hidden="true">{count}</span>}<span className="tool-chevron"><Icon name="down" /></span>
    </button></Tip>
    <div id={id} className={`popover-panel ${align}`} role="group" aria-label={label} hidden={!open}>{children(close)}</div>
  </div>;
}
