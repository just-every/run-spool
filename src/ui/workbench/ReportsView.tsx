import { useEffect, useState } from 'react';
import { Popover } from './Popover';
import { SectionHead } from './SectionHead';
import { api } from './client';
import { settingsHref } from './location';
import { ReportsWindow, initialReportsWindow, reportWindowNumbers } from './ReportsWindow';
import { ReportsSummary } from './ReportsSummary';
import { ReportsDashboard } from './ReportsDashboard';
import { ReportsQueryTable } from './ReportsQueryTable';
import './Reports.css';

export function ReportsView({ project, projects, configure }: { project: string; projects: any[]; configure: boolean }) {
  const [scope, setScope] = useState('project'), [team, setTeam] = useState(''), [window, setWindow] = useState(initialReportsWindow);
  const [request, setRequest] = useState(() => new URLSearchParams({ projects: project, ...Object.fromEntries(Object.entries(reportWindowNumbers(initialReportsWindow())).map(([key, value]) => [key, String(value)])) }).toString());
  const [report, setReport] = useState<any>(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  useEffect(() => { let active = true; setLoading(true); setReport(null); setError(''); api(`/api/reports?${request}`).then(value => { if (active) setReport(value); }).catch(failure => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [request, revision]);
  function submit() { const numbers = reportWindowNumbers(window), params = new URLSearchParams({ projects: scope === 'project' ? project : projects.map(row => row.id).join(','), from: String(numbers.from), to: String(numbers.to), timeZone: numbers.timeZone }); if (scope === 'team') params.set('team', team.trim()); setRequest(params.toString()); setRevision(value => value + 1); }
  return <><section className="evidence reports" aria-labelledby="reports-overview-title"><SectionHead id="reports-overview-title" title="Project and team report" about={<><p>Review volume, backlog, response time, team ownership and observed release health for a chosen window.</p><p>Window endpoints are entered in UTC; daily buckets and displayed report times use your chosen IANA time zone. Only projects you can access are included.</p><p>Exports use this displayed window, time zone and accessible project scope. Excluded history, retention, sampling and capture loss travel with the report.</p></>}>{report && <Popover label="Export" icon="download" align="end">{() => <div className="menu-list"><a className="menu-item" href={`/api/reports?${request}&format=csv&download=1`}>Export report CSV</a><a className="menu-item" href={`/api/reports?${request}&format=json&download=1`}>Export report JSON</a></div>}</Popover>}{configure && <a className="text-button" href={settingsHref(project, 'reports')}>Configure reports</a>}</SectionHead>
    <form className="reports-query" onSubmit={event => { event.preventDefault(); submit(); }}><div className="reports-filters"><label className="form-field">Report scope<select value={scope} onChange={event => setScope(event.target.value)}><option value="project">Current project</option><option value="all">All accessible projects</option><option value="team">Project team</option></select></label>{scope === 'team' && <label className="form-field">Team name<input required maxLength={80} value={team} onChange={event => setTeam(event.target.value)} /></label>}<ReportsWindow value={window} onChange={setWindow} /></div><button className="primary-button">Run report</button></form>
    {error && <p role="alert">Report could not be loaded: {error} <button className="text-button" onClick={() => setRevision(value => value + 1)}>Refresh report</button></p>}{loading && <p role="status">Loading report…</p>}{report && <>{report.omission.projects > 0 && <p className="callout">{report.omission.projects} inaccessible projects omitted. {report.omission.reason}</p>}<ReportsSummary report={report} /></>}
  </section><ReportsDashboard /><ReportsQueryTable project={project} configure={configure} /></>;
}
