// Flatten calculated report facts rather than exporting captured payloads or
// identity values. CSV repeats the explicit window, coverage and omissions.
function flatten(value: any, path = '', rows: { field: string; value: unknown }[] = []) {
 if (value === null || typeof value !== 'object') rows.push({ field: path, value });
 else for (const [key, child] of Object.entries(value)) flatten(child, path ? `${path}.${key}` : key, rows);
 return rows;
}
const cell = (value: unknown) => {
 const text = String(value ?? '');
 return '"' + (/^[\s\p{Cc}]*[=+\-@]/u.test(text) ? "'" + text : text).replaceAll('"', '""') + '"';
};
export function reportExport(report: any, format: string) {
 const rows = flatten(report), limit = 10000;
 if (rows.length > limit) return Response.json({ error: 'report_export_limit', matched: rows.length, limit, window: report.window, action: 'Choose a narrower project scope or window.' }, { status: 413 });
 const data = { ...report, bounds: { limit, rows: rows.length, complete: true, window: report.window } };
 const body = format === 'csv' ? ['field,value', ...flatten(data).map(r => `${cell(r.field)},${cell(r.value)}`)].join('\r\n') : JSON.stringify(data);
 return new Response(body, { headers: { 'Content-Type': format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json', 'Content-Disposition': `attachment; filename="spool-report.${format}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
