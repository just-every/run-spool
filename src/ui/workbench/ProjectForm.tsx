import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Field, useDraft, type Request, type Run } from './shared';
import { projectIdentifierFromName } from './projectIdentifier';
export function ProjectForm({ request, run, busy, onCreated, beforeCreate, onHydratedEdits, children }: { request: Request; run: Run; busy: boolean; onCreated: (project: any) => void; beforeCreate?: () => Promise<unknown>; onHydratedEdits?: (edits: ReadonlyMap<string, string>) => void; children?: ReactNode }) {
  const form = useRef<HTMLFormElement>(null);
  const [id, setId] = useDraft('project-id', ''), [name, setName] = useDraft('project-name', ''), [typed, setTyped] = useDraft('project-id-typed', false);
  useLayoutEffect(() => {
    if (!onHydratedEdits || !form.current) return;
    // React leaves early edits in the server-rendered inputs during hydration.
    // Adopt them before the first controlled re-render replaces their values.
    const edits = new Map<string, string>();
    for (const field of Array.from(form.current.elements)) {
      if (field instanceof HTMLInputElement && field.dataset.setupField && field.value !== field.defaultValue) {
        edits.set(field.dataset.setupField, field.value);
      }
    }
    const earlyName = edits.get('project-name');
    const earlyId = edits.get('project-id');
    if (earlyName !== undefined) setName(earlyName);
    if (earlyId !== undefined) {
      setId(earlyId);
      setTyped(earlyId !== '');
    } else if (earlyName !== undefined && !typed) {
      setId(projectIdentifierFromName(earlyName));
    }
    if (edits.size) onHydratedEdits(edits);
  }, []);
  return <form ref={form} className="form-grid" onSubmit={event => { event.preventDefault(); if (busy) return; void run(async () => { await beforeCreate?.(); const project = await request('/api/projects', 'POST', { id, name }); setId(''); setName(''); setTyped(false); onCreated(project); }); }}>
    {children}
    <Field data-setup-field="project-name" label="Project name" required value={name} onChange={event => { setName(event.target.value); if (!typed) setId(projectIdentifierFromName(event.target.value)); }} />
    <Field data-setup-field="project-id" label="Project identifier" required pattern="[a-zA-Z0-9._:\-]+" value={id} onChange={event => { setId(event.target.value); setTyped(event.target.value !== ''); }} />
    <p className="muted">New projects filter browser extension and known crawler errors by default. You can turn each off in Settings before capture.</p>
    <p role="note" aria-label="New project user identity policy">Spool scrubs emails, tokens and passwords from error text before saving it. This project keeps separate user IDs, emails, usernames and IP addresses sent by Sentry clients. Before connecting your app, <a href="/docs/user-identity#change-the-policy">set the user identity policy</a> to keep, hash or drop those fields.</p>
    <button className="primary-button" disabled={busy}>Create project</button>
  </form>;
}
