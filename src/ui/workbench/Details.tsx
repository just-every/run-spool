import { useId, useRef, type ReactNode } from 'react';

/** Native modal focus containment, Escape and focus return, with retained children. */
export function Details({ title, children, onOpen }: { title: string; children: ReactNode; onOpen?: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  function close() { dialog.current?.close(); trigger.current?.setAttribute('aria-expanded', 'false'); trigger.current?.focus(); }
  return <>
    <button ref={trigger} className="text-button details-trigger" aria-label={`Details: ${title}`} aria-haspopup="dialog" aria-expanded="false" aria-controls={id} onClick={() => {
      dialog.current?.showModal(); trigger.current?.setAttribute('aria-expanded', 'true'); heading.current?.focus(); onOpen?.();
    }}>Details</button>
    <dialog ref={dialog} id={id} className="details-dialog" aria-labelledby={`${id}-title`} onKeyDown={event => {
      // Finish keyboard dismissal in this event, before the native cancel task.
      if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); close(); }
    }} onCancel={event => { event.preventDefault(); close(); }} onClose={() => { trigger.current?.setAttribute('aria-expanded', 'false'); trigger.current?.focus(); }}>
      <div className="details-heading"><h2 ref={heading} id={`${id}-title`} tabIndex={-1}>{title}</h2><button className="text-button" onClick={close}>Close details</button></div>
      {children}
    </dialog>
  </>;
}
