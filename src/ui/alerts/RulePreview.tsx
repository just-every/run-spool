import { date, status } from './client';

type Sample = {
 start?: number | string;
 end?: number | string;
 issue?: string;
 count?: number;
 reason?: string;
 reasons?: string[];
 history?: Sample[];
 excluded?: Sample[];
 loss?: Sample[];
 [key: string]: unknown;
};
export type Preview = {
 token: string | null;
 refusal: string | null;
 owner: string;
 destination: string;
 window: { from: number | string; to: number | string; durationMs: number };
 transitions: Sample[];
 matchedEvents: number;
 decisions: Sample[];
 coverage?: string;
};
function time(value: number | string) {
 return date(typeof value === 'number' ? value : Date.parse(value));
}
function SampleFacts({ sample }: { sample: Sample }) {
 const facts = Object.entries(sample).filter(([key, value]) =>
  !['start', 'end', 'issue', 'reason'].includes(key) && value !== null && ['string', 'number', 'boolean'].includes(typeof value));
 return <>
  {sample.issue && <strong className="alert-id">{sample.issue}</strong>}
  {sample.start !== undefined && sample.end !== undefined && <p>{time(sample.start)} – {time(sample.end)}</p>}
  {sample.reason && <p>{status(sample.reason)}</p>}
  {sample.reasons?.length ? <p>{sample.reasons.map(status).join(', ')}</p> : null}
  {facts.length > 0 && <p>{facts.map(([key, value]) => `${status(key.replace(/([a-z])([A-Z])/g, '$1 $2'))}: ${value}`).join(' · ')}</p>}
  {([['history', 'Comparable history'], ['excluded', 'Excluded windows'], ['loss', 'Recorded capture loss']] as const).map(([key, label]) => sample[key]?.length ? <details key={key}><summary>{label} ({sample[key]!.length})</summary>
   <ul className="alert-records">{sample[key]!.map((row, index) => <li key={index}><div><SampleFacts sample={row}/></div></li>)}</ul>
  </details> : null)}
 </>;
}
export function RulePreview({ preview, recorded = false }: { preview: Preview; recorded?: boolean }) {
 return <section aria-label="Rule preview" style={{ gridColumn: '1 / -1', minWidth: 0 }}>
  <h3>{recorded ? 'Recorded evaluation' : 'Rule preview'}</h3>
  <p>Owner: {preview.owner} · Destination: <span className="alert-id">{preview.destination}</span></p>
  <p>Sample: {time(preview.window.from)} – {time(preview.window.to)} · {preview.window.durationMs / 60000} minute windows · {preview.matchedEvents} matching accepted events</p>
  {preview.coverage && <p className="muted">{preview.coverage}</p>}
  {!recorded && (preview.refusal
   ? <p role="alert" className="callout">{status(preview.refusal)}</p>
   : <p role="status">Preview ready. Enabling starts future complete windows; history is never replayed.</p>)}
  {!recorded && <><h4>Matching transitions ({preview.transitions.length})</h4>
  {preview.transitions.length === 0 ? <p>No transitions in this sample.</p>
   : <ul className="alert-records">{preview.transitions.map((sample, index) => <li key={index}><div><SampleFacts sample={sample}/></div></li>)}</ul>}</>}
  {preview.decisions.length > 0 && <details><summary>Window decisions ({preview.decisions.length})</summary>
   <ul className="alert-records">{preview.decisions.map((sample, index) => <li key={index}><div><SampleFacts sample={sample}/></div></li>)}</ul>
  </details>}
 </section>;
}
