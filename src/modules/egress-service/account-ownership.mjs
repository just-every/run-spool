import { boundedJSON } from '../deploy-kit/provider.mjs';

const host = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const refuse = () => { throw new Error('egress-account-ownership-unverified'); };

/** Read-only account-wide zone inventory. This API is not under /accounts/:id.
 * Only the fixed Cloudflare origin gets credentials. A partial inventory is unusable. */
export async function readAccountOwnership({ account, token, target, fetch: request = globalThis.fetch }) {
  if (!/^[a-f0-9]{32}$/.test(account) || target?.accountId !== account || typeof target.worker !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(target.worker) || typeof token !== 'string' || !token.trim() || /[\r\n]/.test(token)) refuse();
  let origin;
  try { origin = new URL(target.origin); } catch { refuse(); }
  const prefix = `${target.worker}.`;
  const suffix = origin.hostname.startsWith(prefix) ? origin.hostname.slice(prefix.length) : '';
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.port || origin.pathname !== '/' || origin.search || origin.hash
    || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.workers\.dev$/.test(suffix)) refuse();
  const zones = [], ids = new Set(), names = new Set();
  let total, pages;
  for (let page = 1; page <= 200; page++) {
    let response;
    try { response = await request(`https://api.cloudflare.com/client/v4/zones?account.id=${account}&page=${page}&per_page=50`, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(30000), headers: { Authorization: `Bearer ${token}` },
    }); } catch { refuse(); }
    if (!response.ok) { await response.body?.cancel().catch(() => {}); refuse(); }
    let data;
    try { data = await boundedJSON(response); } catch { refuse(); }
    const info = data?.result_info, rows = data?.result;
    if (data?.success !== true || !Array.isArray(rows) || (data.errors !== undefined && (!Array.isArray(data.errors) || data.errors.length))
      || !info || info.page !== page || info.per_page !== 50 || info.count !== rows.length
      || !Number.isSafeInteger(info.total_count) || info.total_count < 0 || info.total_count > 10000
      || !Number.isSafeInteger(info.total_pages) || !(info.total_pages === Math.max(1, Math.ceil(info.total_count / 50)) || info.total_count === 0 && info.total_pages === 0)) refuse();
    total ??= info.total_count; pages ??= info.total_pages;
    if (total !== info.total_count || pages !== info.total_pages || page > Math.max(1, pages) || rows.length !== Math.min(50, total - zones.length)) refuse();
    for (const row of rows) {
      if (!row || row.account?.id !== account || typeof row.id !== 'string' || !/^[a-f0-9]{32}$/.test(row.id) || typeof row.name !== 'string' || row.name.length > 253
        || !host.test(row.name) || /^[\d.]+$/.test(row.name) || ids.has(row.id) || names.has(row.name)) refuse();
      ids.add(row.id); names.add(row.name); zones.push(row.name);
    }
    if (page === Math.max(1, pages)) {
      if (zones.length !== total) refuse();
      const serialized = JSON.stringify(zones.sort());
      // Conservative 5 KB Worker variable budget, checked before any deployment write.
      if (Buffer.byteLength(serialized, 'utf8') > 5000) throw new Error('egress-account-ownership-too-large');
      return { EGRESS_OWNED_ZONES: serialized, EGRESS_WORKERS_SUFFIX: suffix };
    }
  }
  refuse();
}
