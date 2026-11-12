import { date } from './dates';
import { personLabel } from './readable';

/** Stored identities belong in links and copied evidence, never in reference text. */
export const referenceText = (value: unknown) => String(value ?? '')
  .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[record identifier]')
  .replace(/\b[0-9a-f]{24,}\b/gi, '[record identifier]');
export function issueReference(issue?: { short_id?: string; title?: string } | null) {
  return issue ? [issue.short_id, issue.title].filter(Boolean).map(referenceText).join(' · ') || 'Recorded issue' : 'Issue no longer available';
}
export function eventReference(row: any, timeZone = 'UTC') {
  if (!row) return 'Event no longer retained';
  const event = row.event ?? row;
  const message = referenceText(event.message || event.type || 'Recorded event');
  return `${date(row.received, timeZone, 'second')} · ${referenceText(event.release) || 'No release'} · ${message.length > 100 ? message.slice(0, 99) + '…' : message}`;
}
export function actorReference(actor?: { kind: string; name?: string | null } | null) {
  return actor ? referenceText(personLabel(actor.kind, actor.name)) : 'Recorded operator';
}
