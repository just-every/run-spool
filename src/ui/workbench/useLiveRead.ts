import { useEffect, useRef, type DependencyList } from 'react';

/** Read once on entry, then quietly while visible. A return gets one fresh read. */
export function useLiveRead(read: (signal: AbortSignal, background: boolean) => Promise<void>, dependencies: DependencyList, { interval = 20_000, live = true, enabled = true } = {}) {
  const latest = useRef(read);
  latest.current = read;
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let running = false, timer: number | undefined;
    async function update(background: boolean) {
      if (controller.signal.aborted || running) return;
      running = true;
      try { await latest.current(controller.signal, background); }
      finally { running = false; }
    }
    const schedule = () => { timer = window.setInterval(() => { if (document.visibilityState === 'visible') void update(true); }, interval); };
    const visible = () => {
      clearInterval(timer);
      if (document.visibilityState === 'visible') { void update(true); schedule(); }
    };
    void update(false);
    if (live) {
      if (document.visibilityState === 'visible') schedule();
      document.addEventListener('visibilitychange', visible);
    }
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [...dependencies, interval, live, enabled]);
}
