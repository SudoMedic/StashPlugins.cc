// Minimal zip reader: lists entries and extracts stored/deflated files.
import { inflateRawSync } from 'node:zlib';

export function readZipEntries(buf) {
  // End of central directory record is in the last 64KiB + 22 bytes.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('bad central directory');
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const local = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    entries.push({ name, method, compSize, local });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

export function extractZipEntry(buf, e) {
  const nameLen = buf.readUInt16LE(e.local + 26);
  const extraLen = buf.readUInt16LE(e.local + 28);
  const start = e.local + 30 + nameLen + extraLen;
  const data = buf.subarray(start, start + e.compSize);
  if (e.method === 0) return data;
  if (e.method === 8) return inflateRawSync(data);
  throw new Error(`unsupported zip method ${e.method}`);
}
