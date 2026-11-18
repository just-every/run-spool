import { useId } from 'react';
import type { WindowProblem } from '../../domain/reports/window-validation';
import { date } from './dates';
export type ReportsWindowValue = { from: string; to: string; timeZone: string };
export function initialReportsWindow(): ReportsWindowValue { const to = Math.ceil(Date.now() / 60000) * 60000; return { from: new Date(to - 7 * 86400000).toISOString().slice(0, 16), to: new Date(to).toISOString().slice(0, 16), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }; }
export function reportWindowNumbers(value: ReportsWindowValue) { return { from: Date.parse(`${value.from}Z`), to: Date.parse(`${value.to}Z`), timeZone: value.timeZone }; }

function WindowEndpoint({ label, value, disabled, problem, onChange }: { label: string; value: string; disabled: boolean; problem?: string; onChange: (value: string) => void }) {
  const descriptionId = useId();
  const time = Date.parse(`${value}Z`);
  return <label className="form-field">{label}
    <input required type="datetime-local" aria-label={label} value={value} aria-invalid={!!problem || undefined} aria-describedby={problem || Number.isFinite(time) ? descriptionId : undefined} disabled={disabled} onChange={event => onChange(event.target.value)} />
    {problem ? <span id={descriptionId} role="alert">{problem}</span> : Number.isFinite(time) && <time id={descriptionId} className="muted" dateTime={new Date(time).toISOString()}>{date(time)}</time>}
  </label>;
}

export function ReportsWindow({ value, onChange, disabled = false, withTimeZone = true, problem }: { value: ReportsWindowValue; onChange: (value: ReportsWindowValue) => void; disabled?: boolean; withTimeZone?: boolean; problem?: WindowProblem }) {
  const timeZoneId = useId();
  return <>
    <WindowEndpoint label="Window start (UTC)" value={value.from} disabled={disabled} problem={problem?.field === 'from' ? problem.message : undefined} onChange={from => onChange({ ...value, from })} />
    <WindowEndpoint label="Window end (UTC)" value={value.to} disabled={disabled} problem={problem?.field === 'to' ? problem.message : undefined} onChange={to => onChange({ ...value, to })} />
    {withTimeZone && <label className="form-field">Report time zone<input required list={timeZoneId} value={value.timeZone} disabled={disabled} onChange={event => onChange({ ...value, timeZone: event.target.value })} /><datalist id={timeZoneId}>{['UTC', 'Australia/Brisbane', 'Australia/Sydney', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo'].map(zone => <option key={zone} value={zone} />)}</datalist></label>}
  </>;
}
export function reportsDuration(value: number | null | undefined) { if (value == null) return 'Unavailable'; if (value < 60000) return `${Math.round(value / 1000)} sec`; if (value < 3600000) return `${Math.round(value / 60000)} min`; if (value < 86400000) return `${(value / 3600000).toFixed(1)} hr`; return `${(value / 86400000).toFixed(1)} days`; }
