export function GroupingRulePreview({ preview }: { preview: any }) {
  const rows = preview.rows;
  return <div className="callout grouping-explanation">
    <h3>Retained-event preview</h3>
    <p>Reviewed against active revision {preview.revision}.</p>
    <p>{rows.length} scanned · {rows.filter((row: any) => row.eligible && row.changed).length} change grouping · {rows.filter((row: any) => !row.eligible).length} imported events keep their source grouping.</p>
    <p>Historical regrouping requires selecting occurrences in the issue’s split or merge correction preview. Saving rules alone never rewrites history, alert rates or repair evidence.</p>
    {preview.behavior && <p>{preview.behavior}</p>}
    <details><summary>Exact event grouping results ({rows.length})</summary>
      <ol>{rows.map((row: any) => <li key={row.event}>
        <p>Event <code>{row.event}</code> · occurrence <code>{row.occurrence}</code></p>
        <p><code>{row.issue}</code> → <code>{row.destination ?? row.issue}</code> · {row.eligible ? row.changed ? 'Changes grouping on later intake' : 'Same grouping' : row.reason}</p>
        {row.explanation && <pre>{JSON.stringify(row.explanation, null, 2)}</pre>}
      </li>)}</ol>
    </details>
  </div>;
}
