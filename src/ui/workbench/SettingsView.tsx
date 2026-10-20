import { AuditHistory } from './AuditHistory';
import { ReleasePolicy } from './ReleasePolicy';
import { GroupingRules } from './GroupingRules';
import { GroupingProposals } from './GroupingProposals';
import { useEffect, useState } from 'react';
import { ArchiveSettings } from './ArchiveSettings';
import { RetentionSettings } from './RetentionSettings';
import { ProjectErasure } from './ProjectErasure';
import { ProjectForm } from './ProjectForm';
import { InboundFilters } from './InboundFilters';
import { FeedbackPanel } from './FeedbackPanel';
import { Details } from './Details';
import { OriginStep, SdkSetup, SentryIntake } from './SdkSetup';
import { SchedulerStatus } from './SchedulerStatus';
import { BusinessImports } from './BusinessImports';
import { date, type Request, type Run } from './shared';
export function SettingsView({ project, projects, keys, releases, request, run, busy, refresh, onCreated, onKey }: {
  project: string; projects: any[]; keys: any[]; releases: any[]; request: Request; run: Run; busy: boolean; refresh: () => void; onCreated: (project: any) => void; onKey: (grant: { key: string; dsn?: string; kind: string }) => void;
}) {
  const [endpoint, setEndpoint] = useState('');
  const [rulePreview, setRulePreview] = useState<any>(null);
  const [proposalVersion, setProposalVersion] = useState(0);
  useEffect(() => { setRulePreview(null); }, [project]);
  useEffect(() => { setEndpoint(location.origin); }, []);
  const agentRow = keys.findIndex(key => key.kind === 'agent' && !key.revoked);
  return <>
    <section className="evidence"><h2>{projects.length ? 'Create another project' : 'Create your first project'}</h2><ProjectForm {...{ request, run, busy, onCreated }} /></section>
    {!!project && <section className="evidence"><h2>Project keys</h2><p>Capture keys send events. Agent keys read this project’s evidence and submit inert grouping proposals; decisions and apply require the owner. Deploy keys only register releases and upload source maps for this project.</p><p>Archives exclude project keys. After restoring, create new keys for this installation.</p>{!keys.length && <p>No project keys have been created here.</p>}<div className="button-row">{['ingest', 'agent', 'deploy'].map(kind => <button key={kind} className="text-button" disabled={busy} onClick={() => void run(async () => { const grant = await request(`/api/projects/${project}/keys`, 'POST', { kind }); onKey({ ...grant, kind }); refresh(); })}>Create {kind} key</button>)}</div>{keys.map((key, index) => <div className="data-row key-row" key={key.hash}><span><span className={index === agentRow ? 'mark' : undefined}>{key.kind === 'agent' ? 'Agent' : key.kind === 'deploy' ? 'Deploy' : 'Capture'}</span> · {key.revoked ? 'Revoked' : 'Active'}</span><code>{key.hash.slice(0, 12)}…</code><span>Created {date(key.created)}</span><Details title="Project key"><pre>{JSON.stringify(key, null, 2)}</pre>{!key.revoked && <button className="danger-button" disabled={busy} onClick={() => void run(async () => { await request(`/api/projects/${project}/keys/${key.hash}`, 'DELETE'); refresh(); })}>Revoke key</button>}</Details></div>)}</section>}
    {!!project && <section className="evidence"><h2>Send errors to this project</h2>{endpoint && <SdkSetup endpoint={endpoint} project={project} ingestKey="YOUR_INGEST_KEY" release={releases[0]?.name ?? 'REGISTERED_RELEASE'} build={releases[0]?.build ?? 'REGISTERED_BUILD'} />}<OriginStep key={project} project={project} request={request} /><SentryIntake /></section>}
    {!!project&&<GroupingRules key={`grouping:${project}`} {...{project,request,run,busy}} approvedPreview={rulePreview?.project===project?rulePreview.preview:null} onSaved={()=>{setProposalVersion(value=>value+1);refresh();}}/>}
    {!!project&&<GroupingProposals key={`proposals:${project}`} {...{project,request,run,busy,refresh}} refreshVersion={proposalVersion} onRulePreview={preview=>setRulePreview({project,preview})}/>}
    {!!project&&<ReleasePolicy key={`release-policy:${project}`} {...{project,request,run,busy}}/>}
    <SchedulerStatus />
    {!!project&&<FeedbackPanel key={`feedback:${project}`} {...{project,request,run,busy}}/>}
    {!!project&&<InboundFilters key={project} {...{project,request,run,busy}}/>}
    <BusinessImports {...{ request, run, busy }} />
    <AuditHistory {...{request,run,busy}} />
    <ArchiveSettings busy={busy} empty={!projects.length} run={run} refresh={refresh} />
    {!!project && <RetentionSettings {...{ project, request, run, busy, refresh }} />}
    {!!project && <ProjectErasure key={project} {...{ project, request, run, busy }} />}
  </>;
}
