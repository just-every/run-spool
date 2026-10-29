import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { hrefFor } from './location';
import { credentialsRemoved, goneByKind, plural, reasonGroups, recordLines, resultSentence, resultTable, reviewTable, totals, unmappedFields, words, type FileFacts, type Labels, type Plan, type Reconcile, type Rejected } from './move-in-model';

/** A native fold: the label at the left, its muted summary at the right and a down chevron. */
export function Fold({ label, summary, children }: { label: string; summary?: string; children: ReactNode }) {
  return <details className="move-in-fold"><summary><span>{label}</span>{summary && <span className="muted">{summary}</span>}</summary><div className="move-in-fold-body">{children}</div></details>;
}
const List = ({ rows }: { rows: string[] }) => <ul className="move-in-list">{rows.map((row, index) => <li key={index}>{row}</li>)}</ul>;

/** One `<table>` for both widths: at 760 px and below CSS turns each kind into one row of words. */
function KindTable({ caption, columns, rows }: { caption: string; columns: [string, string][]; rows: { label: string; values: number[] }[] }) {
  return <div className="table-region"><table className="data-table move-in-kinds"><caption className="visually-hidden">{caption}</caption>
    <thead><tr><th scope="col">Kind</th>{columns.map(([label]) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
    <tbody>{rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th>{row.values.map((value, index) => <td key={columns[index][0]} data-unit={columns[index][1]}>{value}</td>)}</tr>)}</tbody>
  </table></div>;
}

function NotImported({ rows, labels }: { rows: Rejected[]; labels: Labels }) {
  const groups = reasonGroups(rows);
  return rows.length ? <Fold label="Not imported" summary={`${plural(rows.length, 'record')} · ${plural(groups.length, 'reason')}`}>
    {groups.map(group => <div className="move-in-reason" key={group.code}>
      <p>{labels[group.code] ?? labels.record_not_importable} · {plural(group.records.length, 'record')}</p>
      <details className="move-in-records"><summary>Show records</summary><List rows={recordLines(group.records, labels)} /></details>
    </div>)}
  </Fold> : null;
}
function NotKept({ plan, omissions }: { plan: Plan; omissions: string[] }) {
  const fields = unmappedFields(plan);
  return fields.length || omissions.length ? <Fold label="Not kept in Spool" summary={plural(fields.length, 'Sentry field')}>
    {!!fields.length && <><p>{words.unmapped}</p><List rows={fields} /></>}
    {!!omissions.length && <><p>The export itself left out:</p><List rows={omissions} /></>}
    <p>{words.inert}</p>
  </Fold> : null;
}
function Credentials({ plan }: { plan: Plan }) {
  const removed = credentialsRemoved(plan);
  return removed ? <Fold label="Credentials removed" summary={plural(removed, 'value')}>
    <p>Spool removed {plural(removed, 'credential value')} and keeps no copy of the original file.</p>
  </Fold> : null;
}
function Technical({ plan, fingerprint }: { plan: Plan; fingerprint?: string }) {
  return <Fold label="Technical details"><dl className="move-in-technical">
    {fingerprint && <div><dt>Fingerprint</dt><dd><code>{fingerprint}</code></dd></div>}
    <div><dt>File SHA-256</dt><dd><code>{plan.bundleSha256}</code></dd></div>
    <div><dt>Records read</dt><dd>{plan.counts.input}</dd></div>
    <div><dt>Repeats counted once</dt><dd>{plan.counts.duplicates}</dd></div>
    <div><dt>Rows written on apply</dt><dd>{plan.counts.effects}</dd></div>
  </dl></Fold>;
}

/** What applying changes: the totals sentence, the kind × outcome table and the folds. */
export function MoveInChanges({ plan, catchup, facts }: { plan: Plan; catchup: boolean; facts?: FileFacts }) {
  const labels = plan.reasonLabels, table = reviewTable(plan);
  const edited = plan.rejected.filter(row => row.reasonCode === 'native_edit_conflict');
  const columns: [string, string][] = catchup ? [['New', 'new'], ['Updated', 'updated'], ['Unchanged', 'unchanged'], ['Not imported', 'not imported']] : [['New', 'new'], ['Not imported', 'not imported']];
  return <section className="evidence" aria-labelledby="move-in-changes">
    <h2 id="move-in-changes" tabIndex={-1}>What applying changes</h2>
    <p>{totals(plan, catchup)}</p>
    <KindTable caption="Records by kind and what applying does with them" columns={columns}
      rows={table.map(row => ({ label: row.label, values: catchup ? [row.created, row.updated, row.unchanged, row.rejected] : [row.created, row.rejected] }))} />
    <div className="move-in-folds">
      {catchup && !!plan.differences.gone.length && <Fold label="No longer in the export" summary={`${plan.differences.gone.length} kept in Spool, nothing is deleted`}>
        <List rows={goneByKind(plan)} />
      </Fold>}
      {catchup && !!edited.length && <Fold label="Edited in Spool since your last import" summary={`${edited.length} kept as edited`}>
        <List rows={recordLines(edited, labels)} />
      </Fold>}
      <NotImported rows={plan.rejected.filter(row => !catchup || row.reasonCode !== 'native_edit_conflict')} labels={labels} />
      <NotKept plan={plan} omissions={facts?.omissions ?? []} />
      <Credentials plan={plan} />
      <Technical plan={plan} />
    </div>
  </section>;
}

/** What was imported: Spool's own check, the imported projects and the way into them. */
export function MoveInResult({ report, plan, rejected, projects, facts }: { report: Reconcile; plan?: Plan; rejected: Rejected[]; projects: { id: string; name: string }[]; facts?: FileFacts }) {
  const table = resultTable(report, { rejected, unchanged: plan?.differences.unchanged }), mismatched = table.some(row => row.mismatched);
  const columns: [string, string][] = [['In Spool', 'in Spool'], ['Not imported', 'not imported'], ...mismatched ? [["Doesn't match", "don't match"] as [string, string]] : []];
  const imported = (report.projectIds ?? []).map(id => ({ id, name: projects.find(project => project.id === id)?.name })), first = imported[0];
  return <section className="evidence" aria-labelledby="move-in-imported">
    <h2 id="move-in-imported" tabIndex={-1}>What was imported</h2>
    <p>{resultSentence(report)}</p>
    <p className="muted">{words.checked}</p>
    <KindTable caption="Records by kind as Spool holds them now" columns={columns}
      rows={table.map(row => ({ label: row.label, values: [row.present, row.explained, ...mismatched ? [row.mismatched] : []] }))} />
    {!!imported.length && <div className="move-in-projects"><p className="move-in-label">Imported projects</p>
      <p>{imported.map(project => <Link key={project.id} className="inline-link" to={hrefFor(project.id, 'issues') as any}>{project.name ?? project.id}</Link>)}</p>
    </div>}
    {first?.name && <><Link className="primary-button" to={hrefFor(first.id, 'issues') as any}>Open imported issues</Link>
      <p className="muted move-in-consequence">Opens {first.name} in Issues.{imported.length > 1 ? ' The others are linked above.' : ''}</p></>}
    {!imported.length && report.projectIdsReasonCode && <p className="muted">{report.reasonLabels[report.projectIdsReasonCode]}</p>}
    {plan && <div className="move-in-folds">
      <NotImported rows={plan.rejected} labels={plan.reasonLabels} />
      <NotKept plan={plan} omissions={facts?.omissions ?? []} />
      <Credentials plan={plan} />
      <Technical plan={plan} fingerprint={plan.fingerprint} />
    </div>}
  </section>;
}
