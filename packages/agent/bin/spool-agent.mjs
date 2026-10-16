#!/usr/bin/env node
import { AgentError, HELP, parseArgs } from '../src/options.mjs';
import { configuration, request } from '../src/transport.mjs';
import { markdown } from '../src/format.mjs';
import { packetMarkdown } from '../src/packet-markdown.mjs';

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) process.stdout.write(HELP);
  else {
    const config = await configuration(options);
    if (options.command === 'mcp') {
      // HTTP commands load only built-in Node modules; SDK is optional to those commands.
      const { startMcp } = await import('../src/mcp.mjs');
      await startMcp(config);
    } else {
      const operation = { issues: 'list_issues', packet: 'get_packet', outcomes: 'get_outcomes' }[options.command];
      const value = await request(config, operation, options);
      process.stdout.write(options.format === 'json' ? `${JSON.stringify(value, null, 2)}\n` : options.command === 'packet' ? packetMarkdown(value) : markdown(value));
    }
  }
} catch (error) {
  const safe = error instanceof AgentError ? error : new AgentError('Spool agent is unavailable; check the local installation.');
  process.stderr.write(markdown({ error: safe.message, exitCode: safe.exitCode }));
  process.exitCode = safe.exitCode;
}
