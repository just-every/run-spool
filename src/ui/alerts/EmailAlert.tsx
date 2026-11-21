import { useState } from 'react';
import { Field } from '../workbench/shared';
import { alertApi } from './client';

const testNotice = (test: {state:string;message:string}) => test.state !== 'passing'
 ? 'The test email failed. Check the address and try again.'
 : test.message.startsWith('Local development suppresses mail')
 ? 'No test email was sent. This copy runs on your computer.'
 : 'Your email service accepted the test. Check your inbox before turning on alerts.';

/** The short path uses the same destination test, explicit review and preview gates. */
export function EmailAlert({project,refresh}:{project:string;refresh:()=>void}) {
 const [address,setAddress]=useState(''),[destination,setDestination]=useState(''),[test,setTest]=useState<any>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState('');
 const remaining=!address.trim()?'Enter your email address.':!test?'Send a test email first.':test.state!=='passing'?'The test failed. Check the address and try again.':'Check the test result below, then turn on your alert.';
 async function sendTest(){
  setBusy(true);setError('');setSaved('');setTest(null);
  try{
   const result=destination?{id:destination}:await alertApi(`/api/projects/${project}/alerting/destinations`,'POST',{label:'New errors',recipient:address.trim()});
   setDestination(result.id);
   setTest(await alertApi(`/api/projects/${project}/alerting/destinations/${result.id}/test`,'POST',{}));
  }catch(failure){setError((failure as Error).message);}finally{setBusy(false);refresh();}
 }
 async function turnOn(){
  if(test?.state!=='passing')return;
  setBusy(true);setError('');
  try{
   await alertApi(`/api/projects/${project}/alerting/destinations/${destination}/review`,'POST',{testId:test.id});
   const rule={name:'New errors',destination,enabled:true,channel:'mail',kinds:['new_issue'],windowMs:300000,threshold:10,config:{metric:'count',filters:{},tagKeys:[]}};
   const preview=await alertApi(`/api/projects/${project}/alerting/rules/preview`,'POST',rule);
   if(preview.refusal||!preview.token)throw new Error(preview.refusal||'Review could not finish. Try again.');
   await alertApi(`/api/projects/${project}/alerting/rules`,'POST',{...rule,previewToken:preview.token});
   setSaved(`Email alert turned on for ${address.trim()}. ${testNotice(test)}`);setAddress('');setDestination('');setTest(null);refresh();
  }catch(failure){setError((failure as Error).message);}finally{setBusy(false);}
 }
 return <section className="evidence" aria-labelledby="email-alert-title"><h2 id="email-alert-title">Add an email alert</h2>
  <p>Email me about new errors.</p>
  <form onSubmit={event=>{event.preventDefault();void sendTest();}}>
   <Field label="Email me at" type="email" required maxLength={254} value={address} disabled={busy} autoComplete="email" onChange={event=>{setAddress(event.target.value);setDestination('');setTest(null);setSaved('');}}/>
   <ol><li>Enter your email address.</li><li>Send a test email and check the result.</li><li>Turn on alerts for new errors.</li></ol>
   <div className="button-row"><button className="text-button" disabled={busy||!address.trim()}>{busy&&!test?'Sending…':'Send test email'}</button><button type="button" className="primary-button" disabled={busy||test?.state!=='passing'} aria-describedby="email-alert-readiness" onClick={()=>void turnOn()}>Turn on</button></div>
   <p id="email-alert-readiness" role="status">{remaining}</p>
   {test&&<p role="status">{testNotice(test)}</p>}
  </form>
  {saved&&<p role="status">{saved}</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}
