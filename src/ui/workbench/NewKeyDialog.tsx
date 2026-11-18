import { useEffect, useRef, type ReactNode } from 'react';

export function NewKeyDialog({ children, onDismiss }: { children: ReactNode; onDismiss: () => void }) {
 const dialog = useRef<HTMLDialogElement>(null);
 useEffect(() => { const element=dialog.current; element?.showModal(); return ()=>element?.close(); },[]);
 return <dialog ref={dialog} className="details-dialog secret-key" aria-label="New project key" onCancel={event=>{event.preventDefault();onDismiss();}}>
  <h2>Save your new key</h2><p>Copy this key now. You won’t see it again.</p>
  {children}
  <button className="primary-button" onClick={onDismiss}>I've saved it</button>
 </dialog>;
}
