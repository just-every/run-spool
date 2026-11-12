/** Keep calendar dates readable regardless of the browser's locale. */
export function date(time: number, timeZone = 'UTC', precision: 'minute' | 'second' | 'day' = 'minute') {
  const text = new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone,
    ...(precision !== 'day' ? { ...(precision === 'second' ? { second: '2-digit' as const } : {}), hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
  }).format(time);
  return precision === 'day' ? text : `${text} ${timeZone}`;
}
