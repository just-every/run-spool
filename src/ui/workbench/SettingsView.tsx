import { KeyRateLimit } from './KeyRateLimit';
import {RecurrencePolicy} from './RecurrencePolicy';
import {SlackDestinationForm} from '../alerts/SlackDestinationForm';
import {IdentityPolicy} from './IdentityPolicy';
import { LoaderSettings } from './LoaderSettings';
import { CheckInRoutes } from './CheckInRoutes';
import { AuditHistory } from './AuditHistory';
import { ReleasePolicy } from './ReleasePolicy';
import { ReportsConfiguration } from './ReportsConfiguration';
import { CommitSharing } from './CommitSharing';
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
import { Members, type OrganizationAccess } from './Members';
export function SettingsView({ project, projects, keys, releases, request, run, busy, refresh, onCreated, onKey, access, revision }: {
  access: OrganizationAccess; revision: number; project: string; projects: any[]; keys: any[]; releases: any[]; request: Request; run: Run; busy: boolean; refresh: () => void; onCreated: (project: any) => void; onKey: (grant: { key: string; dsn?: string; kind: string }) => void;
}) {
  const [endpoint, setEndpoint] = useState('');
  const [rulePreview, setRulePreview] = useState<any>(null);
  const [proposalVersion, setProposalVersion] = useState(0);
  useEffect(() => { setRulePreview(null); }, [project]);
  useEffect(() => { setEndpoint(location.origin); }, []);
  const organizationManager = access.role === 'owner' || access.role === 'admin';
  const projectRole = projects.find(row => row.id === project)?.role ?? access.projects.find(row => row.id === project)?.role;
  const configure = organizationManager || projectRole === 'maintainer';
  const credentialKinds = configure ? ['ingest', 'agent', 'deploy'] : projectRole === 'member' ? ['deploy'] : [];
  const agentRow = keys.findIndex(key => key.kind === 'agent' && !key.revoked);
  return <>
    <Members {...{ access, revision, refresh, request, run, busy }} />
    {organizationManager && <section className="evidence"><h2>{projects.length ? 'Create another project' : 'Create your first project'}</h2><ProjectForm {...{ request, run, busy, onCreated }} /></section>}
    {!!project && <section className="evidence"><h2>Project keys</h2><p>Capture keys send events. Agent keys read this project’s evidence and submit inert grouping proposals; decisions and apply require the owner. Deploy keys only register releases and upload source maps for this project.</p><p>Archives exclude project keys. After restoring, create new keys for this installation.</p>{!keys.length && <p>No project keys have been created here.</p>}<div className="button-row">{credentialKinds.map(kind => <button key={kind} className="text-button" disabled={busy} onClick={() => void run(async () => { const grant = await request(`/api/projects/${project}/keys`, 'POST', { kind }); onKey({ ...grant, kind }); refresh(); })}>Create {kind} key</button>)}</div>{keys.map((key, index) => <div className="data-row key-row" key={key.hash}><span><span className={index === agentRow ? 'mark' : undefined}>{key.kind === 'agent' ? 'Agent' : key.kind === 'deploy' ? 'Deploy' : 'Capture'}</span> · {key.revoked ? 'Revoked' : key.stopped ? 'Stopped' : 'Active'}</span><code>{key.hash.slice(0, 12)}…</code><span>Created {date(key.created)}</span><Details title="Project key"><pre>{JSON.stringify(key, null, 2)}</pre>{configure && key.kind === 'ingest' && !key.revoked && !key.stopped && <><LoaderSettings project={project} keyHash={key.hash} {...{request,run,busy}} />{organizationManager&&<KeyRateLimit project={project} keyHash={key.hash} {...{request,run,busy}} />}</>}{!key.revoked && (configure || (projectRole === 'member' && key.kind === 'deploy')) && <button className="danger-button" disabled={busy} onClick={() => void run(async () => { await request(`/api/projects/${project}/keys/${key.hash}`, 'DELETE'); refresh(); })}>Revoke key</button>}</Details></div>)}</section>}
    {!!project && configure && <ReportsConfiguration key={`reports:${project}`} {...{ project, projects }} />}
    {!!project && configure && <section className="evidence"><h2>Send errors to this project</h2>{endpoint && <SdkSetup endpoint={endpoint} project={project} ingestKey="YOUR_INGEST_KEY" release={releases[0]?.name ?? 'REGISTERED_RELEASE'} build={releases[0]?.build ?? 'REGISTERED_BUILD'} />}<OriginStep key={project} project={project} request={request} /><SentryIntake /></section>}
    {!!project&&configure&&<section className="evidence"><CheckInRoutes key={`check-ins:${project}`} {...{project,request,run,busy}}/></section>}
    {!!project&&configure&&<GroupingRules key={`grouping:${project}`} {...{project,request,run,busy}} approvedPreview={rulePreview?.project===project?rulePreview.preview:null} onSaved={()=>{setProposalVersion(value=>value+1);refresh();}}/>}
    {!!project&&configure&&<GroupingProposals key={`proposals:${project}`} {...{project,request,run,busy,refresh}} refreshVersion={proposalVersion} onRulePreview={preview=>setRulePreview({project,preview})}/>}
    {!!project&&configure&&<SlackDestinationForm key={`slack:${project}`} project={project}/>}
    {!!project&&configure&&<IdentityPolicy key={`identity:${project}`} {...{project,request,run,busy}}/>}
    {!!project&&configure&&<RecurrencePolicy key={`recurrence:${project}`} {...{project,request,run,busy}}/>}
    {!!project&&configure&&<ReleasePolicy key={`release-policy:${project}`} {...{project,request,run,busy}}/>}
    {!!project&&configure&&<CommitSharing key={`commit-sharing:${project}`} {...{project,request,run,busy}}/>}
    {access.role === 'owner' && <SchedulerStatus />}
    {!!project&&organizationManager&&<FeedbackPanel key={`feedback:${project}`} {...{project,request,run,busy}}/>}
    {!!project&&configure&&<InboundFilters key={project} {...{project,request,run,busy}}/>}
    {access.role === 'owner' && <BusinessImports {...{ request, run, busy }} />}
    {organizationManager && <AuditHistory {...{request,run,busy}} />}
    {access.role === 'owner' && <ArchiveSettings busy={busy} empty={!projects.length} run={run} refresh={refresh} />}
    {!!project && configure && <RetentionSettings {...{ project, request, run, busy, refresh }} />}
    {!!project && access.role === 'owner' && <ProjectErasure key={project} {...{ project, request, run, busy }} />}
  </>;
}
