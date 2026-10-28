import { createImportDoorHandler, DoorError, enableDoorAtFirstClaim, writeImportDoorSettings } from '../../modules/import-kit/src/door/index.ts';
import { createImportOperatorHandler } from '../../modules/import-kit/src/door/operator.ts';
import type { DoorRequest, ImportDoorSource } from '../../modules/import-kit/src/door/types.ts';
import { doorFence, erasures } from '../../modules/import-kit/src/door/store.ts';
import type { D1Sql } from '../../modules/import-kit/src/d1/types.ts';
import type { ImportMapping, SourceBundle } from '../../modules/import-kit/src/types.ts';
import { sha256, canonicalJson } from '../../modules/import-kit/src/provenance/identity.ts';
import { ownerSession, ownerWrite } from '../../auth/session.server';
import { ownerClaimConfig } from '../../editor/owner-claim-config.server';
import type { ManagedBindings } from '../../editor/bindings';
import { parseSentryOrganization, mappingVersion, sourceText } from './source';
import { organizationMapping } from './mapping';
import { sentryTargets } from './targets';
import { ownerImportPredicate } from './context';
import { ensureShortIds } from '../short-ids/assign';
import type { OwnerSession } from '../owner-authority';
import { ownerReadResponse } from './owner-reads.server';

/** Spool's one import pipeline: the owner's Sentry importer (owner session,
 * `/api/operator/import/*`) and Business (signed grants, `/api/rer/import/*`)
 * share Base's door, its lineage, history and undo. */
export const doorDestination = 'spool-owner';
const operatorPrefix = '/api/operator/import/', grantPrefix = '/api/rer/import/', namespacePrefix = 'sentry-org:';
const limits = { maxBytes: 2 * 1024 * 1024, maxRecordBytes: 2 * 1024 * 1024, maxRecords: 500 };

/** The permanent door key for settings, lineage and history. The first key an
 * installation stored stays; before that it is RER's owner-claim installation
 * id when one is configured, otherwise Spool's fixed key. */
export async function doorKey(env: ManagedBindings): Promise<string> {
 const stored = await env.DB.prepare('SELECT installation_id FROM ik_door_settings ORDER BY rowid LIMIT 1').first<{ installation_id: string }>();
 return stored?.installation_id ?? (env.RER_OWNER_CLAIM_INSTALLATION_ID?.trim() || 'spool');
}

/** One Sentry organization bundle per request: the parser checks the bundle
 * belongs to its namespace and builds the whole-bundle mapping it needs. Every
 * read of the upload parses it again from the start. */
function sentryImport(organization?: string): ImportDoorSource {
 let mapping: ImportMapping | undefined;
 return {
  parse(value, index) {
   if (index !== 0) throw new Error('One Sentry organization bundle required');
   const records = parseSentryOrganization(value);
   if (organization !== undefined && (records[0].payload as any).organization.slug !== organization) throw new Error('Bundle organization differs from its import namespace');
   // The operation key Business imports have always used: one bundle, one set of occurrence ids.
   mapping = organizationMapping({ records } as SourceBundle, 'business:' + sha256(canonicalJson(value)));
   return records;
  },
  mapping: { version: mappingVersion, map(record) {
   if (!mapping) throw new Error('Sentry bundle required');
   return mapping.map(record);
  } },
 };
}

/** The server-owned allow-list: `sentry-org:<organization slug>`, plus every
 * namespace this installation's door already holds, so earlier imports keep
 * their status, reconcile, undo and catch-up. Anything else is refused. */
export async function importSource(db: D1Database, key: string, name: string): Promise<ImportDoorSource | null> {
 // RER's Business export names the vendor: one `sentry` namespace per installation.
 if (name === 'sentry') return sentryImport();
 if (name.startsWith(namespacePrefix)) {
  try { return sentryImport(sourceText(name.slice(namespacePrefix.length), 'organization')); } catch { return null; }
 }
 const held = await db.prepare('SELECT 1 FROM ik_door_namespaces WHERE installation_id=? AND namespace=?').bind(key, name).first();
 return held ? sentryImport() : null;
}

async function activeOwner(db: D1Database) {
 return db.prepare("SELECT id,email FROM oa_operators WHERE role='owner' AND status='active' ORDER BY id LIMIT 1").first<{ id: string; email: string }>();
}

/** A real owner read admission for the same runtime and erasure fence as the
 * operator door. Used by both the existing history and per-plan reads. */
export async function ownerReadRequest(env:ManagedBindings, session:OwnerSession, key:string, namespace:string, source?:ImportDoorSource):Promise<DoorRequest> {
 const resolved = source ?? await importSource(env.DB,key,namespace);
 if (!resolved) throw new DoorError('unknown_import_source',400);
 const epoch = await erasures(env.DB,doorDestination), owner = ownerImportPredicate(session), fence = doorFence(key,namespace,doorDestination,epoch);
 return {options:{database:env.DB,targets:sentryTargets,ownerPrincipalId:session.operator.id,destination:doorDestination,format:'json',limits,...resolved},
  authority:{sql:`(${owner.sql}) AND (${fence.sql})`,params:[...owner.params,...fence.params ?? []]},via:'operator',epoch,
  access:{action:'status',installationId:key,email:session.operator.email,namespace,maxBytes:limits.maxBytes,maxChunks:1024,maxRecords:limits.maxRecords}};
}

/** Business-provisioned installs carry `RER_IMPORT_DOOR=on` from the owner's
 * approved plan; self-host `rer deploy` never sets it. There the owner's first
 * claim opens the Business door. This runs after every claim answer, owner
 * sign-in or session start and the owner's own import, so a failure between the
 * claim's commit and this one heals on the next owner path. Base creates the
 * settings row enabled only while none exists: a later claim changes nothing and
 * a door the owner turned off stays off. Before an owner exists nothing is written. */
export async function openDoorAtClaim(env: ManagedBindings): Promise<void> {
 if (env.RER_IMPORT_DOOR !== 'on') return;
 const ownerExists = { sql: "EXISTS(SELECT 1 FROM oa_operators WHERE role='owner' AND status='active')", params: [] };
 try { await enableDoorAtFirstClaim(env.DB, await doorKey(env), ownerExists); }
 catch (error) { if (!(error instanceof DoorError && error.code === 'owner_required')) throw error; }
}

/** Business grants: off until the owner enables them in Settings (or the first
 * claim does, on a Business-provisioned install), and only with RER's trusted
 * key ring configured, whatever the claim mode (bootstrap or signed). */
async function grantResponse(request: Request, env: ManagedBindings) {
 let claim;
 try { claim = ownerClaimConfig(env); } catch { return Response.json({ error: 'not_found' }, { status: 404 }); }
 const owner = await env.DB.prepare("SELECT id FROM oa_operators WHERE role='owner' AND status='active' AND email=?").bind(claim.expectedEmail).first<{ id: string }>();
 if (!owner) return Response.json({ error: 'not_found' }, { status: 404 });
 const key = await doorKey(env);
 return createImportDoorHandler({ database: env.DB, targets: sentryTargets, claim, installationId: key,
  ownerPrincipalId: owner.id, destination: doorDestination, format: 'json', limits,
  source: namespace => importSource(env.DB, key, namespace) })(request);
}

/** The owner's own imports: the current owner session, same-origin writes. */
async function operatorResponse(request: Request, env: ManagedBindings) {
 const session = await ownerSession(request, env), owner = await activeOwner(env.DB);
 const predicate: D1Sql | null = session && ownerWrite(request, env) ? ownerImportPredicate(session) : null;
 if (!owner || !predicate) return Response.json({ error: 'owner_required' }, { status: 401 });
 const name = request.headers.get('X-Import-Source') ?? '', key = await doorKey(env);
 const source = await importSource(env.DB, key, name);
 if (!source) return Response.json({ error: 'unknown_import_source' }, { status: 400 });
 await openDoorAtClaim(env);
 if (!await env.DB.prepare('SELECT 1 FROM ik_door_settings WHERE installation_id=?').bind(key).first()) await writeImportDoorSettings(env.DB, key, { enabled: false }, predicate);
 const action = new URL(request.url).pathname.slice(operatorPrefix.length);
 const read = await ownerReadRequest(env,session!,key,name,source);
 const response = await createImportOperatorHandler({ database: env.DB, targets: sentryTargets, installationId: key, appOrigin: env.AUTH_ORIGIN,
  ownerEmail: owner.email, ownerPrincipalId: owner.id, namespace: name, destination: doorDestination, format: 'json', limits, ...source,
  authorize: async () => predicate })(request);
 if (!response) return response;
 try { return await ownerReadResponse(read,response,action); }
 catch (error) {
  return Response.json({error:error instanceof DoorError ? error.code : 'import_door_conflict'},
   {status:error instanceof DoorError ? error.status : 409,headers:{'Cache-Control':'no-store'}});
 }
}

export async function importDoorResponse(request: Request, env: ManagedBindings) {
 const path = new URL(request.url).pathname;
 const response = path.startsWith(grantPrefix) ? await grantResponse(request, env) : path.startsWith(operatorPrefix) ? await operatorResponse(request, env) : null;
 // Imported issues take short IDs in first-seen order; issues an undo removed release theirs (TEAM-004).
 if (response?.ok && request.method === 'POST') await ensureShortIds(env.DB);
 return response;
}
