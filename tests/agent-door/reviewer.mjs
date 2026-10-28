// Trusted verification tooling drives the ordinary invitation and confirmation.
// Only accepted mail for this independent reviewer crosses the paid mail edge.
export default async function({request,origin,email,owner,mail}){
 const invited=await request(origin+'/api/organization/invites',{method:'POST',headers:{Origin:origin,Cookie:owner.cookie,'content-type':'application/json'},body:JSON.stringify({email,name:'Riley Reviewer',role:'admin',grants:[]})});
 if(!invited.ok){console.error('Spool reviewer invitation HTTP '+invited.status);throw Error('Native reviewer invitation failed');}
 await invited.body?.cancel();
 const message=mail.read({limit:20}).findLast(row=>row.text.includes('/auth/confirm?token='));
 const token=message?.text.match(/\/auth\/confirm\?token=([A-Za-z0-9_-]+)/)?.[1];
 if(!token){console.error('Spool reviewer accepted invitation mail unavailable');throw Error('Native reviewer confirmation is unavailable');}
 const confirmed=await request(origin+'/auth/confirm',{method:'POST',redirect:'manual',headers:{Origin:origin,'content-type':'application/json'},body:JSON.stringify({token})});
 if(confirmed.status!==303){console.error('Spool reviewer confirmation HTTP '+confirmed.status);throw Error('Native reviewer confirmation failed');}
 return confirmed;
}
