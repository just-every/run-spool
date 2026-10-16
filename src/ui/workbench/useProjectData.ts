import { useEffect, useState } from 'react';
import type { View } from './location';
import type { Request } from './shared';
import { loadIssuePanels, type IssuePanels } from './issuePanels';
import { useProjectIssues } from './useProjectIssues';
export function useProjectData(project: string, view: View, selected: string | undefined, refreshCount: number, request: Request) {
  const issues = useProjectIssues(project, refreshCount, request);
  const [data, setData] = useState<any>(null), [failed, setFailed] = useState(''), [loading, setLoading] = useState(false);
  const [panels, setPanels] = useState<IssuePanels | null>(null);
  const [packet, setPacket] = useState<any>(null), [packetStatus, setPacketStatus] = useState('idle');
  useEffect(() => {
    if (!project) { setData(null); return; }
    let alive = true; setLoading(true); setFailed('');
    const parts = [...(view === 'settings' ? ['keys', 'releases'] : view === 'releases' ? ['releases'] : view === 'capture' ? ['releases', 'outcomes'] : selected ? ['outcomes'] : [])];
    Promise.all(parts.map(async part => [part, await request(`/api/projects/${encodeURIComponent(project)}/${part}`)] as const))
      .then(entries => { const { releases = [], keys = [], outcomes = null } = Object.fromEntries(entries); return { releases, keys, outcomes }; })
      .then(({releases, keys, outcomes}) => { if (alive) { setData({ project, releases, keys, outcomes }); setLoading(false); } })
      .catch(error => { if (alive) { setLoading(false); setFailed(error.message); } });
    return () => { alive = false; };
  }, [project, view, !!selected, refreshCount, request]);
  useEffect(() => {
    setPacket(null); setPanels(null); setPacketStatus('idle'); if (!project || !selected) return;
    let alive = true; setPacketStatus('loading');
    setPanels(loadIssuePanels(project, selected, request));
    request(`/api/projects/${encodeURIComponent(project)}/issues/${encodeURIComponent(selected)}/packet`).then(result => {
      if (!alive) return;
      if (result.project !== project || result.issue?.id !== selected || result.issue?.project !== project) throw new Error('Issue evidence belongs to another destination.');
      setPacket(result); setPacketStatus('ready');
    }).catch(() => { if (alive) setPacketStatus('error'); });
    return () => { alive = false; };
  }, [project, selected, refreshCount, request]);
  const scoped = data?.project === project ? data : null;
  return { issues: issues.rows, releases: scoped?.releases ?? [], keys: scoped?.keys ?? [], outcomes: scoped?.outcomes ?? null,
    loading: issues.loading || loading || (!!project && !scoped && !failed), failed: issues.failed || failed, panels, packet: packet?.project === project && packet?.issue?.id === selected ? packet : null, packetStatus };
}
