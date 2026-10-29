import { Confirm } from './MoveInBand';
import { Fold } from './MoveInPlan';
import { caption, chips, failureWords, historyName, plural, words, type HistoryRow, type Imports } from './move-in-model';

/** Move in's History: every door import, the owner's and Business's, newest
 * first. Undo sits on the newest completed import of each organization while
 * nothing blocks it, whichever authority approved it and with Business on or off. */
export function History({ imports, held, onUndo }: { imports: Imports; held?: string[]; onUndo: (row: HistoryRow) => void }) {
  const newest = new Set<string>(), seen = new Set<string>();
  for (const row of imports.history) if (row.state === 'completed' && !seen.has(row.namespace)) { seen.add(row.namespace); newest.add(row.planId); }
  return <section className="evidence" aria-labelledby="move-in-history"><h2 id="move-in-history">History</h2>
    {!imports.history.length ? <p>No imports yet.</p> : <div className="table-region move-in-rows">{imports.history.map(row => <div className="move-in-row move-in-history-row" key={row.planId}>
      <div className="move-in-row-name"><strong>{historyName(row)}</strong><p className="muted">{caption(row, row.approvedAt)}</p>{held?.includes(row.planId) && <p className="muted">Holds records this file writes.</p>}</div>
      <div className="move-in-row-state"><span className="state-chip">{chips[row.state] ?? row.state}</span>
        <span>{row.counts ? plural(row.counts.effects, 'record') : imports.reasonLabels[row.countsReasonCode ?? '']}{row.state === 'failed' ? ` · ${failureWords(row.failureCode)}` : ''}</span></div>
      {newest.has(row.planId) && row.undo.available && <Confirm opener="Undo this import" question={words.confirmUndo} confirm="Undo this import" keep="Keep the import" onConfirm={() => onUndo(row)} />}
      <details className="move-in-details"><summary>Technical details</summary><dl className="move-in-technical">
        <div><dt>Fingerprint</dt><dd><code>{row.fingerprint}</code></dd></div><div><dt>Plan ID</dt><dd>{row.planId}</dd></div><div><dt>Job ID</dt><dd>{row.jobId}</dd></div>
      </dl></details>
    </div>)}</div>}
  </section>;
}

/** Business imports: one chip and its sentence, the switch, and the trusted keys. */
export function BusinessImports({ imports, onSettings }: { imports: Imports; onSettings: (change: { enabled: boolean; revokedKids?: string[] }) => void }) {
  const revoked = imports.keys.filter(key => key.revoked).map(key => key.kid);
  const [chip, sentence] = !imports.configured ? ['Unavailable', words.businessUnavailable] : imports.enabled ? ['On', words.businessOn] : ['Off', words.businessOff];
  return <section className="evidence" aria-labelledby="move-in-business"><h2 id="move-in-business">Business imports</h2>
    <p className="move-in-chip-line"><span className="state-chip">{chip}</span> <span>{sentence}</span></p>
    {imports.configured && <button className="text-button" onClick={() => onSettings({ enabled: !imports.enabled })}>{imports.enabled ? 'Turn off Business imports' : 'Turn on Business imports'}</button>}
    {imports.configured && !imports.enabled && <p className="muted">Business can then upload, plan and apply here. Each apply carries your approval from Business.</p>}
    {!!imports.keys.length && <div className="move-in-folds"><Fold label="Trusted keys" summary={plural(imports.keys.length, 'key')}>
      {imports.keys.map(key => <div className="move-in-row move-in-key" key={key.kid}>
        <span>RER signing key · {key.revoked ? 'Revoked' : 'Trusted'} · <code>{key.kid}</code></span>
        {!key.revoked && <Confirm opener="Revoke key" detail={<p><code>{key.kid}</code></p>} question={words.revoke} confirm="Revoke key" keep="Keep the key"
          onConfirm={() => onSettings({ enabled: imports.enabled, revokedKids: [...revoked, key.kid] })} />}
      </div>)}
      {imports.keys.some(key => key.name === null) && <p className="muted">{imports.reasonLabels.key_metadata_not_provided}</p>}
    </Fold></div>}
  </section>;
}
