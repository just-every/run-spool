import { useEffect, useState } from 'react';
import { api } from './client';
import type { OrganizationAccess } from './Members';
export function useWorkspace() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null), [projects, setProjects] = useState<any[]>([]);
  const [ownerName, setOwnerName] = useState('');
  const [access, setAccess] = useState<OrganizationAccess | null>(null);
  const [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    Promise.all([api('/api/projects'), api('/auth/session'), api('/api/organization/me')]).then(([rows, session, membership]) => { if (alive) { setAccess(membership); setProjects(membership.role === 'billing' ? [] : rows); setOwnerName(session.operator.displayName); setSignedIn(true); } }).catch(error => { if (alive) { setNotice(error.message); setSignedIn(error.status === 401 ? false : null); } });
    return () => { alive = false; };
  }, [revision]);
  useEffect(() => { const expired = () => { setSignedIn(false); setProjects([]); setOwnerName(''); setAccess(null); }; window.addEventListener('spool-session-expired', expired); return () => window.removeEventListener('spool-session-expired', expired); }, []);
  async function run(work: () => Promise<unknown>) {
    const focused = document.activeElement; setBusy(true); setNotice('');
    try { await work(); } catch (error) { setNotice((error as Error).message); } finally {
      setBusy(false); requestAnimationFrame(() => { if (document.activeElement === document.body && focused instanceof HTMLElement && focused.isConnected) focused.focus(); });
    }
  }
  return { signedIn, ownerName, access, projects, notice, busy, run, addProject: (project: any) => setProjects(rows => [...rows, project]), refresh: () => setRevision(value => value + 1), revision };
}
