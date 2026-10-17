import type { InboundEvent, InboundMetadata } from './types.ts';

export function requestHeader(event: InboundEvent, name: string): string | undefined {
 const headers = event.sentry?.request?.headers;
 if (Array.isArray(headers)) {
  for(const pair of headers)if(Array.isArray(pair)&&String(pair[0]).toLowerCase()===name&&typeof pair[1]==='string')return pair[1];
  return undefined;
 }
 if (headers && typeof headers === 'object') {
  const value = Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1];
  return typeof value === 'string' ? value : undefined;
 }
 return undefined;
}
export function inboundMetadata(event: InboundEvent, metadata: InboundMetadata = {}): InboundMetadata {
 return {
  ...metadata,
  userAgent: requestHeader(event, 'user-agent') ?? metadata.userAgent,
  origin: metadata.origin ?? requestHeader(event, 'origin'),
  referer: metadata.referer ?? requestHeader(event, 'referer'),
 };
}
export function exceptions(event: InboundEvent): any[] {
 return event.sentry?.exceptions ?? [];
}
export function messages(event: InboundEvent): string[] {
 const sentryMessage = event.sentry?.message;
 return [event.message, event.type, sentryMessage,
  ...exceptions(event).flatMap(e => [e.type, e.value])].filter((v): v is string => typeof v === 'string');
}
export function eventUrls(event: InboundEvent): string[] {
 const frames = [...(event.frames ?? []), ...exceptions(event).flatMap(e => e.frames ?? e.stacktrace?.frames ?? [])];
 return [event.sentry?.request?.url, ...frames.flatMap(f => [f.file, f.filename, f.abs_path])].filter((v): v is string => typeof v === 'string');
}
