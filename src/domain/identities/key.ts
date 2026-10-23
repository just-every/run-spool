/** One private key per project, shared by session DID and the SDK-008 policy. */
export async function prepareIdentityKey(db:D1Database,project:string){
 const row=await db.prepare('SELECT key FROM project_identity_keys WHERE project=?').bind(project).first<{key:string}>();
 const key=row?.key??Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
 return {key,jobs:[db.prepare('INSERT INTO project_identity_keys(project,key) VALUES(?,?) ON CONFLICT(project) DO NOTHING').bind(project,key),db.prepare('INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM project_identity_keys WHERE project=? AND key=?) THEN 1 ELSE 0 END').bind(project,key)]};
}
export async function identityHash(key:string,value:string){
 const bytes=Uint8Array.from(key.match(/../g)!,v=>parseInt(v,16)),secret=await crypto.subtle.importKey('raw',bytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',secret,new TextEncoder().encode('identity:'+value))),v=>v.toString(16).padStart(2,'0')).join('');
}
