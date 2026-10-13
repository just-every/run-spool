import { useEffect, useState } from 'react';
import type { Request } from './shared';
export function useProjectData(project: string, selected: string | undefined, refreshCount: number, request: Request) {
  const [data, setData] = useState<any>(null), [failed, setFailed] = useState(''), [loading, setLoading] = useState(false);
  const [packet, setPacket] = useState<any>(null), [packetStatus, setPacketStatus] = useState('idle');
  useEffect(() => {
    if (!project) { setData(null); return; }
    let alive = true; setLoading(true); setFailed('');
    Promise.all(['issues', 'releases', 'keys', 'outcomes'].map(part => request(`/api/projects/${encodeURIComponent(project)}/${part}`)))
      .then(([issues, releases, keys, outcomes]) => { if (alive) { setData({ project, issues: issues.map((issue: any) => ({ ...issue, releases: typeof issue.releases === 'string' ? JSON.parse(issue.releases) : issue.releases ?? [] })), releases, keys, outcomes }); setLoading(false); } })
      .catch(error => { if (alive) { setLoading(false); setFailed(error.message); } });
    return () => { alive = false; };
  }, [project, refreshCount, request]);
  useEffect(() => {
    setPacket(null); setPacketStatus('idle'); if (!project || !selected) return;
    let alive = true; setPacketStatus('loading');
    request(`/api/projects/${encodeURIComponent(project)}/issues/${encodeURIComponent(selected)}/packet`).then(result => {
      if (!alive) return;
      if (result.project !== project || result.issue?.id !== selected || result.issue?.project !== project) throw new Error('Issue evidence belongs to another destination.');
      setPacket(result); setPacketStatus('ready');
    }).catch(() => { if (alive) setPacketStatus('error'); });
    return () => { alive = false; };
  }, [project, selected, refreshCount, request]);
  const scoped = data?.project === project ? data : null;
  return { issues: scoped?.issues ?? [], releases: scoped?.releases ?? [], keys: scoped?.keys ?? [], outcomes: scoped?.outcomes ?? null,
    loading: loading || (!!project && !scoped && !failed), failed, packet: packet?.project === project && packet?.issue?.id === selected ? packet : null, packetStatus };
}
