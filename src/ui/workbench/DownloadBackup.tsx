import { useEffect, useRef, useState } from 'react';
import { exportArchive } from './exportArchive';
import { download, type Run } from './shared';

const ARCHIVE_IDLE_MS = 60_000;

type DownloadState = { phase: 'idle' | 'preparing' | 'receiving' } |
  { phase: 'complete' | 'canceled' | 'failed'; message: string };

export function DownloadBackup({ busy, run, label = 'Download private archive' }: { busy: boolean; run: Run; label?: string }) {
  const [state, setState] = useState<DownloadState>({ phase: 'idle' });
  const active = useRef<AbortController | null>(null);
  const pending = state.phase === 'preparing' || state.phase === 'receiving';
  const retry = state.phase === 'failed' || state.phase === 'canceled';

  useEffect(() => () => {
    const request = active.current;
    active.current = null;
    request?.abort();
  }, []);

  function startDownload() {
    if (busy || active.current) return;
    const request = new AbortController();
    active.current = request;
    setState({ phase: 'preparing' });

    void run(async () => {
      const timeout = new DOMException('Archive download timed out', 'TimeoutError');
      let timer: number | undefined;
      function waitForProgress() {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => request.abort(timeout), ARCHIVE_IDLE_MS);
      }

      try {
        let receiving = false;
        const { manifest, text } = await exportArchive(request.signal, () => {
          if (!receiving) { receiving = true; setState({ phase: 'receiving' }); }
          waitForProgress();
        });
        request.signal.throwIfAborted();
        const projects = manifest.tables.find((table: { name: string }) => table.name === 'projects')?.count;
        const day = new Date(manifest.exportedAt).toISOString().slice(0, 10);
        const name = `spool-private-archive-${day}.jsonl`;
        download(text, name);
        setState({ phase: 'complete', message: `Downloaded ${name}${Number.isSafeInteger(projects) ? ` (${projects} ${projects === 1 ? 'project' : 'projects'})` : ''}` });
      } catch {
        if (active.current !== request) return;
        if (request.signal.reason === timeout) {
          setState({ phase: 'failed', message: 'Spool stopped responding during the archive download. Try again.' });
        } else if (request.signal.aborted) {
          setState({ phase: 'canceled', message: 'Archive download canceled.' });
        } else {
          setState({ phase: 'failed', message: navigator.onLine ? 'The archive download failed. Try again.' : 'You’re offline. Reconnect and try the archive download again.' });
        }
      } finally {
        window.clearTimeout(timer);
        if (active.current === request) active.current = null;
      }
    });
  }

  return <div>
    <div className="button-row">
      <button type="button" className="text-button" disabled={busy || pending} onClick={startDownload}>{retry ? 'Retry archive download' : label}</button>
      {pending && <button type="button" className="text-button" onClick={() => active.current?.abort()}>Cancel download</button>}
    </div>
    <div role="status">{state.phase === 'preparing' ? 'Preparing your archive…' : state.phase === 'receiving' ? 'Receiving your archive…' : state.phase === 'complete' || state.phase === 'canceled' ? state.message : ''}</div>
    {state.phase === 'failed' && <p role="alert">{state.message}</p>}
  </div>;
}
