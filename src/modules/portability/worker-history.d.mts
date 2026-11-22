import type { ArchivePolicy, MigrationReplay } from './index.mjs';
type MigrationFile = {name:string;sha256:string;statements:string[]};
type OwnerSource = {prefix:string;table:string};
type SchemaObject = {name:string;sql:string;type:string;tbl_name:string};
type SeedRows = {name:string;columns:string[];hashes:string[]};
type Prefix = {objects:number[];shadows:string[];seeds:SeedRows[]};
interface BundledEvidence {
 version:1;
 files:MigrationFile[];
 ownerSources?:OwnerSource[];
 objects:SchemaObject[];
 prefixes:Prefix[];
 nativeOrder?:number[];
 nativePrefixes?:Prefix[];
}
type OrderedFile = MigrationFile & {table?:string};
interface OrderedEvidence {
 version:2;
 files:OrderedFile[];
 ownerSources:OwnerSource[];
 nativeOrder?:number[];
 nativePrefix(history:{table:string;owners?:boolean;entries:{name:string;table?:string;sha256?:string}[]},files:OrderedFile[]):boolean;
 snapshots(names:string[]):Promise<{
  inventory(index:number):{objects:SchemaObject[];kinds:{name:string;type:string}[]};
  seeds:SeedRows[];
 }>;
}
export type MigrationEvidence = BundledEvidence | OrderedEvidence;
/** Return a replay bound to the destination's hashed history or exact native Wrangler prefix, and complete schema. */
export function workerMigrations(db:D1Database,policy:ArchivePolicy,evidence:MigrationEvidence):Promise<MigrationReplay>;
