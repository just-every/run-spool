import { useEffect, type ReactNode } from 'react';
import { hrefFor, useDestination } from './location';
import type { useProjectData } from './useProjectData';
import { useAttention, issueAlert } from './attention';
import { api } from './client';
import { Navigation } from './Navigation';
import { IssueList } from './IssueList';
import { IssueView } from './IssueView';
import { CaptureView } from './CaptureView';
import { ReleasesView, type UploadTarget } from './ReleasesView';
import { SettingsView } from './SettingsView';
import { ReportsView } from './ReportsView';
import { AgentHandoff } from './AgentHandoff';
import { SentryIntake } from './SdkSetup';
import { MissingContent } from './NotFound';
import { useDraft } from './shared';
import { PageHeader } from './PageHeader';
import { settingsTitle } from './settingsSections';
import type { useWorkspace } from './useWorkspace';

const titles = { issues: 'Issues', releases: 'Releases', capture: 'Capture', settings: 'Settings', alerts: 'Alerts', reports: 'Reports' };
export function WorkspaceView({ workspace, data, renderAlerts }: { workspace: ReturnType<typeof useWorkspace>; data: ReturnType<typeof useProjectData>; renderAlerts: (project: string, onIssue: (id: string) => void) => ReactNode }) {
  const { projects, ownerName, access, revision, notice, busy, run, refresh } = workspace;
  const route = useDestination(), project = route.project || projects[0]?.id || '', currentProject = projects.find(row => row.id === project);
  const attention = useAttention(project, data.issues);
  const [freshKey, setFreshKey] = useDraft<{ project: string; value: string; dsn?: string; kind?: string } | null>('fresh-key', null);
  const [target, setTarget] = useDraft<(UploadTarget & { project: string }) | undefined>('upload-target', undefined);
  const onIssue = (id: string) => route.go(project, 'issues', id);
  useEffect(() => { if ((route.pathname === '/' || route.redirect) && projects.length) route.go(project, 'issues', undefined, true); }, [route.pathname, route.redirect, projects.length, project]);
  useEffect(() => { document.getElementById('content')?.focus({ preventScroll: true }); }, [route.pathname]);
  useEffect(() => { const section = route.view === 'settings' ? settingsTitle(route.section) : undefined; document.title = `${section ? `${section} · ` : ''}${access?.role === 'billing' ? 'Settings' : data.packet?.issue?.title ?? titles[route.view]} · Spool`; }, [route.view, route.section, data.packet?.issue?.title, access?.role]);
  useEffect(() => { setFreshKey(value => value?.project === project ? value : null); }, [project]);
  function created(row: any) { workspace.addProject({ id: row.id, name: row.name, role: 'owner' }); setFreshKey({ project: row.id, value: row.ingestKey, dsn: row.dsn, kind: 'ingest' }); route.go(row.id, 'capture'); refresh(); }
  const billing = access?.role === 'billing';
  const projectRole = currentProject?.role ?? access?.projects.find(row => row.id === project)?.role;
  const readOnly = access?.role === 'read-only' || projectRole === 'read-only';
  const manageProject = access?.role === 'owner' || access?.role === 'admin' || projectRole === 'maintainer';
  const manageOrganization = access?.role === 'owner' || access?.role === 'admin';
  const known = !route.unknown && (!route.project || !!currentProject), issueView = !billing && known && route.view === 'issues' && !!route.issue;
  const controls = { project, busy, run, refresh, request: api };
  let content: ReactNode;
  if (access && (!projects.length || route.view === 'settings' || billing)) {
    content = <SettingsView key={`settings-${project}`} {...controls} section={route.view === 'settings' ? route.section : undefined} canonical={route.view === 'settings'} access={access} revision={revision} projects={projects} keys={data.keys} releases={data.releases} onCreated={created} onKey={grant => setFreshKey({ project, value: grant.key, dsn: grant.dsn, kind: grant.kind })} />;
  } else if (route.view === 'issues') {
    content = issueView
      ? <IssueView key={route.issue} {...controls} projectName={currentProject?.name ?? project} readOnly={readOnly} manageProject={manageProject} manageOrganization={manageOrganization} packet={data.packet} panels={data.panels} status={data.packetStatus} alert={data.packet ? issueAlert(data.packet.issue) : undefined} outcomes={data.outcomes} onViewed={attention.markViewed} onUpload={(release, debugId) => { setTarget({ id: crypto.randomUUID(), project, release, debugId, issue: route.issue! }); route.go(project, 'releases'); }} />
      : <IssueList key={`issues-${project}`} project={project} readOnly={readOnly} rows={data.issues} unseen={attention.unseen} onRefresh={refresh} onSetup={() => route.go(project, 'capture')} />;
  } else if (route.view === 'releases') {
    content = <ReleasesView key={`releases-${project}`} {...controls} readOnly={readOnly} manageOrganization={manageOrganization} selectedRelease={route.release} sourceMapSetup={route.section === 'source-maps'} loading={data.loading} releases={data.releases} target={target?.project === project ? target : undefined} onUploaded={onIssue} />;
  } else if (route.view === 'reports') {
    content = <ReportsView key={`reports-${project}`} project={project} projects={projects} configure={manageProject && !readOnly} />;
  } else if (route.view === 'capture') {
    content = <CaptureView key={`capture-${project}`} {...controls} readOnly={readOnly} manageProject={manageProject} manageOrganization={manageOrganization} onIssue={onIssue} releases={data.releases} issues={data.issues} outcomes={data.outcomes} onReleases={() => route.go(project, 'releases')} />;
  } else {
    content = manageProject ? renderAlerts(project, onIssue) : <section className="evidence"><h2>Alerts</h2><p>Ask a project maintainer or administrator to manage alert rules and delivery.</p></section>;
  }
  return <div className="app workbench-shell"><a className="skip-link" href="#content">Skip to work</a>
    <Navigation {...{ project, projects, ownerName, busy, billing, manageProject }} view={route.view} unseenCount={attention.count} onProject={id => route.go(id, route.view)} onSignOut={() => void run(async () => { window.dispatchEvent(new Event('spool:auth-lost')); const response = await fetch('/auth/signout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); if (!response.ok) throw new Error('Sign out failed.'); window.dispatchEvent(new Event('spool:auth-changed')); location.assign('/sign-in'); })} />
    <main id="content" className="main" tabIndex={-1}>
      {!known ? <MissingContent project={!!route.project} /> : <>
        {!issueView && <PageHeader crumb={<>{currentProject?.name ?? 'Your installation'} <span aria-hidden="true">/</span> {billing ? 'Settings' : titles[route.view]}</>} title={billing || (!projects.length && access?.role !== 'owner' && access?.role !== 'admin') ? 'Settings' : !projects.length ? 'Create your first project' : titles[route.view]} />}
        {(notice || data.failed) && <p role="alert" className="callout status-notice">{notice || data.failed}</p>}
        {!readOnly && !billing && freshKey && freshKey.project === project && (freshKey.kind === 'agent' ? <AgentHandoff project={project} agentKey={freshKey.value} onDismiss={() => setFreshKey(null)} /> : <div className="callout secret-key"><strong>Copy this key now; it is shown once.</strong><code className="key-value mark-bar">{freshKey.value}</code>{freshKey.kind === 'ingest' && <p>Use it as <code>ingestKey</code> in the Spool SDK’s <code>init</code>, shown on <a className="inline-link" href={hrefFor(project, 'capture')}>Capture</a>.</p>}{freshKey.dsn && <SentryIntake dsn={freshKey.dsn} />}{freshKey.kind === 'deploy' && <p>Store this deploy key in your CI secret store. Pass its environment variable name to the source-map CLI or build plugin.</p>}<button onClick={() => setFreshKey(null)}>Dismiss key</button></div>)}
        {content}
      </>}
    </main>
  </div>;
}
