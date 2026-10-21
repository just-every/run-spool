import { useCallback, useEffect, useState } from 'react';
export interface Issue { id: string; project: string; title: string; state: string; count: number; first_seen: number; last_seen: number; revision: number; releases?: string[]; last_release?: string; attention?: Alert | null; short_id?: string | null }
export interface Alert { id: string; issue: string; kind: string; created: number; payload?: { release?: { name: string; build: string; sequence: number } } | null }
export function issueAlert(issue: Issue) {
  if (issue.state === 'resolved' || issue.state === 'suppressed') return undefined;
  return issue.attention ?? undefined;
}
export function attentionLabel(alert?: Alert) {
  if (!alert) return '';
  if (alert.kind === 'new_issue') return 'New';
  return alert.payload?.release?.name ? `Regressed in ${alert.payload.release.name}` : 'Regressed';
}
export function useAttention(project: string, issues: Issue[]) {
  const storageKey = `spool.viewed-alerts.${project}`;
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState('');
  useEffect(() => {
    let ids: unknown;
    try { ids = JSON.parse(localStorage.getItem(storageKey) ?? '[]'); } catch { ids = []; }
    setSeen(new Set(Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : [])); setLoaded(project);
  }, [project, storageKey]);
  const markViewed = useCallback((id: string) => {
    if (loaded !== project) return;
    setSeen(previous => {
      if (previous.has(id)) return previous;
      const next = new Set(previous); next.add(id);
      // Reading other issues must not evict an unresolved issue's viewing fact.
      try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch { /* In-memory viewing still works for this session. */ }
      return next;
    });
  }, [loaded, project, storageKey]);
  const unseen = (alert?: Alert) => !!alert && loaded === project && !seen.has(alert.id);
  return { unseen, markViewed, count: issues.filter(issue => unseen(issueAlert(issue))).length };
}
