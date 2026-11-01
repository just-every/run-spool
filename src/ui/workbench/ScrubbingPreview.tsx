import {refusalMessage,type RefusalTarget} from '../../domain/scrubbing/refusal';
export type ScrubbingPreviewResult = {
 token:string|null; refusal:string|null; refusalTarget?:RefusalTarget;
 revision:number; installationRevision:number;
 matches:{selector:string;fields:number}[];
 sample:{received:number;fields:{path:string;selector:string;method:string}[]}[];
 coverage:{scanned:number;total:number}|null;
};
export function fieldLabel(path:string){
 const words=path.replace(/^sentry\./,'').replace(/^tags\./,'Tag ').replace(/^extra\./,'Extra field ').replace(/^user\./,'User ').replace(/.*\.vars\./,'Frame variable ').replaceAll('_',' ').replaceAll('.',' ');
 return words.charAt(0).toUpperCase()+words.slice(1);
}
export function ScrubbingPreview({preview}: {preview:ScrubbingPreviewResult;scope:'project'|'installation'}) {
 if(preview.refusal)return <div className="callout" aria-label="Scrubbing preview"><h3>Not previewed</h3>
 {!preview.refusalTarget&&<p role="alert">{refusalMessage(preview.refusal)}</p>}</div>;
 return <div className="callout" aria-label="Scrubbing preview">
 <h3>Scrubbing preview</h3>
 {preview.coverage?.total ? <>
 <p>Coverage: {preview.coverage.scanned} of {preview.coverage.total} retained events scanned.</p>
 <h4>Matched fields</h4>
 {preview.matches.length?<ul>{preview.matches.map(match=><li key={match.selector}>{match.selector}: {match.fields} matching fields</li>)}</ul>:<p>No selector matches.</p>}
 <h4>Sample fields</h4>
 {preview.sample.map((sample,index)=><div key={index}><time>{new Date(sample.received).toLocaleString('en-GB',{timeZone:'UTC'})} UTC</time>
 <ul aria-label="Sample matched fields">{sample.fields.slice(0,10).map((field,i)=><li key={i} data-field-path={field.path}>{fieldLabel(field.path)} · {({remove:'removed',mask:'masked',hash:'hashed',replace:'replaced'} as Record<string,string>)[field.method]}</li>)}</ul>
 {sample.fields.length>10&&<p>and {sample.fields.length-10} more fields</p>}</div>)}
 </>:<p>No retained events to preview yet.</p>}
 </div>;
}
