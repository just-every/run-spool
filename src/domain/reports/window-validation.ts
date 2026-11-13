export type WindowProblem = { field: 'from' | 'to'; message: string };

/** Shared by reporting writes and their form. Keep the existing clock-skew allowance. */
export function windowProblem(from: number, to: number, now = Date.now()): WindowProblem | undefined {
  if (!Number.isSafeInteger(from)) return { field: 'from', message: 'Window start: enter a valid UTC date and time.' };
  if (!Number.isSafeInteger(to)) return { field: 'to', message: 'Window end: enter a valid UTC date and time.' };
  if (from < 0) return { field: 'from', message: 'Window start: choose a date on or after 1 January 1970.' };
  if (to <= from) return { field: 'to', message: 'Window end: choose a time after the window start.' };
  if (to - from > 90 * 86400000) return { field: 'to', message: 'Reporting window exceeds 90 days. Move the start later or the end earlier.' };
  if (to > now + 300000) return { field: 'to', message: 'Window end is in the future. Choose the current time or an earlier time.' };
}
