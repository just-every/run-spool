import assert from 'node:assert/strict';
import {agentErasureStatements} from '../../src/modules/agent-door/index.ts';
import {operatorAgentArtifacts} from '../../src/domain/agent-door/artifact-map.mjs';

// Erasing al@example.com redacts every agent record that names that address, and no record that only names another
// person whose address ends with it (sal@example.com) or continues it (al@example.com.test).
export async function suffixEmailErasure(app){
 const record=(id,note)=>app.DB.prepare('INSERT INTO agent_door_audit(id,at,agent,classes,row,evidence) VALUES(?,?,?,?,?,?)')
  .bind(id,new Date().toISOString(),app.context.agentId,'[]',JSON.stringify({decision_id:id,tool:'spool.issues.update',outcome:'done',sponsor:{id:'',name:''}}),JSON.stringify({note}));
 const read=id=>app.DB.prepare('SELECT * FROM agent_door_audit WHERE id=?').bind(id).first();
 await app.DB.batch([record('suffix-al','Asked al@example.com to review'),record('suffix-sal','Asked sal@example.com to review'),record('suffix-au','Asked al@example.com.test to review'),record('suffix-dotted','Asked al@example.com. Thanks')]);
 const peers=['suffix-sal','suffix-au'],before=await Promise.all(peers.map(read));
 const statements=await agentErasureStatements({db:app.DB,map:operatorAgentArtifacts,subject:{values:JSON.stringify(['al@example.com']),policyRefs:'[]'},secret:'suffix-erasure',
  tombstone:{erasure_id:'suffix-erasure',at:new Date().toISOString()},checkpoint:async()=>[]});
 await app.DB.batch(statements);
 for(const id of ['suffix-al','suffix-dotted'])assert.equal((await read(id)).evidence,null,id+' names the erased address and is redacted');
 assert.deepEqual(await Promise.all(peers.map(read)),before,"another person's address that ends with or continues the erased one leaves their records untouched");
 console.log('Spool agent erasure: al@example.com erased; sal@example.com and al@example.com.test records byte-for-byte unchanged.');
}
