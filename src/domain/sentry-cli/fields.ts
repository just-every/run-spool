import type { Context } from 'hono';
import { refuse } from './errors';

/** Validate the original JSON object, after authority and before any product write.
 * Route templates identify the endpoint without echoing identifiers or input values. */
export function supportedFields(c: Context, body: unknown, fields: readonly string[]): asserts body is Record<string, any> {
 const endpoint = `${c.req.method} ${c.req.routePath}`;
 if (!body || typeof body !== 'object' || Array.isArray(body)) return refuse(400, `Expected a JSON object for ${endpoint}.`);
 const field = Object.keys(body).find(name => !fields.includes(name));
 if (field !== undefined) {
  const label = JSON.stringify(field.slice(0, 64)) + (field.length > 64 ? ' (truncated)' : '');
  refuse(400, `Unsupported field ${label} for ${endpoint}.`);
 }
}
