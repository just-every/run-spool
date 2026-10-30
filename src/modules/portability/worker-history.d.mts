import type { ArchivePolicy, MigrationReplay } from './index.mjs';
export interface MigrationEvidence {
 version:1;
 files:{name:string;sha256:string;statements:string[]}[];
 objects:{name:string;sql:string;type:string;tbl_name:string}[];
 prefixes:{objects:number[];shadows:string[];seeds:{name:string;columns:string[];hashes:string[]}[]}[];
}
/** Return a replay bound to the destination's hashed ledger and complete schema. */
export function workerMigrations(db:D1Database,policy:ArchivePolicy,evidence:MigrationEvidence):Promise<MigrationReplay>;
