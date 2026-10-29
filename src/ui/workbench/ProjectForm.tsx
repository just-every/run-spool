import { Field, useDraft, type Request, type Run } from './shared';
import { projectIdentifierFromName } from './projectIdentifier';
export const projectDefaultsNote = 'New projects filter browser extension and known crawler errors by default. You can turn each off in Settings before capture.';
export function ProjectForm({ request, run, busy, onCreated, note = true }: { request: Request; run: Run; busy: boolean; onCreated: (project: any) => void; note?: boolean }) {
  const [id, setId] = useDraft('project-id', ''), [name, setName] = useDraft('project-name', ''), [typed, setTyped] = useDraft('project-id-typed', false);
  return <form className="form-grid" onSubmit={event => { event.preventDefault(); void run(async () => { const project = await request('/api/projects', 'POST', { id, name }); setId(''); setName(''); setTyped(false); onCreated(project); }); }}><Field label="Project name" required value={name} onChange={event => { setName(event.target.value); if (!typed) setId(projectIdentifierFromName(event.target.value)); }} /><Field label="Project identifier" required pattern="[a-zA-Z0-9._:\-]+" value={id} onChange={event => { setId(event.target.value); setTyped(event.target.value !== ''); }} />{note && <p className="muted">{projectDefaultsNote}</p>}<button className="primary-button" disabled={busy}>Create project</button></form>;
}
