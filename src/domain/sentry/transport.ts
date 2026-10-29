import * as zlib from 'node:zlib';
import { Readable } from 'node:stream';

/** Default envelope bound shared by Sentry intake and the server tunnels. */
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
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) { await reader.cancel().catch(() => undefined); throw new TooLarge(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length; }
  return out;
}

/** The decoded envelope, inflated as a stream and bounded like the body; undefined for an unsupported encoding. */
export async function decodeBounded(bytes: Uint8Array, encoding: string | null, max = limit): Promise<Uint8Array | undefined> {
  if (!encoding || encoding === 'identity') return bytes;
  if (encoding === 'gzip' || encoding === 'deflate') {
    return readBounded(new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream(encoding)), max);
  }
  if (encoding !== 'br' && encoding !== 'zstd') return undefined;
  // Native streams pause at their high-water mark; never inflate the whole input before checking output.
  // A frame cannot ask Zstandard to allocate an unbounded history window before producing its first byte.
  const inflater = encoding === 'br' ? zlib.createBrotliDecompress({ chunkSize: 16_384 }) : zlib.createZstdDecompress({
    chunkSize: 16_384, params: { [zlib.constants.ZSTD_d_windowLogMax]: 23 },
  });
  const output = Readable.toWeb(inflater, { strategy: { highWaterMark: 16_384, size: chunk => chunk.byteLength } }) as ReadableStream<Uint8Array>;
  inflater.end(bytes);
  try { return await readBounded(output, max); }
  finally { inflater.destroy(); }
}
