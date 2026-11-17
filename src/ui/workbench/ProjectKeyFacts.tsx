export const keyKind = (kind: string) => kind === 'agent' ? 'Agent' : kind === 'deploy' ? 'Deploy' : 'Capture';
export const keyStatus = (value: any) => value.revoked != null ? 'Revoked' : value.stopped ? 'Stopped' : 'Active';
export function ProjectKeyFacts({ value }: { value: any }) {
  return <dl className="execution-facts">
    <div><dt>Name</dt><dd>{value.name || 'Unnamed key'}</dd></div><div><dt>Last used</dt><dd>{value.last_used == null ? 'No recorded use' : new Date(value.last_used).toLocaleString()}</dd></div>
    <div><dt>Kind</dt><dd>{keyKind(value.kind)}</dd></div>
    <div><dt>Created</dt><dd>{new Date(value.created).toLocaleString()}</dd></div>
    <div><dt>Status</dt><dd>{keyStatus(value)}</dd></div>
    {value.revoked != null && <div><dt>Revoked</dt><dd>{new Date(value.revoked).toLocaleString()}</dd></div>}
  </dl>;
}
