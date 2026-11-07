import { useId, useRef, type ReactNode } from 'react';

/** Native modal focus containment, Escape and focus return, with retained children. */
export function Details({ title, children, onOpen, triggerLabel = 'Details' }: { title: string; children: ReactNode; onOpen?: () => void; triggerLabel?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  function close() { dialog.current?.close(); trigger.current?.setAttribute('aria-expanded', 'false'); trigger.current?.focus(); }
  return <>
    <button ref={trigger} className="text-button details-trigger" aria-label={`Details: ${title}`} aria-haspopup="dialog" aria-expanded="false" aria-controls={id} onClick={() => {
      dialog.current?.showModal(); trigger.current?.setAttribute('aria-expanded', 'true'); heading.current?.focus(); onOpen?.();
    }}>{triggerLabel}</button>
    <dialog ref={dialog} id={id} className="details-dialog" aria-labelledby={`${id}-title`} onKeyDown={event => {
      if (event.key === 'Tab' && !event.defaultPrevented) {
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,summary,[tabindex]'))
          .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0);
        const current = controls.indexOf(document.activeElement as HTMLElement);
        if (current < 0 || (event.shiftKey ? current === 0 : current === controls.length - 1)) {
          event.preventDefault();
          (controls[event.shiftKey ? controls.length - 1 : 0] ?? heading.current)?.focus();
        }
      }
      // Finish keyboard dismissal in this event, before the native cancel task.
      if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); close(); }
    }} onCancel={event => { event.preventDefault(); close(); }} onClose={() => { trigger.current?.setAttribute('aria-expanded', 'false'); trigger.current?.focus(); }}>
      <div className="details-heading"><h2 ref={heading} id={`${id}-title`} tabIndex={-1}>{title}</h2><button className="text-button" onClick={close}>Close details</button></div>
      {children}
    </dialog>
  </>;
}
