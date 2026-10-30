import { ownerProjectRouter, ownerWrites, jsonBody } from '../owner-router';
import { identityHash } from './key';
import { readIdentityPolicy, identityPolicyFence } from './policy';
import { permittedValue } from './values';

/** Count retained email identities only. This door cannot erase or approve work. */
export const endUserErasurePreviewRoutes = ownerProjectRouter();
endUserErasurePreviewRoutes.post('/preview', async c => {
 c.header('Cache-Control', 'no-store');
 c.header('X-Content-Type-Options', 'nosniff');
 const project = c.req.param('project')!, db = c.env.DB;
 if (c.req.header('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new Error('JSON request required');
 const input = await jsonBody(c.req.raw, 1024);
 if (Object.keys(input).join() !== 'email' || typeof input.email !== 'string' ||
     permittedValue(input.email, 'email') !== input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
  throw new Error('Supply exactly one email, at most 320 characters');
 }
 const current = await readIdentityPolicy(db, project);
 // Never prepare or mint a key for a preview, even for an empty project.
 const secret = await db.prepare('SELECT key FROM project_identity_keys WHERE project=?').bind(project).first<{key:string}>();
 const digest = secret ? await identityHash(secret.key, input.email) : null;
 // Authority is checked within the batch on both sides of this read. No event,
 // identity, policy, key, journal, receipt or approval row is written.
 const [, result] = await ownerWrites(c, [identityPolicyFence(db, project, current.revision), db.prepare(`SELECT COUNT(*) retained,
  COALESCE(SUM(CASE WHEN json_extract(i.payload,'$.email.mode') IN ('keep','hash') THEN 1 ELSE 0 END),0) correlatable,
  COALESCE(SUM(CASE WHEN json_extract(i.payload,'$.email.mode') IN ('keep','hash') AND json_extract(i.payload,'$.email.hash')=? THEN 1 ELSE 0 END),0) matched
  FROM events e LEFT JOIN event_identities i ON i.project=e.project AND i.event=e.id AND i.occurrence=e.occurrence
  WHERE e.project=?`).bind(digest, project)]);
 const counts = result.results[0] as {retained:number;correlatable:number;matched:number};
 const reason = current.policy.email === 'drop' ? 'email_dropped' : !secret ? 'no_identity_key' : null;
 return c.json({version:1, scope:'retained_event_email', operation:'preview_only',
  events:{status:reason ? 'unavailable' : 'available', count:reason ? null : counts.matched,
   retained:counts.retained, withoutRetainedEmail:counts.retained-counts.correlatable,
   explanation:reason === 'email_dropped' ? 'Email is dropped by the current policy; discarded identities cannot be recovered.' :
    reason === 'no_identity_key' ? 'No retained project identity key is available; email matching is unavailable.' :
    'Exact retained email matches only. Events without a retained email cannot be correlated; this is not a complete erasure preview.'},
  unavailable:[
   {store:'sessions',reason:'Session DID hashes cannot be correlated with an email.'},
   {store:'feedback',reason:'Retained feedback has no email identity matching index.'},
   {store:'attachments',reason:'Attachment identity matching is not implemented.'},
   {store:'replays',reason:'Replay identity matching is not implemented.'},
   {store:'search',reason:'Identity search entries are not implemented.'},
  ],
 });
});
