// The caller supplies its authenticated owner HTTP JSON helper.
export async function reviewRule(request,path,method,body){
 if(!body.enabled)return body;
 const match=/^(.*\/alerting\/rules)(?:\/([^/]+))?$/.exec(path);
 if(!match||!['POST','PUT'].includes(method)||method==='PUT'&&!match[2])throw new Error('Invalid rule preview request');
 const preview=await request(match[1]+'/preview','POST',{...body,...method==='PUT'?{ruleId:match[2]}:{}});
 if(typeof preview.token!=='string'||!preview.token)throw new Error('Rule preview did not authorize this enabled rule');
 return {...body,previewToken:preview.token};
}
