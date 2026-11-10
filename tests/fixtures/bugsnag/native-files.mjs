import { readFile } from 'node:fs/promises';
import { crc32 } from 'node:zlib';

// Real compiled fixtures; see ./native/README.md for the commands that built them.
const read = name => readFile(new URL(`./native/${name}`, import.meta.url));
export const syntheticUuid = 'f48b101c-e3b3-3794-9ffd-5ab329eee07d';
export const syntheticBuildId = 'a4e3cd84f2d5bd09de7a9ec4cafab71372bacbd8';
export const dsymZip = () => read('SyntheticApp.dSYM.zip');
export const ndkLibrary = () => read('libsynthetic.so');
export const ndkWithoutBuildId = () => read('libnobuildid.so');

/** A stored (uncompressed) ZIP of the given entries, for malformed-archive cases. */
export function storedZip(entries) {
 const parts = [], directory = []; let offset = 0;
 for (const [name, bytes] of Object.entries(entries)) {
  const path = Buffer.from(name), crc = crc32(bytes), local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc, 14); local.writeUInt32LE(bytes.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(path.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt32LE(crc, 16); central.writeUInt32LE(bytes.length, 20); central.writeUInt32LE(bytes.length, 24); central.writeUInt16LE(path.length, 28); central.writeUInt32LE(offset, 42);
  parts.push(local, path, bytes); directory.push(central, path); offset += 30 + path.length + bytes.length;
 }
 const body = Buffer.concat(directory), end = Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(directory.length / 2, 8); end.writeUInt16LE(directory.length / 2, 10); end.writeUInt32LE(body.length, 12); end.writeUInt32LE(offset, 16);
 return Buffer.concat([...parts, body, end]);
}
