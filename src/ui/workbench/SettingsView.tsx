import { ProjectKeys } from './ProjectKeys';
import { SettingsSections } from './SettingsSections';
import {PersonalNotifications} from './PersonalNotifications';
import {RecurrencePolicy} from './RecurrencePolicy';
import {ScrubbingRules} from './ScrubbingRules';
import {SlackDestinationForm} from '../alerts/SlackDestinationForm';
import {IdentityPolicy} from './IdentityPolicy';
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
import { OriginStep, SdkSetup, SentryIntake } from './SdkSetup';
import { SchedulerStatus } from './SchedulerStatus';
import { BusinessImports } from './BusinessImports';
import { type Request, type Run } from './shared';
import { Members, type OrganizationAccess } from './Members';
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
  return <SettingsSections>{{
    access: <>
    <section className="evidence"><h2>Agents</h2><p>Choose what agents can do and review their activity.</p><a className="text-button" href="/agents">Agent policy and activity</a></section>
    <Members {...{ access, revision, refresh, request, run, busy }} />
    {!!project && <PersonalNotifications key={`notifications:${project}`} {...{project,request,run,busy}} />}
    {organizationManager && <section className="evidence"><h2>{projects.length ? 'Create another project' : 'Create your first project'}</h2><ProjectForm {...{ request, run, busy, onCreated }} /></section>}
    </>,
    capture: <>
    {!!project && <ProjectKeys {...{project,keys,configure,organizationManager,projectRole,request,run,busy,refresh,onKey}} projectName={projects.find(row => row.id === project)?.name ?? project} />}
    {!!project && configure && <section className="evidence"><h2>Send errors to this project</h2>{endpoint && <SdkSetup endpoint={endpoint} project={project} ingestKey="YOUR_INGEST_KEY" release={releases[0]?.name ?? 'REGISTERED_RELEASE'} build={releases[0]?.build ?? 'REGISTERED_BUILD'} />}<OriginStep key={project} project={project} request={request} /><SentryIntake /></section>}
    {!!project&&configure&&<section className="evidence"><CheckInRoutes key={`check-ins:${project}`} {...{project,request,run,busy}}/></section>}
    {!!project&&configure&&<InboundFilters key={project} {...{project,request,run,busy}}/>}
    </>,
    grouping: <>
    {!!project&&configure&&<GroupingRules key={`grouping:${project}`} {...{project,request,run,busy}} approvedPreview={rulePreview?.project===project?rulePreview.preview:null} onSaved={()=>{setProposalVersion(value=>value+1);refresh();}}/>}
    {!!project&&configure&&<GroupingProposals key={`proposals:${project}`} {...{project,request,run,busy,refresh}} refreshVersion={proposalVersion} onRulePreview={preview=>setRulePreview({project,preview})}/>}
    {!!project&&configure&&<RecurrencePolicy key={`recurrence:${project}`} {...{project,request,run,busy}}/>}
    {!!project&&configure&&<ReleasePolicy key={`release-policy:${project}`} {...{project,request,run,busy}}/>}
    {!!project&&configure&&<CommitSharing key={`commit-sharing:${project}`} {...{project,request,run,busy}}/>}
    </>,
    privacy: <>
    {!!project&&configure&&<ScrubbingRules key={`scrubbing:${project}`} {...{project,request,run,busy}} installation={access.role === 'owner'}/>}
    {!!project&&configure&&<IdentityPolicy key={`identity:${project}`} {...{project,request,run,busy}}/>}
    </>,
    integrations: <>
    {!!project && configure && <ReportsConfiguration key={`reports:${project}`} {...{ project, projects }} />}
    {!!project&&configure&&<SlackDestinationForm key={`slack:${project}`} project={project}/>}
    {!!project&&organizationManager&&<FeedbackPanel key={`feedback:${project}`} {...{project,request,run,busy}}/>}
    </>,
    data: <>
    {access.role === 'owner' && <SchedulerStatus />}
    {access.role === 'owner' && <BusinessImports {...{ request, run, busy }} />}
    {organizationManager && <AuditHistory {...{request,run,busy}} />}
    {access.role === 'owner' && <ArchiveSettings busy={busy} empty={!projects.length} run={run} refresh={refresh} />}
    {!!project && configure && <RetentionSettings {...{ project, request, run, busy, refresh }} />}
    {!!project && access.role === 'owner' && <ProjectErasure key={project} {...{ project, request, run, busy, onErased }} />}
    </>
  }}</SettingsSections>;
}
