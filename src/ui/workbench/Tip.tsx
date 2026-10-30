import { useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from './icons';
import './controls.css';

/** The one tooltip: the control's own accessible name, ~300 ms after a mouse hover and at once on keyboard
 * focus. It sits beside its control inside the viewport, never takes a tap, and Escape or a scroll closes it.
 * A disabled control keeps its tip (the host, not the control, takes the pointer). */
export function Tip({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const [shown, setShown] = useState(false), [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const host = useRef<HTMLSpanElement>(null), tip = useRef<HTMLSpanElement>(null), timer = useRef(0), frame = useRef(0);
  const cancel = () => { window.clearTimeout(timer.current); cancelAnimationFrame(frame.current); };
  const hide = () => { cancel(); setShown(false); setPlace(null); };
  // Keyboard focus scrolls an off-screen control into view, and that scroll is dispatched on the next frame.
  // Showing two frames after focus places the tip where the control landed; only a later scroll closes it.
  const showAfterFocusScroll = () => { cancel(); frame.current = requestAnimationFrame(() => { frame.current = requestAnimationFrame(() => setShown(true)); }); };
  useEffect(() => cancel, []);
  useEffect(() => {
    if (!shown) return;
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') hide(); };
    document.addEventListener('keydown', key); window.addEventListener('scroll', hide, true);
    return () => { document.removeEventListener('keydown', key); window.removeEventListener('scroll', hide, true); };
  }, [shown]);
  useLayoutEffect(() => {
    if (!shown || !host.current || !tip.current) return;
    const anchor = host.current.getBoundingClientRect(), box = tip.current.getBoundingClientRect(), gutter = 8;
    const left = Math.max(gutter, Math.min(anchor.left + anchor.width / 2 - box.width / 2, innerWidth - gutter - box.width));
    const below = anchor.bottom + 6;
    setPlace({ left, top: below + box.height > innerHeight - gutter ? anchor.top - 6 - box.height : below });
  }, [shown]);
  return <span ref={host} className={`tip${className ? ' ' + className : ''}`}
    onPointerEnter={event => { if (event.pointerType !== 'mouse') return; window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setShown(true), 300); }}
    onPointerLeave={hide}
    onFocus={event => { if ((event.target as HTMLElement).matches(':focus-visible')) showAfterFocusScroll(); }}
    onBlur={hide}>
    {children}
    {shown && <span ref={tip} className="tip-text" role="tooltip" style={place ? { left: place.left, top: place.top } : { visibility: 'hidden' }}>{label}</span>}
  </span>;
}

/** An icon-only button: the tip, the accessible name and the label are one string. */
export function IconButton({ label, icon, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: IconName }) {
  return <Tip label={label}><button type="button" className={`icon-button${className ? ' ' + className : ''}`} aria-label={label} {...props}><Icon name={icon} /></button></Tip>;
}
