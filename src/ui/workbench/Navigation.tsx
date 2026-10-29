import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Wordmark } from '../Wordmark';
import { hrefFor, type View } from './location';
export function Navigation({ project, projects, ownerName, view, unseenCount, busy, onProject, onSignOut, billing = false, manageProject = true, owner = false }: {
  project: string; projects: any[]; ownerName: string; view: View; unseenCount: number; busy: boolean; onProject: (project: string) => void; onSignOut: () => void; billing?: boolean; manageProject?: boolean; owner?: boolean;
}) {
  // At phone width the menu folds behind one button; it closes after each destination change.
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [project, view]);
  const destinations: [View, string][] = billing ? [['settings', 'Settings']] : [['issues', 'Issues'], ['releases', 'Releases'], ['reports', 'Reports'], ['capture', 'Capture'], ...(manageProject ? [['alerts', 'Alerts'] as [View, string]] : []), ['settings', 'Settings'], ...(owner ? [['move-in', 'Move in'] as [View, string]] : [])];
  return <aside className="sidebar" aria-label="Project navigation">
    <div className="sidebar-brand"><div className="brand"><Wordmark /><p className="brand-tagline">JavaScript errors, in context</p></div><button type="button" className="menu-button" aria-expanded={open} aria-controls="workbench-menu" onClick={() => setOpen(!open)}>Menu{unseenCount > 0 && <> <span className="unseen-count">{unseenCount} unseen</span></>}</button></div>
    {!billing && <label className="form-field project-picker">Project<select value={project} disabled={busy} onChange={event => onProject(event.target.value)}>{!projects.length && <option value="">No project yet</option>}{projects.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>}
    <div id="workbench-menu" className={`sidebar-menu${open ? ' open' : ''}`}>
      <nav className="navigation" aria-label="Workbench">{destinations.map(([id, label]) => <Link to={hrefFor(project, id) as any} key={id} className={(billing || view === id) ? 'active mark-bar' : undefined} aria-current={(billing || view === id) ? 'page' : undefined} onClick={() => setOpen(false)}>{label}{id === 'issues' && unseenCount > 0 && <span className="unseen-count">{unseenCount} unseen in list</span>}</Link>)}</nav>
      <div className="team"><p>{ownerName}</p><button className="text-button" disabled={busy} onClick={onSignOut}>Sign out</button></div>
    </div>
  </aside>;
}
