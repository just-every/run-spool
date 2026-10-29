import { createContext, useContext, useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';

export type Request = (path: string, method?: string, value?: any) => Promise<any>;
export type Run = (work: () => Promise<unknown>) => Promise<void>;
export const states = ['open', 'acknowledged', 'resolved', 'suppressed'];
export const stateLabel = (state: string) => state.charAt(0).toUpperCase() + state.slice(1);
export const date = (time: number) => new Date(time).toLocaleString('en-GB', { timeZone: 'UTC', hour12: false }) + ' UTC';
/** One short date style for lists and tooltips: no seconds, always UTC. */
export const shortDate = (time: number) => new Date(time).toLocaleString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) + ' UTC';
export const shortDay = (time: number) => new Date(time).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
export function relative(time: number, now = Date.now()) {
  const minutes = Math.floor(Math.max(0, now - time) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d ago` : new Date(time).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
}
export function displayFile(value: string) {
  try { const url = new URL(value); return url.origin === location.origin ? url.pathname : value; } catch { return value; }
}
export function download(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([typeof value === 'string' ? value : JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const errorId = useId(), [error, setError] = useState('');
  return <label className="form-field"><span>{label}</span><input {...props} aria-invalid={!!error || props['aria-invalid']} aria-describedby={error ? errorId : props['aria-describedby']} onInvalid={event => { setError(event.currentTarget.validationMessage); props.onInvalid?.(event); }} onInput={event => { if (event.currentTarget.validity.valid) setError(''); props.onInput?.(event); }} />{error && <span id={errorId} className="field-error" role="alert">{error}</span>}</label>;
}
const Drafts = createContext<Map<string, unknown> | null>(null);
export function DraftProvider({ children }: { children: ReactNode }) {
  const drafts = useRef(new Map<string, unknown>());
  useEffect(() => { const clear = () => drafts.current.clear(); window.addEventListener('spool-session-expired', clear); return () => window.removeEventListener('spool-session-expired', clear); }, []);
  return <Drafts.Provider value={drafts.current}>{children}</Drafts.Provider>;
}
// Memory only: a draft survives in-app navigation, and disappears at sign-out.
export function useDraft<T,>(key: string, initial: T) {
  const drafts = useContext(Drafts);
  const [value, update] = useState<T>(() => drafts?.has(key) ? drafts.get(key) as T : initial);
  const current = useRef(value); current.current = value;
  function set(next: T | ((previous: T) => T)) {
    const result = typeof next === 'function' ? (next as (previous: T) => T)(current.current) : next;
    current.current = result; drafts?.set(key, result); update(result);
  }
  return [value, set] as const;
}
