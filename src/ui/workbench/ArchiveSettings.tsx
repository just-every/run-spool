import { useRef } from 'react';
import { Details } from './Details';
import { download, useDraft, type Run } from './shared';
import { ownerFetch } from './client';
export function ArchiveSettings({ busy, empty, run, refresh }: { busy: boolean; empty: boolean; run: Run; refresh: () => void }) {
  const selection = useRef(0);
  const [restore, setRestore] = useDraft<any>('archive-restore', null), [error, setError] = useDraft('archive-error', ''), [result, setResult] = useDraft('archive-result', '');
  return <section className="evidence"><h2>Archive and restore</h2><p>Archives include private source maps. Owner sessions and credential grants are excluded. Restore requires an empty installation.</p><button className="text-button" disabled={busy} onClick={() => void run(async () => { const response = await ownerFetch('/api/archive', { credentials: 'same-origin' }); if (!response.ok) throw new Error('Archive download failed. Sign in and try again.'); download(await response.text(), 'spool-private-archive.jsonl'); })}>Download private archive</button>
    <label className="form-field">Archive to restore · max 16 MiB<input type="file" accept=".json,.jsonl,application/json,application/x-ndjson" aria-invalid={!!error} aria-describedby={error ? 'archive-error' : undefined} onChange={event => {
      const current = ++selection.current, file = event.target.files?.[0]; setRestore(null); setError(''); if (!file) return;
      void (async () => { try { if (file.size > 16 * 1024 * 1024) throw new Error('Use the local import command for archives over 16 MiB.'); const text = await file.text(); let preview: any; try { preview = JSON.parse(text.split('\n')[0]); if (preview.kind !== 'manifest') preview = JSON.parse(text); } catch { throw new Error('Invalid archive preview structure.'); }
        if (!(preview.kind === 'manifest' && preview.format === 'runeditrun-portability' && Array.isArray(preview.tables)) && !([1, 2].includes(preview.version) && Array.isArray(preview.data?.projects) && typeof preview.checksum === 'string')) throw new Error('Invalid archive preview structure.');
        if (selection.current === current) setRestore({ text, name: file.name, preview });
      } catch (failure) { if (selection.current === current) setError((failure as Error).message); } })();
    }} /></label>{error && <p role="alert" id="archive-error">{error}</p>}{restore && <><p>Ready to restore {restore.name}. The server will check its integrity and references before restoring.</p><Details title="Archive preview"><pre>{JSON.stringify(restore.preview, null, 2)}</pre></Details></>}
    <button className="primary-button" disabled={busy || !restore || !empty} onClick={() => void run(async () => { const response = await ownerFetch('/api/restore', { method: 'POST', headers: { 'Content-Type': 'application/x-ndjson', 'X-Confirm-Restore': 'yes' }, body: restore.text }); if (!response.ok) throw new Error(((await response.json()) as any).error ?? 'Restore failed.'); setRestore(null); setResult('Archive restored. Create new project keys before capture.'); refresh(); })}>Restore into empty installation</button>{result && <p role="status">{result}</p>}
  </section>;
}
