import assert from 'node:assert/strict';
import {confirmEmailLink} from '../auth.mjs';
import {legacyMailRows} from '../legacy-mail.mjs';

export function unknownTimes(row, labels) {
 for (const field of ['createdAt','appliedAt','undoneAt']) assert.equal(row[field],null);
 assert.ok(labels[row.timestampsReasonCode], 'unrecorded job times have a renderable reason');
}
export function readableImport(row, planned, project, labels) {
 assert.deepEqual(row.counts ?? row.recordCounts,planned.counts,'history and status expose the reviewed record counts');
 assert.equal(row.organization,planned.organization);
 assert.deepEqual(row.projectIds,[project]);
 unknownTimes(row,labels);
}
export async function refusedImportReads(origin, ownerJson, project, planId) {
 for (const [index, role, projectRole] of [[1,'admin',null],[2,'member','maintainer'],[3,'member','member']]) {
  const email=`import-reader-${index}@example.test`, previousIds=(await legacyMailRows(origin)).map(row=>row.id);
  await ownerJson('/api/organization/invites','POST',{email,name:`Import reader ${index}`,role,
   grants:projectRole ? [{project,role:projectRole}] : []});
  const cookie=await confirmEmailLink(origin,email,{previousIds});
  await refused(cookie,projectRole ?? role);
 }
 await refused('','signed-out');
 async function refused(cookie,role) {
  for (const [path,body] of [['/api/imports/business'],['/api/operator/import/status',{planId}],['/api/operator/import/reconcile',{planId}]]) {
   const response=await fetch(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,Cookie:cookie,...body?{'Content-Type':'application/json','X-Import-Source':'sentry-org:fixture-org'}:{}},...body?{body:JSON.stringify(body)}:{}});
   assert.equal(response.status,401,`${role} cannot read installation import facts`);
   const answer=await response.json();
   assert.deepEqual(Object.keys(answer),['error'],'a refused read discloses no metadata');
  }
 }
 console.log('Import reads: admin, maintainer, member and signed-out all refused with 401 and error only.');
}
