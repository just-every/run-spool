export type ScrubbingPreviewResult = {
  token: string | null;
  refusal: string | null;
  revision: number;
  installationRevision: number;
  matches: {selector: string; fields: number}[];
  sample: object[];
  coverage: {scanned: number; total: number};
};

export function ScrubbingPreview({preview, scope}: {preview: ScrubbingPreviewResult; scope: 'project' | 'installation'}) {
  return <div className="callout" aria-label="Scrubbing preview">
    <h3>Scrubbing preview</h3>
    <p>{scope === 'project' ? 'Project' : 'Installation'} revision {preview.revision} · Installation revision {preview.installationRevision}.</p>
    <p>Coverage: {preview.coverage.scanned} of {preview.coverage.total} retained events scanned. Counts apply to scanned evidence; fields already removed cannot be previewed.</p>
    {preview.refusal && <p role="alert">Preview refused: {preview.refusal}</p>}
    <h3>Matches by selector</h3>
    {preview.matches.length ? <ul style={{overflowWrap: 'anywhere'}}>{preview.matches.map((match, index) =>
      <li key={`${match.selector}:${index}`}><code>{match.selector}</code>: {match.fields} matching fields</li>
    )}</ul> : <p>No selector matches in the scanned evidence.</p>}
    <h3>Masked sample projection</h3>
    <p>This projection shows the proposed scrubbing on retained samples. Saving changes later intake only.</p>
    {preview.sample.length ? <pre style={{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 13}}>{JSON.stringify(preview.sample, null, 2)}</pre>
      : <p>No retained sample is available for this preview.</p>}
  </div>;
}
