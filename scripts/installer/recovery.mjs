import { readdir, lstat, unlink, rmdir, mkdtemp, copyFile, rm, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { createHash, createHmac } from 'node:crypto';
import { LocalStateSafetyError } from '@runeditrun/rer/local/state';
import { readPrivateFile, writePrivateFile, privateDirectory } from '@runeditrun/rer/private-files';
import { validateWalSnapshot } from './wal-inspection.mjs';

const missing = error => { if (error.code === 'ENOENT') return null; throw error; };
const refusal = () => new LocalStateSafetyError('Existing local data needs explicit recovery. Preserve all state and grants; follow OPERATIONS.md before changing the database identity. No data was moved.');

// Workerd idFromName for the explicitly local binding. A database with the
// right schema under another identity must not permit a fresh replacement.
// https://github.com/cloudflare/workers-sdk/blob/2df1d066cfe376b831ff0b29b656437d869791e5/packages/miniflare/src/plugins/shared/index.ts#L219-L231
function applicationFile() {
 const key = createHash('sha256').update('miniflare-D1DatabaseObject').digest();
 const name = createHmac('sha256', key).update('errors-local').digest().subarray(0, 16);
 const signature = createHmac('sha256', key).update(name).digest().subarray(0, 16);
 return Buffer.concat([name, signature]).toString('hex') + '.sqlite';
}

function namespaceMetadata(db) {
 // Workerd's namespace alarm scheduler is a second SQLite file, not another
 // D1 binding. Require its actual shape and empty scheduler, not a filename
 // exemption or a blanket allowance for tables starting with _cf_.
 const objects = db.prepare('SELECT type, name, sql FROM sqlite_master').all();
 if (objects.length !== 1 || objects[0].type !== 'table' || objects[0].name !== '_cf_ALARM') throw refusal();
 // PRAGMA columns omit CHECK and COLLATE, and sqlite_* filtering hides UNIQUE
 // indexes. Accept only Workerd's DDL, including its actor_name ALTER migration;
 // SQLite omits IF NOT EXISTS and the semicolon when storing this definition.
 // https://github.com/cloudflare/workerd/blob/main/src/workerd/server/alarm-scheduler.c%2B%2B
 const schema = /^CREATE\s+TABLE\s+_cf_ALARM\s*\(\s*actor_id\s+TEXT\s+PRIMARY\s+KEY\s*,\s*scheduled_time\s+INTEGER\s*,\s*actor_name\s+TEXT\s*\)\s+WITHOUT\s+ROWID\s*$/i;
 if (!schema.test(objects[0].sql)) throw refusal();
 const columns = db.prepare('PRAGMA table_xinfo(_cf_ALARM)').all();
 if (columns.length !== 3 || columns.some((column, index) =>
  column.cid !== index || column.hidden !== 0 || column.dflt_value !== null || column.notnull !== (index === 0 ? 1 : 0) ||
  column.name !== ['actor_id', 'scheduled_time', 'actor_name'][index] ||
  column.type !== ['TEXT', 'INTEGER', 'TEXT'][index] || column.pk !== (index === 0 ? 1 : 0))) throw refusal();
 const table = db.prepare('PRAGMA table_list(_cf_ALARM)').get();
 if (!table || table.schema !== 'main' || table.type !== 'table' || table.ncol !== 3 || table.wr !== 1 || table.strict !== 0) throw refusal();
 if (db.prepare('SELECT 1 FROM _cf_ALARM LIMIT 1').get()) throw refusal();
}

export async function inspectExistingState({ root, input = {}, vars = {}, allowPlatformLedger = false, inspectDatabase }) {
 const directory = join(root, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
 let parent = root;
 for (const part of ['.wrangler','state','v3','d1','miniflare-D1DatabaseObject']) {
  parent = join(parent, part); const status = await lstat(parent).catch(missing);
  if (!status) return; if (!status.isDirectory() || status.isSymbolicLink() || status.uid !== process.getuid()) throw refusal();
 }
 const files = await readdir(directory, { withFileTypes: true }).catch(missing);
 if (!files) return;
 const candidates = files.filter(file => file.name.endsWith('.sqlite'));
 // SQLite may open sidecars even in read-only mode. Validate those paths too,
 // including orphan sidecars, before opening any database.
 for (const file of files.filter(file => /\.sqlite(?:-wal|-shm|-journal)?$/.test(file.name))) {
  const info = await lstat(join(directory, file.name));
  if (!file.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.uid !== process.getuid()) throw refusal();
  if (!file.name.endsWith('.sqlite') && !candidates.some(candidate => file.name.startsWith(candidate.name + '-'))) throw refusal();
 }
 for (const file of candidates) {
  const path = join(directory, file.name), info = await lstat(path);
  if (!file.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.uid !== process.getuid()) throw refusal();
  if (file.name !== 'metadata.sqlite' && file.name !== applicationFile()) throw refusal();
  let db, snapshot, checked = false;
  try {
   let inspectPath = path;
   const header = Buffer.alloc(20), handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
   try { await handle.read(header, 0, header.length, 0); } finally { await handle.close(); }
   const hasWal = files.some(candidate => candidate.name === file.name + '-wal');
   if (hasWal || header[18] === 2 || header[19] === 2) {
    // A read-only WAL connection can write the original shared-memory file.
    // It can also create missing sidecars for a closed WAL-mode database.
    // Read a private snapshot instead; immutable=1 would silently ignore WAL.
    snapshot = await mkdtemp(join(tmpdir(), 'spool-state-inspection-'));
    inspectPath = join(snapshot, 'database.sqlite');
    const sources = hasWal ? [path, path + '-wal'] : [path];
    const before = await Promise.all(sources.map(name => lstat(name)));
    await copyFile(path, inspectPath); if (hasWal) await copyFile(path + '-wal', inspectPath + '-wal');
    const after = await Promise.all(sources.map(name => lstat(name)));
    if (before.some((status, index) => ['ino', 'size', 'mtimeMs', 'ctimeMs'].some(key => status[key] !== after[index][key]))) throw refusal();
    if (!hasWal && await lstat(path + '-wal').catch(missing)) throw refusal();
    if (hasWal) await validateWalSnapshot(inspectPath);
   }
   db = new DatabaseSync(inspectPath, { readOnly: true });
   if (file.name === 'metadata.sqlite') { namespaceMetadata(db); continue; }
   const objects = db.prepare("SELECT type, name FROM sqlite_master WHERE name NOT GLOB 'sqlite_*'").all();
   const tables = new Set(objects.filter(object => object.type === 'table').map(row => row.name));
   const ledgers = ['d1_migrations', 'rer_migrations', '_rer_deploy_migrations'].filter(name => tables.has(name));
   if (ledgers.length > 1 || tables.has('_rer_deploy_migrations')) throw refusal();
   // A former fake binding id maps to another Miniflare database. Never silently
   // create an empty replacement beside an existing database or replay its ledger.
   if (tables.has('projects') && !tables.has('oa_operators')) throw refusal();
   if (!tables.has('projects') && objects.every(object => object.type === 'table' && ['_cf_METADATA', '_cf_KV', 'd1_migrations'].includes(object.name))) {
    if (tables.has('d1_migrations') && db.prepare('SELECT 1 FROM d1_migrations LIMIT 1').get()) throw refusal();
    if (tables.has('_cf_KV') && db.prepare('SELECT 1 FROM _cf_KV LIMIT 1').get()) throw refusal();
    continue;
   }
   const ledger = ledgers[0];
   // Setup/dev still use Wrangler's native migration runner. Only portability
   // opts into Platform history, with its name/hash preflight before any apply.
   if (!tables.has('projects') || !ledger || !tables.has('oa_operators') || (ledger === 'rer_migrations' && !allowPlatformLedger)) throw refusal();
   if (!db.prepare(`SELECT 1 FROM ${ledger} WHERE name=?`).get('0004_operator_auth.sql')) throw refusal();
   const owners = db.prepare("SELECT email FROM oa_operators WHERE role='owner'").all();
   const email = input.OWNER_EMAIL ?? vars.OWNER_EMAIL;
   if (owners.length > 1 || (owners.length && email && owners[0].email !== email.trim().toLowerCase())) {
    throw new LocalStateSafetyError('Setup identity conflicts with the existing owner. Existing settings and data were kept. Sign in as that owner.');
   }
   checked = true;
  } catch (error) { if (error instanceof LocalStateSafetyError) throw error; throw refusal(); }
  // A caller's own read of the checked application database keeps its refusal.
  finally { try { if (checked) await inspectDatabase?.(db); } finally { try { db?.close(); } finally { if (snapshot) await rm(snapshot, { recursive: true, force: true }); } } }
 }
}
export async function retirePassword({ root }) {
 // Only after a successful real owner claim/preservation and local owner
 // sign-in. Shared private-file helpers reject linked or unsafe private paths.
 const settings = await readPrivateFile(join(root, '.dev.vars')).catch(missing);
 if (settings !== null && /^OWNER_PASSWORD=/m.test(settings)) {
  await writePrivateFile(join(root, '.dev.vars'), settings.replace(/^OWNER_PASSWORD=.*(?:\r?\n|$)/gm, ''));
 }
 const path = join(root, '.local/owner-password.txt');
 if (await lstat(path).catch(missing)) { await privateDirectory(root, ['.local']); await readPrivateFile(path); await unlink(path); }
 await rmdir(join(root, '.local')).catch(error => { if (!['ENOENT', 'ENOTEMPTY'].includes(error.code)) throw error; });
}
