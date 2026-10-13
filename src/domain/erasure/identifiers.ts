import { tombstone } from '../../modules/portability/journal.mjs';

// An erased project's identifier stays fenced: its tombstone would refuse every
// later archive holding a new project, issue or release under the same key.
export async function erasedProjectIdentifier(db: D1Database, id: string) {
 const sources = (await db.prepare('SELECT DISTINCT source FROM rer_portability_journal').all<{ source: string }>()).results;
 const hashes = await Promise.all(sources.map(({ source }) => tombstone(source, 'projects', { id })));
 return hashes.length > 0 && !!await db.prepare('SELECT 1 FROM rer_portability_journal WHERE tombstone IN (SELECT value FROM json_each(?)) LIMIT 1').bind(JSON.stringify(hashes)).first();
}
