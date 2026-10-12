/**
 * photos:init on a fixture album generated with sharp in a temp folder.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initNode } from '../../src/lib/authoring/init-node.ts';
import { loadAlbums } from '../../src/lib/content/index.ts';
import { makeJpeg } from '../helpers/images.ts';

let tmp: string;
let albums: string;

async function put(path: string, content: string | Buffer) {
  const target = join(albums, path);
  await mkdir(join(target, '..'), { recursive: true });
  await writeFile(target, content);
}

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'pinus-album-init-'));
  albums = join(tmp, 'albums');
  await put('event/index.md', '---\ntitle: "Event"\ndate: 2026-09-20\n---\n');
  await put('event/@andi/IMG_1.jpg', await makeJpeg({ width: 40, height: 30, date: '2026:09:20 12:00:00' }));
  await put('event/@sari/IMG_1.jpg', await makeJpeg({ width: 40, height: 30, date: '2026:09:20 09:00:00' }));
  await put('event/IMG_1.jpg', await makeJpeg({ width: 40, height: 30, date: '2026:09:20 15:00:00' }));
  await put('event/PXL_2.jpg', await makeJpeg({ width: 40, height: 30, date: '2026:09:20 10:00:00' }));
  await put('event/@andi/hidden.jpg', await makeJpeg({ width: 40, height: 30, date: '2026:09:20 11:00:00' }));
  await put('event/photos.yaml', '# Kept as is\n"@andi/hidden.jpg":\n  hidden: true\n');
  await put('event/day-1/@andi/IMG_5.jpg', await makeJpeg({ width: 40, height: 30 }));
  await put('event/empty/index.md', '---\ntitle: "Empty"\n---\n');
  await put('other/Photos.yaml', '"@andi/x.jpg":\n  hidden: true\n');
  await put('other/@andi/x.jpg', await makeJpeg({ width: 40, height: 30 }));
});

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe('initNode', () => {
  it('appends missing entries in display order, keeping the existing file', async () => {
    const result = await initNode(albums, join(albums, 'event'));
    expect(result).toMatchObject({
      ok: true,
      created: false,
      // By date: Sari 09:00, PXL 10:00, (hidden 11:00 already listed), Andi 12:00, loose IMG_1 15:00.
      added: ['@sari/IMG_1.jpg', 'PXL_2.jpg', '@andi/IMG_1.jpg', './IMG_1.jpg'],
      photoCount: 5,
    });
    const text = await readFile(join(albums, 'event', 'photos.yaml'), 'utf8');
    expect(text.startsWith('# Kept as is\n"@andi/hidden.jpg":\n  hidden: true\n\n"@sari/IMG_1.jpg":\n  caption: ""\n')).toBe(true);
  });

  it('leaves the albums valid: no new errors or warnings, the hidden photo stays hidden', async () => {
    const loaded = await loadAlbums({ root: albums, includeDrafts: true });
    expect(loaded.errors.filter((issue) => !issue.file.includes('/other/'))).toEqual([]);
    expect(loaded.nodes.get('event')?.photos.map((photo) => photo.relPath)).toEqual(['@sari/IMG_1.jpg', 'PXL_2.jpg', '@andi/IMG_1.jpg', 'IMG_1.jpg']);
    expect(loaded.nodes.get('event')?.photos.every((photo) => photo.caption === undefined)).toBe(true);
  });

  it('is idempotent: a second run adds nothing and does not touch the file', async () => {
    const file = join(albums, 'event', 'photos.yaml');
    const before = await readFile(file, 'utf8');
    expect(await initNode(albums, join(albums, 'event'))).toMatchObject({ ok: true, added: [] });
    expect(await readFile(file, 'utf8')).toBe(before);
  });

  it('creates photos.yaml when the node has none; a dry run writes nothing', async () => {
    const dry = await initNode(albums, join(albums, 'event', 'day-1'), { dryRun: true });
    expect(dry).toMatchObject({ ok: true, added: ['@andi/IMG_5.jpg'], created: true });
    await expect(readFile(join(albums, 'event', 'day-1', 'photos.yaml'), 'utf8')).rejects.toThrow();
    expect(await initNode(albums, join(albums, 'event', 'day-1'))).toMatchObject({ ok: true, created: true });
    expect(await readFile(join(albums, 'event', 'day-1', 'photos.yaml'), 'utf8')).toContain('"@andi/IMG_5.jpg":\n  caption: ""');
  });

  it('does nothing for a node without photos', async () => {
    expect(await initNode(albums, join(albums, 'event', 'empty'))).toMatchObject({ ok: true, added: [], created: false, photoCount: 0 });
    await expect(readFile(join(albums, 'event', 'empty', 'photos.yaml'), 'utf8')).rejects.toThrow();
  });

  it('explains what is wrong with other folders', async () => {
    const problem = async (folder: string) => {
      const result = await initNode(albums, folder);
      return result.ok ? '' : result.problem;
    };
    expect(await problem(albums)).toMatch(/main albums folder/);
    expect(await problem(join(albums, 'event', '@andi'))).toMatch(/"@andi" is a photographer folder.*…\/event/);
    expect(await problem(join(albums, 'nope'))).toMatch(/No album folder named "nope"/);
    expect(await problem(tmp)).toMatch(/inside the albums folder/);
    expect(await problem(join(albums, 'other'))).toMatch(/"Photos\.yaml", which the site does not read/);
  });
});
