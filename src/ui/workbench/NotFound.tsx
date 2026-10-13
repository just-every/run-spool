import { Link } from '@tanstack/react-router';
import { useEditorDestinationReady } from '../../editor/useEditorDestinationReady';
import { Wordmark } from '../Wordmark';
export function MissingContent({ project = false }: { project?: boolean }) {
  return <section className="empty-state missing-state"><p className="crumb">Page not found</p><h1>{project ? 'This project is unavailable' : 'This page is unavailable'}</h1><p>The link may be incomplete, or the item may have been removed.</p><Link to="/" className="primary-button">Back to issues</Link></section>;
}
export function NotFound() {
  useEditorDestinationReady();
  return <div className="app workbench-shell"><MinimalSidebar /><main id="content" className="main"><MissingContent /></main></div>;
}
export function PageError({ reset }: { reset: () => void }) {
  useEditorDestinationReady();
  return <div className="app workbench-shell"><MinimalSidebar /><main className="main"><section className="empty-state missing-state"><h1>This page could not be opened</h1><p>Try loading it again, or return to your issues.</p><div className="button-row"><button className="primary-button" onClick={reset}>Try again</button><Link to="/" className="text-button">Back to issues</Link></div></section></main></div>;
}
function MinimalSidebar() {
  return <aside className="sidebar"><div className="sidebar-brand"><div className="brand"><Wordmark /></div></div><nav className="navigation" aria-label="Workbench"><Link to="/">Issues</Link></nav></aside>;
}
