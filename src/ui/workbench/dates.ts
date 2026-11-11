/** Keep calendar dates readable regardless of the browser's locale. */
export function date(time: number, timeZone = 'UTC', precision: 'minute' | 'day' = 'minute') {
  const text = new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone,
    ...(precision === 'minute' ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
  }).format(time);
  return precision === 'day' ? text : `${text} ${timeZone}`;
}
