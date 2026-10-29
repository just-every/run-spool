import { useEffect, useRef, useState } from 'react';

/** A setting whose change has outside effects previews itself as it changes, so the owner is asked once, under the
 * field, with the preview in view. The result belongs to the exact draft it previewed; a newer draft clears it. */
export function useAutoPreview<T>(draft: T, changed: boolean, preview: (draft: T) => Promise<any>, delay = 450) {
  const key = JSON.stringify(draft), latest = useRef(preview);
  latest.current = preview;
  const [result, setResult] = useState<{ key: string; value: any } | null>(null), [error, setError] = useState(''), [pending, setPending] = useState(false);
  useEffect(() => {
    setError('');
    if (!changed) { setPending(false); return; }
    let alive = true; setPending(true);
    const timer = window.setTimeout(() => { latest.current(draft).then(value => { if (alive) setResult({ key, value }); }, failure => { if (alive) setError((failure as Error).message); }).finally(() => { if (alive) setPending(false); }); }, delay);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [key, changed]);
  return { preview: changed && result?.key === key ? result.value : null, error, pending, clear: () => setResult(null) };
}

/** Quiet save state beside a setting: Saving…, Saved, or the failure with Retry; the value stays as typed. */
export function useSaveState() {
  const [state, setState] = useState<{ phase: 'idle' | 'saving' | 'saved' | 'failed'; message?: string; retry?: () => void }>({ phase: 'idle' });
  async function save(work: () => Promise<void>) {
    setState({ phase: 'saving' });
    try { await work(); setState({ phase: 'saved' }); }
    catch (failure) { setState({ phase: 'failed', message: (failure as Error).message, retry: () => void save(work) }); }
  }
  return { state, save };
}
