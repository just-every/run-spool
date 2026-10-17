import type { SentryEvidence, SentryStack } from './evidence-types';
/** Agent packets never implicitly opt in to SDK source lines or frame locals. */
export function agentSentryEvidence(sentry:SentryEvidence):SentryEvidence {
 const stack=(value:SentryStack|undefined):SentryStack|undefined=>value?{
  frames:value.frames.map(frame=>{
   const {pre_context,context_line,post_context,vars,...identity}=frame;
   return identity;
  }),...(value.frames_omitted?{frames_omitted:value.frames_omitted}:{})
 }:undefined;
 return {
  version:1,platform:sentry.platform,
  exceptions:sentry.exceptions.map(e=>({...e,...(e.stacktrace?{stacktrace:stack(e.stacktrace)}:{})})),
  ...(sentry.stacktrace?{stacktrace:stack(sentry.stacktrace)}:{}),
  ...(sentry.tags?{tags:sentry.tags}:{}),...(sentry.contexts?{contexts:sentry.contexts}:{}),
  ...(sentry.level?{level:sentry.level}:{}),...(sentry.logger?{logger:sentry.logger}:{}),
  ...(sentry.message?{message:sentry.message}:{}),
  ...(sentry.logentry?{logentry:{message:sentry.logentry.message,formatted:sentry.logentry.formatted}}:{}),
  ...(sentry.fingerprint?{fingerprint:sentry.fingerprint}:{}),
  truncation:[...sentry.truncation,{path:'source_context,vars,request,extra,threads,breadcrumb_data',reason:'agent_field_selection_required'}],
 };
}
