import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { crc32, zipParts } from '../../src/scripts/selection/zip.ts';

/** Node's own CRC-32, as an independent check (the installed Node types predate it). */
const nodeCrc32 = (zlib as unknown as { crc32(data: Uint8Array): number }).crc32;

const bytes = (text: string) => new Uint8Array(new TextEncoder().encode(text));
const joined = (parts: readonly Uint8Array[]) => new Uint8Array(Buffer.concat(parts));

interface Entry {
  name: string;
  crc: number;
  size: number;
  method: number;
  flags: number;
  data: Uint8Array;
  time: number;
  date: number;
}

/** A reader written from the ZIP format's documentation, independent of the writer's helpers. */
function readZip(zip: Uint8Array): Entry[] {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const end = zip.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const entries: Entry[] = [];
  for (let index = 0; index < count; index++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const nameLength = view.getUint16(at + 28, true);
    const name = new TextDecoder().decode(zip.subarray(at + 46, at + 46 + nameLength));
    const size = view.getUint32(at + 24, true);
    const offset = view.getUint32(at + 42, true);
    expect(view.getUint32(offset, true)).toBe(0x04034b50);
    const start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
    entries.push({
      name,
      crc: view.getUint32(at + 16, true),
      size,
      method: view.getUint16(at + 10, true),
      flags: view.getUint16(at + 8, true),
      data: zip.subarray(start, start + size),
      time: view.getUint16(at + 12, true),
      date: view.getUint16(at + 14, true),
    });
    at += 46 + nameLength;
  }
  return entries;
}

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(bytes('123456789'))).toBe(0xcbf43926);
  });

  it('agrees with Node on data of every byte value', () => {
    const data = Uint8Array.from({ length: 4096 }, (_, index) => (index * 31) % 256);
    expect(crc32(data)).toBe(nodeCrc32(data));
  });
});

describe('zipParts', () => {
  const files = [
    { name: 'halloween-a.jpg', bytes: bytes('first photo') },
    { name: 'halloween-b.jpg', bytes: bytes('the second, longer photo') },
  ];
  const modified = new Date(2026, 10, 8, 14, 30, 10);

  it('holds every file, in order, stored as it was', () => {
    const entries = readZip(joined(zipParts(files, modified)));
    expect(entries.map((entry) => entry.name)).toEqual(['halloween-a.jpg', 'halloween-b.jpg']);
    entries.forEach((entry, index) => {
      expect(entry.method).toBe(0);
      expect(entry.flags & 0x0800).toBe(0x0800);
      expect(Buffer.from(entry.data).toString()).toBe(Buffer.from(files[index]!.bytes).toString());
      expect(entry.crc).toBe(nodeCrc32(files[index]!.bytes));
    });
  });

  it('writes the date the extracted files will show', () => {
    const [entry] = readZip(joined(zipParts(files, modified)));
    expect(entry!.date).toBe(((2026 - 1980) << 9) | (11 << 5) | 8);
    expect(entry!.time).toBe((14 << 11) | (30 << 5) | 5);
  });

  it('is a valid empty ZIP with no files', () => {
    expect(readZip(joined(zipParts([], modified)))).toEqual([]);
  });

  it('hands back the photo bytes without copying them', () => {
    expect(zipParts(files, modified)).toContain(files[0]!.bytes);
  });
});
