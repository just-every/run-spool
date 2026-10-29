import {RecurrencePolicy} from './RecurrencePolicy';
import {SlackDestinationForm} from '../alerts/SlackDestinationForm';
import {IdentityPolicy} from './IdentityPolicy';
import { CheckInRoutes } from './CheckInRoutes';
import { AuditHistory } from './AuditHistory';
import { ReleasePolicy } from './ReleasePolicy';
import { ReportsConfiguration } from './ReportsConfiguration';
import { CommitSharing } from './CommitSharing';
import { GroupingRules } from './GroupingRules';
import { GroupingProposals } from './GroupingProposals';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from '@tanstack/react-router';
import { ArchiveSettings } from './ArchiveSettings';
import { RetentionSettings } from './RetentionSettings';
import { ProjectErasure } from './ProjectErasure';
import { ProjectForm, projectDefaultsNote } from './ProjectForm';
import { InboundFilters } from './InboundFilters';
import { FeedbackPanel } from './FeedbackPanel';
import { OriginStep, SdkSetup, SentryIntake } from './SdkSetup';
import { SchedulerStatus } from './SchedulerStatus';
import { BusinessImports } from './BusinessImports';
import { ProjectKeys } from './ProjectKeys';
import { SettingsNav } from './SettingsNav';
import { SectionHead } from './SectionHead';
import { settingsSections } from './settingsSections';
import { settingsHref } from './location';
import type { Request, Run } from './shared';
import { Members, type OrganizationAccess } from './Members';
import './settings.css';

/** Settings, one section per path: the section list beside one section's content. Every part keeps today's role
 * check; a section shows when the role sees one of its parts, and /settings opens the first such section. */
export function SettingsView({ section, canonical, project, projects, keys, releases, request, run, busy, refresh, onCreated, onKey, access, revision }: {
  section?: string; canonical: boolean; access: OrganizationAccess; revision: number; project: string; projects: any[]; keys: any[]; releases: any[]; request: Request; run: Run; busy: boolean; refresh: () => void; onCreated: (project: any) => void; onKey: (grant: { key: string; dsn?: string; kind: string }) => void;
}) {
  const router = useRouter();
  const [endpoint, setEndpoint] = useState('');
  const [rulePreview, setRulePreview] = useState<any>(null);
  const [proposalVersion, setProposalVersion] = useState(0);
  useEffect(() => { setRulePreview(null); }, [project]);
  useEffect(() => { setEndpoint(location.origin); }, []);
  const owner = access.role === 'owner', organizationManager = owner || access.role === 'admin';
  const projectRole = projects.find(row => row.id === project)?.role ?? access.projects.find(row => row.id === project)?.role;
  const configure = organizationManager || projectRole === 'maintainer';
  const credentialKinds = configure ? ['ingest', 'agent', 'deploy'] : projectRole === 'member' ? ['deploy'] : [];
  const visible = settingsSections.filter(item => item.visible({ project: !!project, configure, manager: organizationManager, owner }));
  const current = visible.find(item => item.id === section) ?? visible[0];
  useEffect(() => { if (canonical && project && current && section !== current.id) void router.navigate({ to: settingsHref(project, current.id), replace: true } as any); }, [canonical, project, section, current?.id]);
  const create = organizationManager && <section className="evidence" key="create"><SectionHead title={projects.length ? 'Create another project' : 'Create your first project'} about={<p>{projectDefaultsNote}</p>} /><ProjectForm {...{ request, run, busy, onCreated }} note={false} /></section>;
  const parts: Record<string, ReactNode> = {
    'keys-and-capture': <>
      <ProjectKeys {...{ project, keys, credentialKinds, configure, request, run, busy, refresh, onKey }} member={projectRole === 'member'} />
      {configure && <section className="evidence" aria-labelledby="send-errors-title"><SectionHead id="send-errors-title" title="Send errors to this project" />{endpoint && <SdkSetup endpoint={endpoint} project={project} ingestKey="YOUR_INGEST_KEY" release={releases[0]?.name ?? 'REGISTERED_RELEASE'} build={releases[0]?.build ?? 'REGISTERED_BUILD'} />}<OriginStep key={project} project={project} request={request} /><SentryIntake /></section>}
      {configure && <section className="evidence"><CheckInRoutes key={`check-ins:${project}`} {...{ project, request, run, busy }} /></section>}
    </>,
    grouping: <>
      <GroupingRules key={`grouping:${project}`} {...{ project, request, run, busy }} approvedPreview={rulePreview?.project === project ? rulePreview.preview : null} onSaved={() => { setProposalVersion(value => value + 1); refresh(); }} />
      <GroupingProposals key={`proposals:${project}`} {...{ project, request, run, busy, refresh }} refreshVersion={proposalVersion} onRulePreview={preview => setRulePreview({ project, preview })} />
    </>,
    'releases-and-commits': <>
      <RecurrencePolicy key={`recurrence:${project}`} {...{ project, request, run, busy }} />
      <ReleasePolicy key={`release-policy:${project}`} {...{ project, request, run, busy }} />
      <CommitSharing key={`commit-sharing:${project}`} {...{ project, request, run, busy }} />
    </>,
    'users-and-feedback': <>
      {configure && <IdentityPolicy key={`identity:${project}`} {...{ project, request, run, busy }} />}
      {organizationManager && <FeedbackPanel key={`feedback:${project}`} {...{ project, request, run, busy }} />}
    </>,
    alerts: <>
      {!!project && configure && <SlackDestinationForm key={`slack:${project}`} project={project} />}
      {owner && <SchedulerStatus />}
    </>,
    reports: <ReportsConfiguration key={`reports:${project}`} {...{ project, projects }} />,
    data: <>
      {configure && <InboundFilters key={project} {...{ project, request, run, busy }} />}
      {configure && <RetentionSettings {...{ project, request, run, busy, refresh }} />}
      {owner && <ProjectErasure key={project} {...{ project, request, run, busy }} />}
    </>,
    members: projects.length ? <><Members {...{ access, revision, refresh, request, run, busy }} />{create}</> : <>{create}<Members {...{ access, revision, refresh, request, run, busy }} /></>,
    audit: <AuditHistory {...{ request, run, busy }} />,
    'imports-and-archive': <>
      <BusinessImports {...{ request, run, busy }} />
      <ArchiveSettings busy={busy} empty={!projects.length} run={run} refresh={refresh} />
    </>,
  };
  // Before the first project there is no project path to hold a section, so the sections stack in one column.
  if (!project) return <div className="settings-content">{visible.map(item => <div key={item.id}>{parts[item.id]}</div>)}</div>;
  return <div className="settings-layout">
    <SettingsNav project={project} sections={visible} current={current} />
    <div className="settings-content" key={current.id}>{parts[current.id]}</div>
  </div>;
}
