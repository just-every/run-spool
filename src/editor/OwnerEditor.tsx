import { useEffect } from 'react';
import { useRouter } from '@tanstack/react-router';
import { configLoader, createOwnerEditor, installCompiledLiveEdits, setLiveEditsReady } from '../modules/editor';
import type { Session } from '../modules/operator-auth/index.mjs';
import compiled from './visual-edits.json';

if (typeof document !== 'undefined') {
 setLiveEditsReady(false);
 installCompiledLiveEdits(compiled);
}

/** Native session identity and a short server lease control the optional editor. */
export function OwnerEditor() {
 const router = useRouter();
 useEffect(() => {
  const pause = router.subscribe('onBeforeNavigate', () => setLiveEditsReady(false));
  // Even a navigation to the same URL/history entry can pause a retained leaf.
  // Resume only after the router acknowledges the committed DOM, not on load.
  const rendered = router.subscribe('onRendered', () => setLiveEditsReady(true));
  return () => { pause(); rendered(); };
 }, [router]);
 useEffect(() => {
  const editor = createOwnerEditor(), controller = new AbortController();
  let identity = '', pending = false, stopped = false, generation = 0;
  const revoke = () => { generation++; identity = ''; editor.setOwner(false); };
  const refresh = async () => {
   if (pending || stopped) return;
   pending = true;
   const current = generation;
   try {
    const response = await fetch('/auth/session', {credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal});
    if (!response.ok) { revoke(); return; }
    const session = await response.json() as Session;
    if (stopped || current !== generation) return;
    if (session.operator?.role !== 'owner') { revoke(); return; }
    const next = JSON.stringify([session.id, session.operator.id]);
    if (next !== identity) { editor.setOwner(true); identity = next; }
    const grant = await configLoader('/api/editor/config', location.origin)(controller.signal);
    if (stopped || current !== generation) return;
    // An installation without the optional editor is an ordinary disabled state.
    if (grant && typeof grant === 'object' && 'config' in grant && grant.config === null) { revoke(); return; }
    await editor.refresh(async () => grant);
   } catch { revoke(); } finally { pending = false; }
  };
  const changed = () => { revoke(); void refresh(); };
  const focus = () => { void refresh(); };
  window.addEventListener('spool:auth-changed', changed);
  window.addEventListener('spool:auth-lost', revoke);
  window.addEventListener('focus', focus);
  const timer = setInterval(focus, 20_000);
  void refresh();
  return () => {
   stopped = true; controller.abort(); clearInterval(timer); editor.dispose();
   window.removeEventListener('spool:auth-changed', changed);
   window.removeEventListener('spool:auth-lost', revoke);
   window.removeEventListener('focus', focus);
  };
 }, []);
 return null;
}
