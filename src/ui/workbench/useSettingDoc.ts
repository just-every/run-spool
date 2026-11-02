import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveRead } from './useLiveRead';

// One setting that saves as you go. The section reads it quietly while the tab is visible,
// keeps what the person typed, and sends each edit itself: a select, toggle or radio at once, a
// text or number field on blur or after a short pause. A held edit (one with an outside effect)
// waits for its one-step confirm instead. Saving never goes through the page-wide busy flag, so
// the page's own controls stay live.
export type SavePhase = 'idle' | 'saving' | 'saved' | 'failed';
export type SaveStatus = { phase: SavePhase; field: string; reason: string; flash: number };
type Edit = { field?: string; now?: boolean; hold?: boolean };
const NONE = Symbol('none');
// Edits that could not be sent before the person left; they are sent again on return.
const unsent = new Map<string, unknown>();
// A save still on its way when the person came back: the first read waits for it, so it never shows the old value.
const settling = new Map<string, Promise<unknown>>();

/** A plain one-line reason. The raw browser message ("Failed to fetch") never reaches the page. */
export function plainReason(error: unknown) {
  const { message = '', status } = (error ?? {}) as { message?: string; status?: number };
  if (status === 409) return /\s/.test(message) ? `${message.replace(/\.$/, '')}. Retry to keep your value.` : 'This changed somewhere else. Retry to keep your value.';
  if (!message || /failed to fetch|networkerror|load failed|unexpected (token|end)|json/i.test(message)) return 'Spool is unavailable. Check your connection and try again.';
  return message;
}
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

export function useSettingDoc<D, V>({ key, read, draftOf, write, onSaved, delay = 600 }: {
  key: string;
  read: (signal: AbortSignal) => Promise<D>;
  draftOf: (data: D) => V;
  write: (data: D, value: V, keepalive: boolean) => Promise<D>;
  onSaved?: (data: D) => void;
  delay?: number;
}) {
  const [data, setData] = useState<D | null>(null), [draft, setDraftState] = useState<V | null>(null);
  const [held, setHeld] = useState(false), [loadError, setLoadError] = useState('');
  const [status, setStatus] = useState<SaveStatus>({ phase: 'idle', field: '', reason: '', flash: 0 });
  const dataRef = useRef<D | null>(null), draftRef = useRef<V | null>(null), heldRef = useRef(false);
  const pending = useRef<V | typeof NONE>(NONE), failed = useRef<V | typeof NONE>(NONE);
  const inflight = useRef(false), timer = useRef<number | undefined>(undefined), mounted = useRef(true);
  const generation = useRef(0), flash = useRef(0), field = useRef('');
  const latest = useRef({ read, draftOf, write, onSaved }); latest.current = { read, draftOf, write, onSaved };

  const setDraft = (value: V | null) => { draftRef.current = value; setDraftState(value); };
  const setHeldValue = (value: boolean) => { heldRef.current = value; setHeld(value); };
  const unsaved = () => pending.current !== NONE || inflight.current || failed.current !== NONE || heldRef.current;
  const applyData = (next: D) => { dataRef.current = next; setData(previous => same(previous, next) ? previous : next); };

  async function pump(keepalive: boolean, fresh: boolean) {
    if (inflight.current) return;
    inflight.current = true;
    try {
      while (pending.current !== NONE) {
        const value = pending.current as V; pending.current = NONE;
        generation.current++;
        if (mounted.current) setStatus(state => ({ ...state, phase: 'saving', reason: '' }));
        try {
          // After a refused save, Retry first takes the latest revision, then sends the same value.
          if (fresh || !dataRef.current) { dataRef.current = await latest.current.read(new AbortController().signal); fresh = false; }
          const next = await latest.current.write(dataRef.current as D, value, keepalive);
          applyData(next); failed.current = NONE; generation.current++;
          if (pending.current === NONE) {
            const id = ++flash.current;
            if (mounted.current) {
              // The server's copy, normalised, replaces the field only while nothing newer was typed.
              const landed = latest.current.draftOf(next);
              if (same(draftRef.current, value) && !same(draftRef.current, landed)) setDraft(landed);
              setStatus({ phase: 'saved', field: field.current, reason: '', flash: id });
              window.setTimeout(() => { if (mounted.current) setStatus(state => state.flash === id && state.phase === 'saved' ? { ...state, phase: 'idle' } : state); }, 2200);
            }
            latest.current.onSaved?.(next);
          }
        } catch (error) {
          failed.current = value; generation.current++;
          if (!mounted.current) unsent.set(key, value);
          else setStatus({ phase: 'failed', field: field.current, reason: plainReason(error), flash: flash.current });
          break;
        }
      }
    } finally { inflight.current = false; }
  }

  const send = (keepalive = false, fresh = false) => {
    window.clearTimeout(timer.current);
    if (inflight.current) return Promise.resolve();
    const work = pump(keepalive, fresh); settling.set(key, work);
    void work.finally(() => { if (settling.get(key) === work) settling.delete(key); });
    return work;
  };

  /** Change the field. The value is kept in the field whatever happens to the save. */
  function edit(next: V, { field: name = '', now = false, hold }: Edit = {}) {
    field.current = name; setDraft(next); failed.current = NONE;
    window.clearTimeout(timer.current);
    if (hold === false) setHeldValue(false);
    if (hold === true || (hold === undefined && heldRef.current)) { pending.current = NONE; setHeldValue(true); setStatus(state => ({ ...state, phase: 'idle', field: name, reason: '' })); return; }
    generation.current++; pending.current = next;
    setStatus(state => state.phase === 'failed' ? { ...state, phase: 'idle', reason: '' } : state);
    if (now) void send(); else timer.current = window.setTimeout(() => void send(), delay);
  }
  /** A text field leaving focus sends its edit now instead of waiting. */
  const flush = () => { if (pending.current !== NONE) void send(); };
  /** The one-step confirm: send the held value. */
  const commit = (name = '') => { if (draftRef.current === null) return; field.current = name; setHeldValue(false); generation.current++; pending.current = draftRef.current; return send(); };
  const discard = () => { window.clearTimeout(timer.current); pending.current = NONE; failed.current = NONE; setHeldValue(false); if (dataRef.current) setDraft(latest.current.draftOf(dataRef.current)); setStatus(state => ({ ...state, phase: 'idle', reason: '' })); };
  const retry = () => { if (failed.current === NONE) return; pending.current = failed.current; failed.current = NONE; void send(false, true); };

  useLiveRead(async (signal) => {
    await settling.get(key);
    const started = generation.current;
    try {
      const next = await latest.current.read(signal);
      if (signal.aborted) return;
      // A read that began before a save started or landed would bring back the old value.
      if (started !== generation.current) return;
      applyData(next); setLoadError('');
      if (!unsaved()) { const value = latest.current.draftOf(next); if (!same(draftRef.current, value)) setDraft(value); }
    } catch (error) { if (!signal.aborted && !dataRef.current) setLoadError(plainReason(error)); }
  }, [key]);

  useEffect(() => {
    mounted.current = true;
    const kept = unsent.get(key) as V | undefined;
    if (kept !== undefined) { unsent.delete(key); setDraft(kept); pending.current = kept; void send(); }
    const leaving = () => { if (pending.current !== NONE) void send(true); };
    const hidden = () => { if (document.visibilityState === 'hidden') leaving(); };
    window.addEventListener('pagehide', leaving); document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('pagehide', leaving); document.removeEventListener('visibilitychange', hidden);
      mounted.current = false;
      // Leaving never drops an edit: send it now, and keep it for return if that fails too.
      if (pending.current !== NONE) void send(true); else if (failed.current !== NONE) unsent.set(key, failed.current);
    };
  }, [key]);

  const reload = useCallback(() => { setLoadError(''); void latest.current.read(new AbortController().signal).then(next => { applyData(next); const value = latest.current.draftOf(next); if (!unsaved()) setDraft(value); }).catch(error => setLoadError(plainReason(error))); }, []);
  return { data, draft, held, loadError, status, edit, flush, commit, discard, retry, reload, unsaved: held || status.phase === 'saving' || status.phase === 'failed' };
}
