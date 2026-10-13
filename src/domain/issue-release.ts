// Native v1/v2 archives have lost the independent issue release watermark.
// Their registered project ceiling is a conservative baseline, not an observed
// issue occurrence. A subsequent known old release must never become a regression.
export function legacyIssueReleases(data:any) {
 const ceilings=new Map<string,number>();
 for(const release of data.releases)ceilings.set(release.project,Math.max(ceilings.get(release.project)??0,release.seq));
 return {...data,issues:data.issues.map((issue:any)=>{
  const latest_release_seq=ceilings.get(issue.project)??0;
  return {...issue,latest_release_seq,resolved_seq:issue.state==='resolved'?Math.max(issue.resolved_seq??0,latest_release_seq):issue.resolved_seq};
 })};
}

export function validateIssueReleases(data:any) {
 const ceilings=new Map<string,number>(),observed=new Map<string,number>();
 for(const release of data.releases)ceilings.set(release.project,Math.max(ceilings.get(release.project)??0,release.seq));
 for(const event of data.events)observed.set(event.issue,Math.max(observed.get(event.issue)??0,event.release_seq));
 for(const issue of data.issues){
  const seq=issue.latest_release_seq,ceiling=ceilings.get(issue.project)??0;
  if(seq!==null&&(!Number.isSafeInteger(seq)||seq<Math.max(observed.get(issue.id)??0,issue.resolved_seq??0)||seq>ceiling))throw new Error('Archive issue release watermark');
  if(issue.resolved_seq!==null&&(!Number.isSafeInteger(issue.resolved_seq)||issue.resolved_seq<0||issue.resolved_seq>ceiling))throw new Error('Archive resolved release watermark');
 }
}
