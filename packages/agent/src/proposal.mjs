import { createReadStream } from 'node:fs';
import { AgentError } from './options.mjs';

// Bound proposal bytes before decoding; the server validates and scrubs every field.
export const PROPOSAL_BYTES = 32768;
export async function readProposal(options) {
  const stream = options.proposalStdin ? process.stdin : createReadStream(options.proposalFile);
  const chunks = [];
  let bytes = 0;
  try {
    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.byteLength;
      if (bytes > PROPOSAL_BYTES) throw new AgentError('Proposal exceeds 32768 UTF-8 bytes.');
      chunks.push(buffer);
    }
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AgentError('Proposal must be a JSON object.');
    return value;
  } catch (error) {
    if (error instanceof AgentError) throw error;
    throw new AgentError('Unable to read proposal JSON.');
  }
}

const identity = { type: 'string', minLength: 1, maxLength: 100 };
const revision = { type: 'integer', minimum: 0 };
export const proposalSchema = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['split', 'merge', 'rule'] },
    source: identity, revision,
    events: { type: 'array', items: identity, minItems: 1, maxItems: 200, uniqueItems: true },
    target: identity, targetRevision: revision,
    policy: { type: 'object', properties: { version: { type: 'integer', enum: [1] }, stack: { type: 'string', maxLength: 16000, description: 'Spool stack rule language; empty when unused.' }, fingerprint: { type: 'string', maxLength: 16000, description: 'Spool fingerprint rule language; empty when unused.' } }, required: ['version', 'stack', 'fingerprint'], additionalProperties: false },
    policyRevision: revision,
    variants: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'object', properties: { stack: { type: 'string', maxLength: 4000, description: 'JSON.stringify of the packet event frames.' }, release: { type: 'string', maxLength: 200 }, route: { type: 'string', maxLength: 500, description: 'Sanitized Sentry transaction/request URL, or empty when unavailable.' } }, required: ['stack', 'release', 'route'], additionalProperties: false } },
    rationale: { type: 'string', minLength: 1, maxLength: 2000 },
    window: { type: 'object', description: 'Received-time Unix milliseconds; positive duration, at most 31 days.', properties: { start: { type: 'integer', minimum: 0 }, end: { type: 'integer', minimum: 0 } }, required: ['start', 'end'], additionalProperties: false },
  },
  required: ['kind', 'source', 'revision', 'variants', 'rationale', 'window'],
  oneOf: [
    { properties: { kind: { const: 'split' } }, required: ['events'] },
    { properties: { kind: { const: 'merge' } }, required: ['target', 'targetRevision'] },
    { properties: { kind: { const: 'rule' } }, required: ['policy', 'policyRevision'] },
  ],
  additionalProperties: false,
};
