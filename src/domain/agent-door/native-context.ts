import { AsyncLocalStorage } from 'node:async_hooks';
import type { ToolContext, UndoContext } from '../../modules/agent-door/types.ts';
import type { Operator } from '../../modules/operator-auth/index.mjs';

/** In-process native service admission. Never a cookie, HTTP header or person session. */
export interface AgentAuthority { kind: 'agent'; operator: Operator; agentContext: ToolContext }
export interface ReviewerAuthority { kind: 'native-reviewer'; operator: Operator; reviewContext: UndoContext }
const storage = new AsyncLocalStorage<{ request: Request; context: ToolContext }>();
const reviews = new AsyncLocalStorage<{request:Request;context:UndoContext}>();
export const withAgentRequest = <T>(request: Request, context: ToolContext, run: () => Promise<T>) => storage.run({ request, context }, run);
export const withReviewerRequest = <T>(request:Request,context:UndoContext,run:()=>Promise<T>)=>reviews.run({request,context},run);
export const reviewerRequestContext=(request?:Request)=>{const review=reviews.getStore();return review&&(!request||review.request===request)?review.context:null;};
export function agentRequestContext(request?: Request) {
 const current = storage.getStore();
 return current && (!request || current.request === request) ? current.context : null;
}
