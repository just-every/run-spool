import { useRouterState } from '@tanstack/react-router';
import { useWorkspace } from './workbench/useWorkspace';
import { WorkspaceView } from './workbench/WorkspaceView';
import { Alerts } from './alerts/Alerts';
import { Wordmark } from './Wordmark';
import { useEditorDestinationReady } from '../editor/useEditorDestinationReady';

export function Workbench() {
  useEditorDestinationReady();
  const workspace = useWorkspace();
  const requested = useRouterState({ select: state => state.location.pathname + state.location.searchStr });
  if (workspace.signedIn === null) return <main className="login"><Wordmark /><section className="login-panel card"><h1>{workspace.notice ? 'Your workspace is unavailable' : 'Opening your workspace'}</h1><p role={workspace.notice ? 'alert' : 'status'}>{workspace.notice || 'Checking your session…'}</p>{workspace.notice && <button className="primary-button" onClick={workspace.refresh}>Try again</button>}</section></main>;
  if (!workspace.signedIn) return <main className="login"><Wordmark /><section className="login-panel card"><h1>Session ended</h1><p>Sign in to return to the page you were viewing.</p><a className="primary-button" href={`/sign-in?returnTo=${encodeURIComponent(requested)}`}>Sign in again</a></section></main>;
  return <WorkspaceView workspace={workspace} renderAlerts={(project, onIssue) => <Alerts key={project} project={project} onIssue={onIssue} />} />;
}
