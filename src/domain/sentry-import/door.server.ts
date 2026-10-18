import { createImportDoorHandler, writeImportDoorSettings } from '../../modules/import-kit/src/door/index.ts';
import { createImportOperatorHandler } from '../../modules/import-kit/src/door/operator.ts';
import type { ImportDoorSource } from '../../modules/import-kit/src/door/types.ts';
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
 if (name.startsWith(namespacePrefix)) {
  try { return sentryImport(sourceText(name.slice(namespacePrefix.length), 'organization')); } catch { return null; }
 }
 const held = await db.prepare('SELECT 1 FROM ik_door_namespaces WHERE installation_id=? AND namespace=?').bind(key, name).first();
 return held ? sentryImport() : null;
}

async function activeOwner(db: D1Database) {
 return db.prepare("SELECT id,email FROM oa_operators WHERE role='owner' AND status='active' ORDER BY id LIMIT 1").first<{ id: string; email: string }>();
}

/** Business grants: off until the owner enables them in Settings, and only
 * with RER's trusted key ring configured. */
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
 if (!await env.DB.prepare('SELECT 1 FROM ik_door_settings WHERE installation_id=?').bind(key).first()) await writeImportDoorSettings(env.DB, key, { enabled: false }, predicate);
 return createImportOperatorHandler({ database: env.DB, targets: sentryTargets, installationId: key, appOrigin: env.AUTH_ORIGIN,
  ownerEmail: owner.email, ownerPrincipalId: owner.id, namespace: name, destination: doorDestination, format: 'json', limits, ...source,
  authorize: async () => predicate })(request);
}

export async function importDoorResponse(request: Request, env: ManagedBindings) {
 const path = new URL(request.url).pathname;
 if (path.startsWith(grantPrefix)) return grantResponse(request, env);
 if (path.startsWith(operatorPrefix)) return operatorResponse(request, env);
 return null;
}
