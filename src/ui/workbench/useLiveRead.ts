import { useEffect, useRef, type DependencyList } from 'react';

// Quiet reads stop once nobody has used the page for a few minutes; the next use reads again.
const idleAfter = 5 * 60_000;
let lastUse = Date.now(), resting = false;
const resumed = new EventTarget();
if (typeof window !== 'undefined') for (const name of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove'])
  window.addEventListener(name, () => { lastUse = Date.now(); if (resting) { resting = false; resumed.dispatchEvent(new Event('resume')); } }, { passive: true, capture: true });
const inUse = () => { if (Date.now() - lastUse < idleAfter) return true; resting = true; return false; };

/** Read once on entry, then quietly while visible and in use. A return gets one fresh read. */
export function useLiveRead(read: (signal: AbortSignal, background: boolean) => Promise<void>, dependencies: DependencyList, { interval = 60_000, live = true, enabled = true } = {}) {
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
    const schedule = () => { timer = window.setInterval(() => { if (document.visibilityState === 'visible' && inUse()) void update(true); }, interval); };
    const focused = () => { if (document.visibilityState === 'visible') { lastUse = Date.now(); resting = false; void update(true); } };
    const visible = () => {
      clearInterval(timer);
      if (document.visibilityState === 'visible') { void update(true); schedule(); }
    };
    void update(false);
    if (live) {
      if (document.visibilityState === 'visible') schedule();
      document.addEventListener('visibilitychange', visible);
      window.addEventListener('focus', focused);
      resumed.addEventListener('resume', focused);
    }
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', visible); window.removeEventListener('focus', focused); resumed.removeEventListener('resume', focused); };
  }, [...dependencies, interval, live, enabled]);
}
