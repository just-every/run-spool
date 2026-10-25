import { useState } from 'react';
import type { View } from './location';
import type { Request } from './shared';
import { loadIssuePanels, type IssuePanels } from './issuePanels';
import { useProjectIssues } from './useProjectIssues';
import { useLiveRead } from './useLiveRead';

export function useProjectData(project: string, view: View, selected: string | undefined, refreshCount: number, request: Request) {
  const live = view === 'issues' || view === 'capture';
  const issues = useProjectIssues(project, refreshCount, request, live);
  const [data, setData] = useState<any>(null), [failed, setFailed] = useState(''), [loading, setLoading] = useState(false);
  const [panels, setPanels] = useState<IssuePanels | null>(null);
  const [packet, setPacket] = useState<any>(null), [packetStatus, setPacketStatus] = useState('idle');
  const scoped = data?.project === project ? data : null;
  useLiveRead(async (signal, background) => {
    if (!background && !scoped) setLoading(true);
    const parts = view === 'settings' ? ['keys', 'releases'] : view === 'releases' ? ['releases'] : view === 'capture' ? ['releases', 'outcomes'] : selected ? ['outcomes'] : [];
    try {
      const entries = await Promise.all(parts.map(async part => [part, await request(`/api/projects/${encodeURIComponent(project)}/${part}`)] as const));
      if (signal.aborted) return;
      const { releases = [], keys = [], outcomes = null } = Object.fromEntries(entries);
      const next = { project, releases, keys, outcomes };
      setData((current: any) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
      setFailed('');
    } catch (error) { if (!signal.aborted) setFailed((error as Error).message); }
    finally { if (!signal.aborted) setLoading(false); }
  }, [project, view, !!selected, refreshCount, request], { enabled: !!project, live });
  useLiveRead(async (signal, background) => {
    const current = packet?.project === project && (packet.issue?.id === selected || packet.shortIdRequest?.requested === selected);
    if (!current) { setPacket(null); setPanels(null); setPacketStatus('loading'); }
    const stored = /^[a-f0-9]{64}$/.test(selected!);
    if (!background && stored) setPanels(loadIssuePanels(project, selected!, request));
    try {
      const result = await request(`/api/projects/${encodeURIComponent(project)}/issues/${encodeURIComponent(selected!)}/packet`);
      if (signal.aborted) return;
      if (result.project !== project || (result.issue?.id !== selected && result.shortIdRequest?.requested !== selected) || result.issue?.project !== project) throw new Error('Issue evidence belongs to another destination.');
      if (background || !stored) setPanels(loadIssuePanels(project, result.issue.id, request));
      setPacket((previous: any) => JSON.stringify(previous) === JSON.stringify(result) ? previous : result);
      setPacketStatus('ready');
    } catch { if (!signal.aborted && !current) setPacketStatus('error'); }
  }, [project, selected, refreshCount, request], { enabled: !!project && !!selected, live: view === 'issues' });
  return { issues: issues.rows, releases: scoped?.releases ?? [], keys: scoped?.keys ?? [], outcomes: scoped?.outcomes ?? null,
    loading: issues.loading || loading || (!!project && !scoped && !failed), failed: issues.failed || failed, panels,
    packet: packet?.project === project && (packet?.issue?.id === selected || packet?.shortIdRequest?.requested === selected) ? packet : null, packetStatus };
}
