import type { ReactNode } from 'react';
import { Field, useDraft, type Request, type Run } from './shared';
import { projectIdentifierFromName } from './projectIdentifier';
export function ProjectForm({ request, run, busy, disabled = false, onCreated, beforeCreate, children }: { request: Request; run: Run; busy: boolean; disabled?: boolean; onCreated: (project: any) => void; beforeCreate?: () => Promise<unknown>; children?: ReactNode }) {
  const [id, setId] = useDraft('project-id', ''), [name, setName] = useDraft('project-name', ''), [typed, setTyped] = useDraft('project-id-typed', false);
  return <form className="form-grid" onSubmit={event => { event.preventDefault(); if (disabled || busy) return; void run(async () => { await beforeCreate?.(); const project = await request('/api/projects', 'POST', { id, name }); setId(''); setName(''); setTyped(false); onCreated(project); }); }}>
    {children}
    <Field label="Project name" required disabled={disabled} value={name} onChange={event => { setName(event.target.value); if (!typed) setId(projectIdentifierFromName(event.target.value)); }} />
    <Field label="Project identifier" required disabled={disabled} pattern="[a-zA-Z0-9._:\-]+" value={id} onChange={event => { setId(event.target.value); setTyped(event.target.value !== ''); }} />
    <p className="muted">New projects filter browser extension and known crawler errors by default. You can turn each off in Settings before capture.</p>
    <p role="note" aria-label="New project user identity policy">Spool scrubs emails, tokens and passwords from error text before saving it. This project keeps separate user IDs, emails, usernames and IP addresses sent by Sentry clients. Before connecting your app, <a href="/docs/user-identity#change-the-policy">set the user identity policy</a> to keep, hash or drop those fields.</p>
    <button className="primary-button" disabled={busy || disabled}>Create project</button>
  </form>;
}
