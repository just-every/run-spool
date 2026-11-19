import { DownloadBackup } from './DownloadBackup';
import { useRef } from 'react';
import { Details } from './Details';
import { download, useDraft, type Run } from './shared';
import { restoreRefusal } from './restore-refusal';
import { ArchivePreview } from './ArchivePreview';
import { ownerFetch } from './client';
export function ArchiveSettings({ busy, empty, run, refresh, allowDownload = true }: { busy: boolean; empty: boolean; run: Run; refresh: () => void; allowDownload?: boolean }) {
  const selection = useRef(0);
  const [restore, setRestore] = useDraft<any>('archive-restore', null), [error, setError] = useDraft('archive-error', ''), [result, setResult] = useDraft('archive-result', '');
  return <section className="evidence"><h2>{allowDownload ? 'Archive and restore' : 'Choose your private archive'}</h2>
    <p>Archives exclude owner sessions and project credential grants. Private source maps are exported and restored verbatim, including any keys written into their embedded source (<code>sourcesContent</code>).</p>
    <p>Restore requires an empty installation. Create new project keys after restoring.</p>
    {allowDownload && <DownloadBackup {...{busy,run}}/>}
    <label className="form-field">Archive to restore · max 16 MiB<input type="file" accept=".json,.jsonl,application/json,application/x-ndjson" aria-invalid={!!error} aria-describedby={error ? 'archive-error' : undefined} onChange={event => {
      const current = ++selection.current, file = event.target.files?.[0]; setRestore(null); setError(''); if (!file) return;
      void (async () => { try { if (file.size > 16 * 1024 * 1024) throw new Error('Use the local import command for archives over 16 MiB.'); const text = await file.text(); let preview: any; try { preview = JSON.parse(text.split('\n')[0]); if (preview.kind !== 'manifest') preview = JSON.parse(text); } catch { throw new Error('This file is not a readable Spool archive. Choose a private archive downloaded from Spool, or download it again.'); }
        if (!(preview.kind === 'manifest' && preview.format === 'runeditrun-portability' && Array.isArray(preview.tables)) && !([1, 2].includes(preview.version) && Array.isArray(preview.data?.projects) && typeof preview.checksum === 'string')) throw new Error('This file is not a readable Spool archive. Choose a private archive downloaded from Spool, or download it again.');
        if (selection.current === current) setRestore({ text, name: file.name, preview });
      } catch (failure) { if (selection.current === current) setError((failure as Error).message); } })();
    }} /></label>{error && <p role="alert" id="archive-error">{error}</p>}{restore && <><p>Selected {restore.name}. {empty ? 'This installation is empty and ready for server validation.' : 'This installation contains data. Restore requires an empty installation.'} The server checks integrity and references before restoring.</p><Details title="Archive preview"><ArchivePreview manifest={restore.preview} empty={empty} /><button className="text-button" onClick={() => download(restore.preview, 'spool-archive-manifest.json')}>Download raw manifest</button></Details></>}
    <button className="primary-button" disabled={busy || !restore || !empty} onClick={() => void run(async () => { const response = await ownerFetch('/api/restore', { method: 'POST', headers: { 'Content-Type': 'application/x-ndjson', 'X-Confirm-Restore': 'yes' }, body: restore.text }); if (!response.ok) { const failure: any = await response.json().catch(() => null); throw new Error(restoreRefusal(failure?.error, response.status)); } setRestore(null); setResult('Archive restored. Create new project keys before capture.'); refresh(); })}>Restore into empty installation</button>{result && <p role="status">{result}</p>}
  </section>;
}
