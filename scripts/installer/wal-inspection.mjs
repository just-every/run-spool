import { open } from 'node:fs/promises';
import { constants } from 'node:fs';

const invalid = () => new Error('Local WAL requires explicit recovery.');

async function readExactly(handle, buffer, position) {
 let offset = 0;
 while (offset < buffer.length) {
  const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, position + offset);
  if (!bytesRead) throw invalid();
  offset += bytesRead;
 }
}

function checksum(bytes, start, end, state, littleEndian) {
 let [first, second] = state;
 for (let offset = start; offset < end; offset += 8) {
  first = (first + (littleEndian ? bytes.readUInt32LE(offset) : bytes.readUInt32BE(offset)) + second) >>> 0;
  second = (second + (littleEndian ? bytes.readUInt32LE(offset + 4) : bytes.readUInt32BE(offset + 4)) + first) >>> 0;
 }
 return [first, second];
}

// SQLite recovery stops at an invalid frame, potentially hiding a committed
// owner. Validate the current generation before SQLite reads the private copy.
// https://www.sqlite.org/fileformat2.html#walformat
// https://www.sqlite.org/fileformat2.html#checksum_algorithm
export async function validateWalSnapshot(databasePath) {
 const wal = await open(databasePath + '-wal', constants.O_RDONLY | constants.O_NOFOLLOW);
 try {
  const { size } = await wal.stat();
  // SQLite creates an empty WAL before a first write and after TRUNCATE.
  if (size === 0) return;
  if (size < 32 || !Number.isSafeInteger(size)) throw invalid();
  const header = Buffer.alloc(32);
  await readExactly(wal, header, 0);
  const magic = header.readUInt32BE(0), pageSize = header.readUInt32BE(8);
  if ((magic !== 0x377f0682 && magic !== 0x377f0683) || header.readUInt32BE(4) !== 3007000 ||
   pageSize < 512 || pageSize > 65536 || (pageSize & (pageSize - 1)) !== 0 ||
   (size - 32) % (24 + pageSize) !== 0) throw invalid();
  const database = await open(databasePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  const databaseHeader = Buffer.alloc(20);
  try { await readExactly(database, databaseHeader, 0); } finally { await database.close(); }
  const encodedPageSize = databaseHeader.readUInt16BE(16);
  if (!databaseHeader.subarray(0, 16).equals(Buffer.from('SQLite format 3\0')) ||
   databaseHeader[18] !== 2 || databaseHeader[19] !== 2 ||
   pageSize !== (encodedPageSize === 1 ? 65536 : encodedPageSize)) throw invalid();
  const littleEndian = magic === 0x377f0682;
  let state = checksum(header, 0, 24, [0, 0], littleEndian);
  if (state[0] !== header.readUInt32BE(24) || state[1] !== header.readUInt32BE(28)) throw invalid();
  const frame = Buffer.alloc(24 + pageSize);
  const resets = header.readUInt32BE(12), currentSalt = header.readUInt32BE(16);
  let age = 0, salt2 = header.readUInt32BE(20), committed = false;
  for (let position = 32; position < size; position += frame.length) {
   await readExactly(wal, frame, position);
   const page = frame.readUInt32BE(0);
   if (page === 0 || page === 0xffffffff || frame.readUInt32BE(4) === 0xffffffff) throw invalid();
   const nextAge = (currentSalt - frame.readUInt32BE(8)) >>> 0;
   const nextSalt2 = frame.readUInt32BE(12);
   const expected = checksum(frame, 24, frame.length, checksum(frame, 0, 8, state, littleEndian), littleEndian);
   const stored = [frame.readUInt32BE(16), frame.readUInt32BE(20)];
   const matches = expected[0] === stored[0] && expected[1] === stored[1];
   if (nextAge === age && nextSalt2 === salt2) {
    if (!matches) throw invalid();
   } else {
    // A complete checkpoint permits reuse without truncation: salt-1 advances
    // once per reset, salt-2 is randomized, and older suffixes remain on disk.
    // Require a committed boundary and strictly older generations within the
    // header's reset count. Never resume current frames after an old suffix.
    // Salts are outside the frame checksum: a matching checksum with changed
    // salts is damaged continuing data, not evidence of a reset boundary.
    if (!committed || nextAge <= age || nextAge > resets || nextSalt2 === salt2 || matches) throw invalid();
    age = nextAge; salt2 = nextSalt2;
    // Its overwritten predecessor is unavailable. The first old checksum can
    // only seed validation of the remaining suffix; SQLite cannot replay any
    // of this generation. Every current-generation frame was checked above.
   }
   state = stored;
   committed = frame.readUInt32BE(4) !== 0;
  }
  // Fully valid frames without a commit marker are left for SQLite to ignore
  // transactionally. No database or WAL bytes are changed by this inspection.
 } finally { await wal.close(); }
}
