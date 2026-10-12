import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findSourceCopies, listFiles, relativePosix } from '../../src/lib/build-checks/files.ts';

let tmp: string;
let dist: string;
let albums: string;

async function put(path: string, content: string) {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, content);
}

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'pinus-dist-'));
  dist = join(tmp, 'dist');
  albums = join(tmp, 'albums');
  await put(join(albums, 'event', '@andi', 'IMG_1.jpg'), 'original photo bytes');
  await put(join(albums, 'event', 'IMG_2.JPG'), 'another original');
  await put(join(albums, 'event', 'index.md'), 'same size text!!!!!!');
  await put(join(dist, '_astro', 'IMG_1.abc.jpg'), 'original photo bytes'); // a leaked copy
  await put(join(dist, '_astro', 'IMG_1.def.webp'), 'derivative bytes....'); // same size, other bytes
  await put(join(dist, 'index.html'), 'same size text!!!!!!'); // identical to a non-image source
});

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe('findSourceCopies', () => {
  it('finds byte-identical copies of source images only', async () => {
    const copies = await findSourceCopies(dist, albums);
    expect(copies.map((copy) => [relativePosix(dist, copy.distFile), relativePosix(albums, copy.sourceFile)])).toEqual([
      ['_astro/IMG_1.abc.jpg', 'event/@andi/IMG_1.jpg'],
    ]);
  });
});

describe('listFiles', () => {
  it('lists files recursively', async () => {
    expect((await listFiles(dist)).map((file) => relativePosix(dist, file))).toEqual([
      '_astro/IMG_1.abc.jpg',
      '_astro/IMG_1.def.webp',
      'index.html',
    ]);
  });
});
