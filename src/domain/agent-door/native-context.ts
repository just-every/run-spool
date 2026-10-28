import { AsyncLocalStorage } from 'node:async_hooks';
import type { ToolContext } from '../../modules/agent-door/types.ts';
import type { Operator } from '../../modules/operator-auth/index.mjs';

/** In-process native service admission. Never a cookie, HTTP header or person session. */
export interface AgentAuthority { kind: 'agent'; operator: Operator; agentContext: ToolContext }
const storage = new AsyncLocalStorage<{ request: Request; context: ToolContext }>();
export const withAgentRequest = <T>(request: Request, context: ToolContext, run: () => Promise<T>) => storage.run({ request, context }, run);
export function agentRequestContext(request?: Request) {
 const current = storage.getStore();
 return current && (!request || current.request === request) ? current.context : null;
}
