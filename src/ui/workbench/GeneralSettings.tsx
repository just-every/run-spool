import { useEffect, useState } from 'react';
import { Field, type Request, type Run } from './shared';
import type { OrganizationAccess } from './Members';

export function GeneralSettings({ access, request, run, busy, refresh }: { access: OrganizationAccess; request: Request; run: Run; busy: boolean; refresh: () => void }) {
  const [name, setName] = useState(access.organization?.name ?? ''), [notice, setNotice] = useState('');
  useEffect(() => setName(access.organization?.name ?? ''), [access.organization?.name]);
  const editable = access.role === 'owner' || access.role === 'admin';
  async function save() {
    if (!name.trim() || name.trim() === access.organization?.name) return;
    await run(async () => {
      await request('/api/organization', access.organization ? 'PUT' : 'POST', { name });
      setNotice('Saved'); refresh();
    });
  }
  return <section className="evidence" aria-label="General"><h2>General</h2>
    {editable ? <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <Field label="Installation name" placeholder="Brightwell Support" required maxLength={120} value={name} disabled={busy} onChange={event => { setName(event.target.value); setNotice(''); }} onBlur={event => { if (event.currentTarget.reportValidity()) void save(); }} />
    </form> : <p>{access.organization?.name}</p>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
