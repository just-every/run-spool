import * as zlib from 'node:zlib';
import { Readable } from 'node:stream';
import { zstdFrames } from './zstd-frames.ts';

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
  if (encoding === 'br') return inflateBounded(bytes, encoding, max);
  // Node 22 does not report an unfinished Zstandard frame at EOF. Check framing first,
  // then decode each complete frame so native content-size and checksum validation runs for all of them.
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (const frame of zstdFrames(bytes)) {
    const chunk = await inflateBounded(frame, encoding, max - size);
    chunks.push(chunk);
    size += chunk.length;
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}

async function inflateBounded(bytes: Uint8Array, encoding: 'br' | 'zstd', max: number): Promise<Uint8Array> {
  // Native streams pause at their high-water mark; never inflate the whole input before checking output.
  // A frame cannot ask Zstandard to allocate an unbounded history window before producing its first byte.
  const inflater = encoding === 'br' ? zlib.createBrotliDecompress({ chunkSize: 16_384 }) : zlib.createZstdDecompress({
    chunkSize: 16_384, params: { [zlib.constants.ZSTD_d_windowLogMax]: 23 },
  });
  const output = Readable.toWeb(inflater, { strategy: { highWaterMark: 16_384, size: chunk => chunk.byteLength } }) as ReadableStream<Uint8Array>;
  inflater.end(bytes);
  try {
    const plain = await readBounded(output, max);
    if (encoding === 'zstd' && inflater.bytesWritten !== bytes.length) throw new Error('Incomplete Zstandard decoding');
    return plain;
  }
  finally { inflater.destroy(); }
}
