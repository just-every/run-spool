import { useDestination } from './workbench/location';
import { useProjectData } from './workbench/useProjectData';
import { api } from './workbench/client';
import { useWorkspace } from './workbench/useWorkspace';
import { WorkspaceView } from './workbench/WorkspaceView';
import { Alerts } from './alerts/Alerts';
import { Wordmark } from './Wordmark';
import { WorkspaceOpening } from './workbench/WorkspaceOpening';
import { useEditorDestinationReady } from '../editor/useEditorDestinationReady';

export function Workbench() {
  useEditorDestinationReady();
  const workspace = useWorkspace();
  const route = useDestination();
  const project = route.project || workspace.projects[0]?.id || '';
  const data = useProjectData(project, route.view, route.issue, workspace.revision, api);
  const requested = typeof window === 'undefined' ? '/' : window.location.pathname + window.location.search;
  if (workspace.signedIn === null) return <WorkspaceOpening failure={workspace.readFailure} retry={workspace.refresh} />;
  if (!workspace.signedIn) return <main className="login"><Wordmark /><section className="login-panel card"><h1>Session ended</h1><p>Sign in to return to the page you were viewing.</p><a className="primary-button" href={`/sign-in?returnTo=${encodeURIComponent(requested)}`}>Sign in again</a></section></main>;
  return <WorkspaceView workspace={workspace} data={data} renderAlerts={(project, onIssue) => <Alerts key={project} project={project} onIssue={onIssue} />} />;
}
