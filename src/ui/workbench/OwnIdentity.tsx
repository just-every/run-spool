import { identityMessage } from './identityMessage';
import { useEffect, useState } from 'react';
import { Field, type Request, type Run } from './shared';

export type OwnProfile = { name: string; email: string };

function IdentityField({ label, value, email = false, request, run, busy, refresh, mailSuppressed }: { label: string; value: string; email?: boolean; request: Request; run: Run; busy: boolean; refresh: () => void; mailSuppressed: boolean }) {
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState(value), [proof, setProof] = useState(false), [notice, setNotice] = useState('');
  useEffect(() => { setDraft(value); }, [value]);
  async function save() {
    if (draft.trim() === value) { setEditing(false); return; }
    await run(async () => {
      try {
        await request(email ? '/auth/email' : '/auth/display-name', 'POST', email ? { email: draft } : { displayName: draft });
        setEditing(false); setProof(false); setNotice('Saved'); refresh();
      } catch (failure) {
        if (email && (failure as Error).message === 'step_up_required') { setProof(true); return; }
        throw new Error(identityMessage(failure));
      }
    });
  }
  return <div className="data-row"><div>
    {editing ? <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <Field label={label} type={email ? 'email' : 'text'} autoComplete={email ? 'email' : 'name'} maxLength={email ? 254 : 120} required autoFocus disabled={busy} value={draft} onChange={event => { setDraft(event.target.value); setNotice(''); }} onBlur={event => { if (!proof && event.currentTarget.reportValidity()) void save(); }} />
      {proof && <div>{mailSuppressed ? <p>Email verification is unavailable here. Reopen this installation with your owner sign-in link to verify your identity.</p> : <><p>Verify your identity at your current email before changing it.</p><button className="text-button" type="button" disabled={busy} onClick={() => void run(async () => { await request('/auth/step-up', 'POST', { action: 'email:change', returnTo: location.pathname + '#settings-organization' }); setNotice('Check your current email, confirm the link, then return here to change your email.'); })}>Send verification email</button></>}</div>}
    </form> : <><strong>{label}</strong><p>{value}</p></>}
    {notice && <p role="status">{notice}</p>}
  </div><button className="text-button" disabled={busy} onMouseDown={event => { if (editing) event.preventDefault(); }} aria-label={`${editing ? 'Cancel changing' : 'Change'} ${label.toLowerCase()}`} onClick={() => { setDraft(value); setEditing(!editing); setProof(false); setNotice(''); }}>{editing ? 'Cancel' : 'Change'}</button></div>;
}

export function OwnIdentity({ profile, ...controls }: { profile: OwnProfile; request: Request; run: Run; busy: boolean; refresh: () => void; mailSuppressed: boolean }) {
  return <div aria-label="Your identity"><IdentityField label="Your name" value={profile.name} {...controls} /><IdentityField label="Your email" value={profile.email} email {...controls} /></div>;
}
