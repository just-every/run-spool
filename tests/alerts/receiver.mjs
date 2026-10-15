import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {verifyWebhook} from '../../src/modules/integrations/core/webhook.ts';
export const syntheticDestination='https://alerts.example.com/spool';
export const signingKey=new Uint8Array(32).fill(73);
export async function receiver(path) {
 let db=new DatabaseSync(path);db.exec('CREATE TABLE IF NOT EXISTS inbox(id TEXT PRIMARY KEY,body TEXT NOT NULL,fingerprint TEXT NOT NULL); CREATE TABLE IF NOT EXISTS effects(id TEXT PRIMARY KEY)');
 const requests=[],statuses=[],mailStatuses=[],relayRequests=[],redirectRequests=[];let mailCount=0;
 const server=createServer(async(req,res)=>{
  try {
   const chunks=[];for await(const part of req)chunks.push(part);const body=Buffer.concat(chunks);
   if(req.url==='/redirected'){redirectRequests.push(req.url);res.writeHead(202);res.end('{}');return;}
   if(req.url==='/relay'){const status=mailStatuses.shift()??202;relayRequests.push({url:req.headers['x-fixture-url'],redirect:req.headers['x-fixture-redirect'],method:req.method,authorization:req.headers.authorization,contentType:req.headers['content-type'],body:JSON.parse(body)});res.writeHead(status,{'content-type':'application/json','retry-after':'1',...(status===302?{location:url+'/redirected'}:{})});res.end(status===202?JSON.stringify({accepted:true}):JSON.stringify({error:'Relay mail unavailable'}));return;}
   if(req.url==='/mail') {mailCount++;const status=mailStatuses.shift()??200;res.writeHead(status,{'content-type':'application/json'});res.end(status===200?JSON.stringify({id:'synthetic-provider-receipt'}):'{}');return;}
   const verified=await verifyWebhook({body,headers:req.headers,key:signingKey,tenant:'spool.web',destinationId:'webhook-v1'});
   requests.push({body:verified.envelope.body,headers:req.headers});
   const status=statuses.shift()??204;if(status<200||status>=300){res.writeHead(status,{'retry-after':'1'});res.end();return;}
   db.exec('BEGIN IMMEDIATE');try{
    const existing=db.prepare('SELECT body,fingerprint FROM inbox WHERE id=?').get(verified.envelope.id);
    if(existing&&existing.fingerprint!==verified.fingerprint)throw new Error('replay_identity_conflict');
    if(!existing){db.prepare('INSERT INTO inbox VALUES(?,?,?)').run(verified.envelope.id,verified.envelope.body,verified.fingerprint);db.prepare('INSERT INTO effects VALUES(?)').run(verified.envelope.id);}
    db.exec('COMMIT');
   }catch(error){db.exec('ROLLBACK');throw error;}
   res.writeHead(204);res.end();
  }catch{res.writeHead(400);res.end('rejected');}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
 return {url,requests,statuses,mailStatuses,relayRequests,redirectRequests,get mailCount(){return mailCount},effects:()=>db.prepare('SELECT COUNT(*) n FROM effects').get().n,
  restart(){db.close();db=new DatabaseSync(path)},
  async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));db.close()},
 };
}
