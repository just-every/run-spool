/** Complete Zstandard frames, including skippable frames, without inflating their contents. */
export function* zstdFrames(bytes: Uint8Array): Generator<Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  const take = (size: number) => {
    if (size > bytes.length - offset) throw new Error('Truncated Zstandard frame');
    const start = offset;
    offset += size;
    return start;
  };
  while (offset < bytes.length) {
    const start = offset, magic = view.getUint32(take(4), true);
    if (magic >= 0x184d2a50 && magic <= 0x184d2a5f) {
      take(view.getUint32(take(4), true));
    } else {
      if (magic !== 0xfd2fb528) throw new Error('Invalid Zstandard frame');
      const descriptor = bytes[take(1)], singleSegment = Boolean(descriptor & 0x20), sizeFlag = descriptor >>> 6;
      if (descriptor & 0x08) throw new Error('Reserved Zstandard frame bit');
      take((singleSegment ? 0 : 1) + [0, 1, 2, 4][descriptor & 3] + (sizeFlag ? 1 << sizeFlag : singleSegment ? 1 : 0));
      let last = false;
      do {
        const header = take(3), block = bytes[header] | bytes[header + 1] << 8 | bytes[header + 2] << 16;
        const type = (block >>> 1) & 3;
        if (type === 3) throw new Error('Reserved Zstandard block type');
        last = Boolean(block & 1);
        take(type === 1 ? 1 : block >>> 3);
      } while (!last);
      if (descriptor & 0x04) take(4);
    }
    yield bytes.subarray(start, offset);
  }
}
