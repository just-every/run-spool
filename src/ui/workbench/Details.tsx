import { useId, useRef, type ReactNode } from 'react';
import { Icon, type IconName } from './icons';
import { Tip } from './Tip';

/** Native modal focus containment, Escape and focus return, with retained children. With an icon the trigger is
 * icon-only and its tip carries its name; with a trigger node the trigger shows that content and is named by it. */
export function Details({ title, children, onOpen, triggerLabel = 'Details', icon, trigger, triggerClass = 'text-button' }: { title: string; children: ReactNode; onOpen?: () => void; triggerLabel?: string; icon?: IconName; trigger?: ReactNode; triggerClass?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  function close() { dialog.current?.close(); button.current?.setAttribute('aria-expanded', 'false'); button.current?.focus(); }
  const name = trigger ? undefined : `Details: ${title}`;
  const opener = <button ref={button} className={icon ? 'icon-button details-trigger' : `${triggerClass} details-trigger`} aria-label={name} aria-haspopup="dialog" aria-expanded="false" aria-controls={id} onClick={() => {
      dialog.current?.showModal(); button.current?.setAttribute('aria-expanded', 'true'); heading.current?.focus(); onOpen?.();
    }}>{icon ? <Icon name={icon} /> : trigger ?? triggerLabel}</button>;
  return <>
    {icon ? <Tip label={name!}>{opener}</Tip> : opener}
    <dialog ref={dialog} id={id} className="details-dialog" aria-labelledby={`${id}-title`} onKeyDown={event => {
      // Finish keyboard dismissal in this event, before the native cancel task.
      if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); close(); }
    }} onCancel={event => { event.preventDefault(); close(); }} onClose={() => { button.current?.setAttribute('aria-expanded', 'false'); button.current?.focus(); }}>
      <div className="details-heading"><h2 ref={heading} id={`${id}-title`} tabIndex={-1}>{title}</h2><button className="text-button" onClick={close}>Close details</button></div>
      {children}
    </dialog>
  </>;
}
