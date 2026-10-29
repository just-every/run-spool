import { ownerFetch } from './client';
import { PART_BYTES, type Job } from './move-in-model';

/** A refusal from the import door, by its code. */
export class DoorRefusal extends Error {
  constructor(readonly code: string, readonly status: number, readonly details?: any) { super(code); }
}
export const sentryNamespace = (slug: string) => `sentry-org:${slug}`;

// The owner's session cookie; a 401 here never signs the workbench out (see ownerFetch).
async function send(path: string, method: string, body?: unknown, headers: Record<string, string> = {}): Promise<any> {
  const response = await ownerFetch(path, { method, headers: { ...headers, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, false);
  const result: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new DoorRefusal(result.error ?? 'import_door_conflict', response.status, result.details);
  return result;
}
/** One action of the owner's import door, for the namespace that names the source. */
export const door = (namespace: string, action: string, body: object) => send(`/api/operator/import/${action}`, 'POST', body, { 'X-Import-Source': namespace });
export const readImports = () => send('/api/imports/business', 'GET');
export const writeImports = (value: { enabled: boolean; revokedKids?: string[] }) => send('/api/imports/business', 'POST', value);
/** History's Undo: the door's own undo step, as the owner, for any import. */
export const undoFromHistory = (planId: string) => send(`/api/imports/business/${encodeURIComponent(planId)}/undo`, 'POST');

const sha256 = async (bytes: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>))].map(byte => byte.toString(16).padStart(2, '0')).join('');
function base64(bytes: Uint8Array) {
  let text = '';
  for (let index = 0; index < bytes.length; index += 32_768) text += String.fromCharCode(...bytes.subarray(index, index + 32_768));
  return btoa(text);
}

/** Uploads the exact bytes in SHA-256-checked 64 KiB parts, one request at a time. */
export async function upload(namespace: string, bytes: Uint8Array, onPart: (received: number, parts: number) => void, go: () => boolean) {
  const bundleSha256 = await sha256(bytes), totalChunks = Math.ceil(bytes.length / PART_BYTES);
  let uploadId: string | undefined;
  for (let index = 0; index < totalChunks && go(); index++) {
    const part = bytes.subarray(index * PART_BYTES, (index + 1) * PART_BYTES);
    const result = await door(namespace, 'uploads', { ...(uploadId ? { uploadId } : {}), name: 'sentry-organization.json', bundleSha256,
      totalBytes: bytes.length, totalChunks, index, chunkSha256: await sha256(part), base64: base64(part) });
    uploadId = result.uploadId; onPart(result.received.length, totalChunks);
  }
  // The door checks the parts again when it plans: an incomplete upload is refused by name.
  return uploadId;
}

const moving = ['queued', 'applying', 'undoing', 'rolling_back'];
/** Repeats one bounded apply or undo step while its job moves: one request at a
 * time, stopping at the first refusal, when the job settles or when `go` ends. */
export async function repeat(step: () => Promise<any>, onJob: (job: Job) => void, go: () => boolean): Promise<any> {
  for (;;) {
    const result: any = await step();
    if (result.job) onJob(result.job);
    if (!result.job || !moving.includes(result.job.state) || !go()) return result;
  }
}
