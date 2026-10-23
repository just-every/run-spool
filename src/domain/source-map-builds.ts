import {auditCommit} from './audit/context';
export const sourceMapBuildTables={source_map_builds:['project','release','build','expected','created'],source_map_build_files:['project','release','build','name','debug','digest']};
export function requiredMapNames(value:unknown):string[]{
 if(!Array.isArray(value)||!value.length||value.length>2000||value.some(n=>typeof n!=='string'||!n||n.length>1024||/[\u0000-\u001f\u007f]/.test(n)))throw new Error('Expected one to 2000 required map names');
 if(new Set(value).size!==value.length)throw new Error('Duplicate required map name');
 return [...value].sort();
}
export function buildSetStatements(db:D1Database,project:string,release:string,build:string,names:unknown){
 if(names===undefined)return [];
 const expected=JSON.stringify(requiredMapNames(names));
 return [db.prepare('INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM source_map_builds WHERE project=? AND release=? AND build=?) OR EXISTS(SELECT 1 FROM source_map_builds WHERE project=? AND release=? AND build=? AND expected=?) THEN 1 ELSE 0 END').bind(project,release,build,project,release,build,expected),db.prepare('INSERT INTO source_map_builds(project,release,build,expected,created) VALUES(?,?,?,?,?) ON CONFLICT(project,release,build) DO NOTHING').bind(project,release,build,expected,Date.now()),auditCommit(db,'changes()=1')];
}
export function buildFileStatement(db:D1Database,project:string,release:string,build:string,name:string|undefined,debug:string,digest:string){
 if(name===undefined)return [];
 requiredMapNames([name]);
 return [db.prepare('INSERT INTO source_map_build_files(project,release,build,name,debug,digest) VALUES(?,?,?,?,?,?) ON CONFLICT(project,release,build,name) DO NOTHING').bind(project,release,build,name,debug,digest),auditCommit(db,'changes()=1'),db.prepare('INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM source_map_build_files WHERE project=? AND release=? AND build=? AND name=? AND debug=? AND digest=?) THEN 1 ELSE 0 END').bind(project,release,build,name,debug,digest)];
}
export async function readBuildSet(db:D1Database,project:string,release:string,build:string){
 const row=await db.prepare('SELECT expected FROM source_map_builds WHERE project=? AND release=? AND build=?').bind(project,release,build).first<{expected:string}>();
 if(!row)return null;
 const present=(await db.prepare('SELECT f.name FROM source_map_build_files f JOIN artifacts a ON a.project=f.project AND a.release=f.release AND a.build=f.build AND a.debug=f.debug AND a.digest=f.digest WHERE f.project=? AND f.release=? AND f.build=?').bind(project,release,build).all<{name:string}>()).results;
 const names=new Set(present.map(r=>r.name)),missing=requiredMapNames(JSON.parse(row.expected)).filter(name=>!names.has(name));
 return {release,build,state:missing.length?'incomplete':'complete',missing};
}
export function validateSourceMapBuilds(data:any){
 for(const row of data.source_map_builds){requiredMapNames(JSON.parse(row.expected));if(!Number.isSafeInteger(row.created)||row.created<0||!data.releases.some((r:any)=>r.project===row.project&&r.name===row.release))throw new Error('Archive artifact build');}
 for(const row of data.source_map_build_files){requiredMapNames([row.name]);if(!/^[a-f0-9]{64}$/.test(row.digest)||typeof row.debug!=='string'||!row.debug||!data.releases.some((r:any)=>r.project===row.project&&r.name===row.release))throw new Error('Archive artifact build file');}
}
