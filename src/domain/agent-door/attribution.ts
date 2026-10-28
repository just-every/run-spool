import {agentRequestContext,reviewerRequestContext} from './native-context';
/** Native chronology describes the actual preparer, sponsor and people. */
export function nativeAttribution(detail:object) {
 const agent=agentRequestContext();
 if(agent)return {...detail,preparedBy:agent.actor,approvers:agent.approvers};
 const review=reviewerRequestContext();
 return review?{...detail,performedBy:{id:review.person.id,name:review.person.name,label:review.actor.label}}:detail;
}
