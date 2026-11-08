import { date } from './shared';

export const keyKind = (kind: string) => kind === 'agent' ? 'Agent' : kind === 'deploy' ? 'Deploy' : 'Capture';
export const keyStatus = (value: any) => value.revoked != null ? 'Revoked' : value.stopped ? 'Stopped' : 'Active';
export function ProjectKeyFacts({ value }: { value: any }) {
  return <dl className="execution-facts">
    <div><dt>Kind</dt><dd>{keyKind(value.kind)}</dd></div>
    <div><dt>Created</dt><dd>{date(value.created)}</dd></div>
    <div><dt>Status</dt><dd>{keyStatus(value)}</dd></div>
    {value.revoked != null && <div><dt>Revoked</dt><dd>{date(value.revoked)}</dd></div>}
  </dl>;
}
