import type { AgentAuthority } from './native-authority';

export const localCredentialId=(clientId?:string)=>clientId?.startsWith('spool-key:')?clientId.slice(10):null;
export const agentActors = new WeakMap<Request, AgentAuthority>();
export const agentAuthority = (request: Request) => agentActors.get(request);
