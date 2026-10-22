/** The tunnel's envelope limit, applied to the bytes received and again to the decoded envelope. */
export const limit = 1_048_576;

export class TooLarge extends Error {}

/**
 * Reads a stream into memory, holding at most `max` bytes: one byte more cancels the stream and throws
 * TooLarge, so an oversized or decompression-bomb body is refused without being read or inflated further.
 */
export async function readBounded(stream: ReadableStream<Uint8Array> | null, max = limit): Promise<Uint8Array<ArrayBuffer>> {
  if (!stream) return new Uint8Array();
  const reader = stream.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) { await reader.cancel().catch(() => undefined); throw new TooLarge(); }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length; }
  return out;
}

/** The decoded envelope, inflated as a stream and bounded like the body; undefined for an unsupported encoding. */
export async function decodeBounded(bytes: Uint8Array, encoding: string | null): Promise<Uint8Array | undefined> {
  if (!encoding || encoding === 'identity') return bytes;
  if (encoding !== 'gzip' && encoding !== 'deflate') return undefined;
  return readBounded(new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream(encoding)));
}
