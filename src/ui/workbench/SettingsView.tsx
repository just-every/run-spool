import { ProjectKeyFacts, keyKind, keyStatus } from './ProjectKeyFacts';
import {PersonalNotifications} from './PersonalNotifications';
import { KeyRateLimit } from './KeyRateLimit';
import {RecurrencePolicy} from './RecurrencePolicy';
import {ScrubbingRules} from './ScrubbingRules';
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
import { hrefFor } from './location';
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

const settingsSections = [
  { id: 'organization', label: 'Organization', fragments: [] },
  { id: 'projects', label: 'Projects & keys', fragments: ['reports-configuration-title', 'origin-step-help'] },
  { id: 'processing', label: 'Issue processing', fragments: ['grouping-rules-heading', 'grouping-proposals-heading', 'recurrence-policy-title', 'release-policy-title', 'commit-sharing-title'] },
  { id: 'alerts', label: 'Alerts & integrations', fragments: ['personal-notifications-title', 'slack-destinations'] },
  { id: 'privacy', label: 'Privacy & filtering', fragments: ['inbound-filters-heading', 'end-user-erasure-title'] },
  { id: 'data', label: 'Data & archive', fragments: ['archive-error', 'erasure-title'] },
  { id: 'audit', label: 'Audit', fragments: ['audit-history-heading'] },
] as const;

// Retain the existing in-page addresses as well as the named section addresses.
function sectionFor(hash: string) {
  let fragment: string;
  try { fragment = decodeURIComponent(hash.replace(/^#/, '')); } catch { return undefined; }
  return settingsSections.find(section => `settings-${section.id}` === fragment || section.fragments.some(value => value === fragment))?.id;
}

export function SettingsView({ project, projects, keys, releases, request, run, busy, refresh, onCreated, onErased, onKey, access, revision }: {
  access: OrganizationAccess; revision: number; project: string; projects: any[]; keys: any[]; releases: any[]; request: Request; run: Run; busy: boolean; refresh: () => void; onCreated: (project: any) => void; onErased: (receipt: any) => void; onKey: (grant: { key: string; dsn?: string; kind: string }) => void;
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
  const available = settingsSections.filter(section => {
    if (section.id === 'organization') return true;
    if (section.id === 'projects') return organizationManager || !!project;
    if (section.id === 'alerts') return !!project || access.role === 'owner';
    if (section.id === 'data') return access.role === 'owner' || !!project && configure;
    if (section.id === 'audit') return organizationManager;
    return !!project && configure;
  });
  const [hash, setHash] = useState('');
  useEffect(() => {
    const read = () => setHash(location.hash);
    read();
    window.addEventListener('hashchange', read);
    window.addEventListener('popstate', read);
    return () => { window.removeEventListener('hashchange', read); window.removeEventListener('popstate', read); };
  }, []);
  const requested = sectionFor(hash);
  const active = available.find(section => section.id === requested)?.id ?? (!projects.length && organizationManager ? 'projects' : 'organization');
  useEffect(() => {
    if (!hash) return;
    let fragment: string;
    try { fragment = decodeURIComponent(hash.slice(1)); } catch { return; }
    const target = document.getElementById(fragment);
    if (target && !target.closest('[hidden]')) target.scrollIntoView({ block: 'start' });
  }, [hash, active]);
  return <>
    <nav className="settings-navigation" aria-label="Settings sections">
      {available.map(section => <a key={section.id} href={`#settings-${section.id}`} aria-current={active === section.id ? 'page' : undefined}>{section.label}</a>)}
    </nav>
    <div id="settings-organization" className="settings-section" hidden={active !== 'organization'} tabIndex={-1}>
    <Members {...{ access, revision, refresh, request, run, busy }} />
    </div>
    <div id="settings-projects" className="settings-section" hidden={active !== 'projects'} tabIndex={-1}>
    {organizationManager && <section className="evidence"><h2>{projects.length ? 'Create another project' : 'Create your first project'}</h2><ProjectForm {...{ request, run, busy, onCreated }} /></section>}
    {!!project && <section className="evidence"><h2>Project keys</h2><p>Capture keys send events. Agent keys read this project’s evidence and submit suggested grouping changes; decisions and apply require the owner. Deploy keys only register releases and upload source maps for this project.</p><p>Archives exclude project keys. After restoring, create new keys for this installation.</p>{!keys.length && <p>No project keys have been created here.</p>}<div className="button-row">{credentialKinds.map(kind => <button key={kind} className="text-button" disabled={busy} onClick={() => void run(async () => { const grant = await request(`/api/projects/${project}/keys`, 'POST', { kind }); onKey({ ...grant, kind }); refresh(); })}>Create {kind} key</button>)}</div>{keys.map((key, index) => <div className="data-row key-row" key={key.hash} data-key-hash={key.hash}><span><span className={index === agentRow ? 'mark' : undefined}>{keyKind(key.kind)}</span> · {keyStatus(key)}</span><span>Created {date(key.created)}</span><Details title="Project key"><ProjectKeyFacts value={key} />{configure && key.kind === 'ingest' && !key.revoked && !key.stopped && <><LoaderSettings project={project} keyHash={key.hash} {...{request,run,busy}} />{organizationManager&&<KeyRateLimit project={project} keyHash={key.hash} {...{request,run,busy}} />}</>}{!key.revoked && (configure || (projectRole === 'member' && key.kind === 'deploy')) && <button className="danger-button" disabled={busy} onClick={() => void run(async () => { await request(`/api/projects/${project}/keys/${key.hash}`, 'DELETE'); refresh(); })}>Revoke key</button>}</Details></div>)}</section>}
    {!!project && configure && <ReportsConfiguration key={`reports:${project}`} {...{ project, projects }} />}
    {!!project && configure && <section className="evidence"><h2>Send errors to this project</h2>{endpoint && <SdkSetup endpoint={endpoint} project={project} ingestKey="YOUR_INGEST_KEY" release={releases[0]?.name ?? 'REGISTERED_RELEASE'} build={releases[0]?.build ?? 'REGISTERED_BUILD'} />}<OriginStep key={project} project={project} request={request} /><SentryIntake /></section>}
    </div>
    <div id="settings-processing" className="settings-section" hidden={active !== 'processing'} tabIndex={-1}>
    {!!project&&configure&&<section className="evidence"><CheckInRoutes key={`check-ins:${project}`} {...{project,request,run,busy}}/></section>}
    {!!project&&configure&&<GroupingRules key={`grouping:${project}`} {...{project,request,run,busy}} approvedPreview={rulePreview?.project===project?rulePreview.preview:null} onSaved={()=>{setProposalVersion(value=>value+1);refresh();}}/>}
    {!!project&&configure&&<GroupingProposals key={`proposals:${project}`} {...{project,request,run,busy,refresh}} refreshVersion={proposalVersion} onRulePreview={preview=>setRulePreview({project,preview})}/>}
    {!!project&&configure&&<RecurrencePolicy key={`recurrence:${project}`} {...{project,request,run,busy}}/>}
    {!!project&&configure&&<ReleasePolicy key={`release-policy:${project}`} {...{project,request,run,busy}}/>}
    {!!project&&configure&&<CommitSharing key={`commit-sharing:${project}`} {...{project,request,run,busy}}/>}
    {!!project&&organizationManager&&<FeedbackPanel key={`feedback:${project}`} {...{project,request,run,busy}}/>}
    </div>
    <div id="settings-alerts" className="settings-section" hidden={active !== 'alerts'} tabIndex={-1}>
      {!!project && configure && <p><a className="inline-link" href={hrefFor(project, 'alerts')}>Alert rules and delivery</a></p>}
    {!!project && <PersonalNotifications key={`notifications:${project}`} {...{project,request,run,busy}} />}
    {!!project&&configure&&<SlackDestinationForm key={`slack:${project}`} project={project}/>}
    {access.role === 'owner' && <SchedulerStatus />}
    </div>
    <div id="settings-privacy" className="settings-section" hidden={active !== 'privacy'} tabIndex={-1}>
    {!!project&&configure&&<ScrubbingRules key={`scrubbing:${project}`} {...{project,request,run,busy}} installation={access.role === 'owner'}/>}
    {!!project&&configure&&<IdentityPolicy key={`identity:${project}`} {...{project,request,run,busy}}/>}
    {!!project&&configure&&<InboundFilters key={project} {...{project,request,run,busy}}/>}
    </div>
    <div id="settings-data" className="settings-section" hidden={active !== 'data'} tabIndex={-1}>
    {access.role === 'owner' && <BusinessImports {...{ request, run, busy }} />}
    {access.role === 'owner' && <ArchiveSettings busy={busy} empty={!projects.length} run={run} refresh={refresh} />}
    {!!project && configure && <RetentionSettings {...{ project, request, run, busy, refresh }} />}
    {!!project && access.role === 'owner' && <ProjectErasure key={project} {...{ project, request, run, busy, onErased }} />}
    </div>
    <div id="settings-audit" className="settings-section" hidden={active !== 'audit'} tabIndex={-1}>
    {organizationManager && <AuditHistory {...{request,run,busy}} />}
    </div>
  </>;
}
