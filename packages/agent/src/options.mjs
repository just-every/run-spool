export class AgentError extends Error {
  constructor(message, exitCode = 4) { super(message); this.exitCode = exitCode; }
}

export const HELP = `spool-agent issues [--state open|all] [--limit n]
spool-agent packet <issue> [--format markdown|json]
spool-agent outcomes
spool-agent propose (--file <path> | --stdin) [--format markdown|json]
spool-agent proposals [--format markdown|json]
spool-agent mcp
Key: SPOOL_AGENT_KEY, --key-file <path>, or --key-stdin (HTTP only).
Key options and --timeout-ms may appear before or after the command.
SPOOL_URL must be the exact project API root. Optional --timeout-ms n (default 10000).
Exit: 0 success, 2 unauthorized, 3 missing or out of scope, 4 unavailable/invalid input.
`;

export function parseArgs(args) {
  const options = { state: 'all', format: 'markdown', timeout: 10000 };
  let index = 0;
  const seen = new Set();
  while (index < args.length) {
    const flag = args[index++];
    if (['--help', '-h'].includes(flag)) return { help: true };
    if (!flag.startsWith('--')) {
      if (!options.command) {
        if (!['issues', 'packet', 'outcomes', 'propose', 'proposals', 'mcp'].includes(flag)) throw new AgentError('Choose issues, packet, outcomes, propose, proposals, or mcp; use --help.');
        options.command = flag;
      } else if (options.command === 'packet' && options.issue === undefined) options.issue = flag;
      else throw new AgentError('Unexpected argument; use --help.');
      continue;
    }
    if (seen.has(flag)) throw new AgentError('Duplicate option.');
    seen.add(flag);
    if (flag === '--key-stdin') { options.keyStdin = true; continue; }
    if (flag === '--stdin' && options.command === 'propose') { options.proposalStdin = true; continue; }
    const allowed = ['--key-file', '--timeout-ms', ...(options.command === 'issues' ? ['--state', '--limit'] : []), ...(['packet', 'propose', 'proposals'].includes(options.command) ? ['--format'] : []), ...(options.command === 'propose' ? ['--file'] : [])];
    if (!allowed.includes(flag) || index === args.length || args[index].startsWith('--')) throw new AgentError('Unknown or incomplete option; use --help.');
    const value = args[index++];
    if (flag === '--key-file') options.keyFile = value;
    if (flag === '--file') options.proposalFile = value;
    if (flag === '--timeout-ms') options.timeout = positiveInteger(value, 120000);
    if (flag === '--limit') options.limit = positiveInteger(value, 100);
    if (flag === '--state') { if (!['open', 'all'].includes(value)) throw new AgentError('State must be open or all.'); options.state = value; }
    if (flag === '--format') { if (!['markdown', 'json'].includes(value)) throw new AgentError('Format must be markdown or json.'); options.format = value; }
  }
  if (!options.command) throw new AgentError('Choose issues, packet, outcomes, propose, proposals, or mcp; use --help.');
  if (options.keyFile && options.keyStdin) throw new AgentError('Choose one key input.');
  if (options.command === 'mcp' && options.keyStdin) throw new AgentError('MCP reserves stdin for protocol; use environment or key file.');
  if (options.command === 'packet') validateIssue(options.issue);
  if (options.command === 'propose') {
    if (Boolean(options.proposalFile) === Boolean(options.proposalStdin)) throw new AgentError('Choose one proposal input: --file or --stdin.');
    if (options.proposalStdin && options.keyStdin) throw new AgentError('Proposal stdin requires a key from environment or file.');
  }
  return options;
}

export function positiveInteger(value, maximum) {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > maximum) throw new AgentError('Invalid numeric option.');
  return Number(value);
}

export function validateIssue(issue) {
  if (typeof issue !== 'string' || !/^[A-Za-z0-9._:-]{1,100}$/.test(issue) || issue === '.' || issue === '..') throw new AgentError('Invalid issue identity.', 3);
  return issue;
}
