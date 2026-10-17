import { normalize, scrub } from './privacy';

// Admission scrubs text before it is stored. Rows stored under an earlier
// scrubber are scrubbed again wherever they leave storage, so a pattern added
// later also covers older issues, alerts and archives. Scrubbing is idempotent:
// rows already scrubbed by the current rules pass through unchanged.
const titled = (payload: any) => payload && typeof payload.title === 'string' ? { ...payload, title: scrub(payload.title) } : payload;
const optional = (value: unknown) => typeof value === 'string' ? scrub(value) : value;

export function alertBody(value: string | null) {
 if (value === null) return null;
 const body = JSON.parse(value);
 return typeof body?.title === 'string' && scrub(body.title) !== body.title ? JSON.stringify(titled(body)) : value;
}
export function ownerIssue(row: any) {
 return { ...row, title: scrub(row.title), attention: row.attention ? { ...row.attention, payload: titled(row.attention.payload) } : row.attention };
}
export function ownerAlert(row: any) {
 return { ...row, payload: alertBody(row.payload) };
}
const exportText: Record<string, (row: any) => any> = {
 feedback: row => ({ ...row, message: scrub(row.message) }),
 projects: row => ({ ...row, name: scrub(row.name) }),
 issues: row => ({ ...row, title: scrub(row.title) }),
 events: row => ({ ...row, payload: JSON.stringify(normalize(JSON.parse(row.payload))) }),
 alerts: row => ({ ...row, payload: alertBody(row.payload) }),
 alert_rules: row => ({ ...row, name: scrub(row.name) }),
 repairs: row => ({ ...row, note: scrub(row.note), exercise_note: optional(row.exercise_note) }),
 repair_checks: row => ({ ...row, name: scrub(row.name), note: scrub(row.note) }),
};
// Archive rows meet the same text rules that restore validates.
export function scrubExportRow(table: string, row: any) {
 return exportText[table]?.(row) ?? row;
}
