import { AgentError } from './options.mjs';

// Canonical names combine the existing reads without adding routes or authority.
export function resolveOperation(operation, args = {}) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new AgentError('Tool arguments must be an object.');
  if (operation === 'spool.issues.read') {
    if (Object.hasOwn(args, 'issue')) {
      if (Object.keys(args).some(key => key !== 'issue')) throw new AgentError('Packet reads accept only an issue.');
      return 'get_packet';
    }
    if (Object.keys(args).some(key => !['state', 'limit'].includes(key))) throw new AgentError('Unexpected tool argument.');
    return 'list_issues';
  }
  if (operation === 'spool.outcomes.read') {
    if (Object.keys(args).length) throw new AgentError('Unexpected tool argument.');
    return 'get_outcomes';
  }
  if (operation === 'spool.grouping.propose') return Object.keys(args).length ? 'propose_grouping' : 'list_grouping_proposals';
  if (!['list_issues', 'get_packet', 'get_outcomes', 'list_grouping_proposals', 'propose_grouping'].includes(operation)) throw new AgentError('Unknown operation.');
  return operation;
}
