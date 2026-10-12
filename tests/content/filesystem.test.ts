/**
 * scan.ts, exif.ts and loadAlbums() against a small fixture tree that is generated with
 * sharp in a temp folder at test time (no binaries committed).
 */
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exifTiffBlock, readImageInfo, uprightSize } from '../../src/lib/content/exif.ts';
import { AlbumContentError, loadAlbums, loadAlbumsOrThrow } from '../../src/lib/content/index.ts';
import { classifyFile, scanAlbums } from '../../src/lib/content/scan.ts';
import type { SourceTree } from '../../src/lib/content/types.ts';
import { makeJpeg } from '../helpers/images.ts';

let tmp: string;
let albums: string;

async function jpeg(width: number, height: number, options: { date?: string; offset?: string; orientation?: number } = {}) {
  let image = sharp({ create: { width, height, channels: 3, background: '#336699' } });
  if (options.date) {
    const exif: Record<string, string> = { DateTimeOriginal: options.date };
    if (options.offset) exif.OffsetTimeOriginal = options.offset;
    image = image.withExif({ IFD0: { Software: 'test' }, IFD2: exif });
  }
  if (options.orientation) image = image.withMetadata({ orientation: options.orientation });
  return image.jpeg().toBuffer();
}

async function put(path: string, content: string | Buffer) {
  const target = join(albums, path);
  await mkdir(join(target, '..'), { recursive: true });
  await writeFile(target, content);
}

/** Sum of file sizes, skipping dot-files and dot-folders (as the scanner does). */
async function visibleBytes(dir: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    total += entry.isDirectory() ? await visibleBytes(path) : (await stat(path)).size;
  }
  return total;
}

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'pinus-album-test-'));
  albums = join(tmp, 'albums');
  await put('photographers.yaml', 'alice:\n  name: "Alice A"\n');
  await put('stray.jpg', await jpeg(10, 10));
  await put('@root-photographer/a.jpg', await jpeg(10, 10));
  await put('index.md', '---\ntitle: "Not read here"\n---\n');
  await put('photos.yaml', '"event-1/@alice/IMG_1.jpg":\n  hidden: true\n');
  await put('clip.mp4', 'not really a video');
  await put('event-1/index.md', '---\ntitle: "Event One"\ndate: 2026-09-20\nendDate: 2026-09-21\n---\nStory.\n');
  await put('event-1/photos.yaml', '"@alice/IMG_1.jpg":\n  caption: "First"\n');
  await put('event-1/@alice/IMG_1.jpg', await jpeg(300, 200, { date: '2026:09:20 10:00:00', offset: '+08:00' }));
  await put('event-1/@alice/nested/IMG_x.jpg', await jpeg(10, 10));
  await put('event-1/@alice/clip.MOV', 'not really a video');
  // Next to the photos is the most natural place to try to hide one; it is not read there.
  await put('event-1/@alice/photos.yaml', 'IMG_1.jpg:\n  hidden: true\n');
  await put('event-1/@alice/index.md', '---\ndraft: true\n---\n');
  await put('event-1/photographers.yaml', 'bob:\n  name: "Bob"\n');
  await put('event-1/photos.yaml.txt', '"@alice/IMG_1.jpg":\n  hidden: true\n');
  await put('event-1/@/IMG_y.jpg', await jpeg(10, 10));
  await put('event-1/IMG_2.PNG', await sharp({ create: { width: 100, height: 100, channels: 3, background: '#ff0000' } }).png().toBuffer());
  await put('event-1/rotated.jpg', await jpeg(300, 200, { date: '2026:09:21 09:00:00', orientation: 6 }));
  await put('event-1/broken.jpg', 'this is not an image');
  await put('event-1/photo.heic', 'fake heic');
  await put('event-1/anim.gif', 'fake gif');
  await put('event-1/photos.yml', 'ignored: true\n');
  await put('event-1/notes.txt', 'notes');
  await put('event-1/.DS_Store', 'x');
  await put('event-1/.hidden/IMG_h.jpg', await jpeg(10, 10));
  await put('event-1/01-day-1/IMG_3.webp', await sharp({ create: { width: 120, height: 80, channels: 3, background: '#00ff00' } }).webp().toBuffer());
});

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe('classifyFile', () => {
  it.each([
    ['index.md', 'index'],
    ['photos.yaml', 'photos'],
    ['IMG_1.jpg', 'image'],
    ['IMG_1.JPEG', 'image'],
    ['a.PNG', 'image'],
    ['a.webp', 'image'],
    ['a.HEIC', 'heic'],
    ['a.heif', 'heic'],
    ['a.gif', 'unsupported-image'],
    ['a.CR2', 'unsupported-image'],
    ['a.mov', 'video'],
    ['photos.yml', 'misnamed-metadata'],
    ['Index.md', 'misnamed-metadata'],
    ['PHOTOS.YAML', 'misnamed-metadata'],
    ['photo.yaml', 'misnamed-metadata'],
    ['photos.yaml.txt', 'misnamed-metadata'],
    ['index.md.txt', 'misnamed-metadata'],
    ['Photographers.yml', 'misnamed-metadata'],
    ['photographers.yaml', 'photographers'],
    ['notes.txt', 'ignore'],
    ['README', 'ignore'],
  ])('%s → %s', (name, kind) => {
    expect(classifyFile(name)).toBe(kind);
  });
});

describe('scanAlbums', () => {
  let tree: SourceTree;
  beforeAll(async () => {
    tree = await scanAlbums(albums, 'src/albums');
  });

  it('reads photographers.yaml and reports what does not belong at the top level', () => {
    expect(tree.photographersYaml).toEqual({ file: 'src/albums/photographers.yaml', text: 'alice:\n  name: "Alice A"\n' });
    expect(tree.root.strays).toEqual([
      { kind: 'outside-event', file: 'src/albums/@root-photographer' },
      { kind: 'video', file: 'src/albums/clip.mp4' },
      { kind: 'metadata-in-albums-folder', file: 'src/albums/index.md' },
      { kind: 'metadata-in-albums-folder', file: 'src/albums/photos.yaml' },
      { kind: 'outside-event', file: 'src/albums/stray.jpg' },
    ]);
    expect(tree.root.children.map((child) => child.folderName)).toEqual(['event-1']);
  });

  it('finds images directly in the node and in @photographer folders, with repo-relative paths', () => {
    const event = tree.root.children[0]!;
    expect(event.images.map((image) => [image.relPath, image.file, image.photographerFolder])).toEqual([
      ['@alice/IMG_1.jpg', 'src/albums/event-1/@alice/IMG_1.jpg', 'alice'],
      ['IMG_2.PNG', 'src/albums/event-1/IMG_2.PNG', undefined],
      ['broken.jpg', 'src/albums/event-1/broken.jpg', undefined],
      ['rotated.jpg', 'src/albums/event-1/rotated.jpg', undefined],
    ]);
    expect(event.images[0]?.absPath).toBe(join(albums, 'event-1', '@alice', 'IMG_1.jpg'));
    expect(event.images[0]?.size).toBeGreaterThan(0);
  });

  it('reads index.md and photos.yaml, and treats other folders as child nodes', () => {
    const event = tree.root.children[0]!;
    expect(event.indexMd?.file).toBe('src/albums/event-1/index.md');
    expect(event.photosYaml?.text).toContain('First');
    expect(event.children.map((child) => [child.folderName, child.dir])).toEqual([['01-day-1', 'src/albums/event-1/01-day-1']]);
    expect(event.children[0]?.images.map((image) => image.relPath)).toEqual(['IMG_3.webp']);
  });

  it('records strays and ignores dot-files and unrelated files', () => {
    expect(tree.root.children[0]?.strays).toEqual([
      { kind: 'invalid-photographer-folder', file: 'src/albums/event-1/@' },
      { kind: 'video', file: 'src/albums/event-1/@alice/clip.MOV' },
      { kind: 'metadata-in-photographer-folder', file: 'src/albums/event-1/@alice/index.md' },
      { kind: 'nested-in-photographer-folder', file: 'src/albums/event-1/@alice/nested' },
      { kind: 'metadata-in-photographer-folder', file: 'src/albums/event-1/@alice/photos.yaml' },
      { kind: 'unsupported-image', file: 'src/albums/event-1/anim.gif' },
      { kind: 'heic', file: 'src/albums/event-1/photo.heic' },
      { kind: 'photographers-yaml-in-node', file: 'src/albums/event-1/photographers.yaml' },
      { kind: 'misnamed-metadata', file: 'src/albums/event-1/photos.yaml.txt' },
      { kind: 'misnamed-metadata', file: 'src/albums/event-1/photos.yml' },
    ]);
  });

  it('adds up the size of all files', async () => {
    expect(tree.totalBytes).toBe(await visibleBytes(albums));
  });

  it('fails clearly when the folder does not exist', async () => {
    await expect(scanAlbums(join(tmp, 'missing'), 'missing')).rejects.toThrow('Album folder not found');
  });
});

describe('exif', () => {
  it('reads size, orientation and EXIF dates', async () => {
    expect(await readImageInfo(join(albums, 'event-1', '@alice', 'IMG_1.jpg'))).toEqual({
      format: 'jpeg',
      width: 300,
      height: 200,
      orientation: 1,
      exifDateTimeOriginal: '2026:09:20 10:00:00',
      exifOffsetTimeOriginal: '+08:00',
    });
  });

  it('reports the upright size for rotated images (EXIF orientation 6)', async () => {
    expect(await readImageInfo(join(albums, 'event-1', 'rotated.jpg'))).toMatchObject({ width: 200, height: 300, orientation: 6 });
  });

  it('reads images without EXIF', async () => {
    expect(await readImageInfo(join(albums, 'event-1', 'IMG_2.PNG'))).toEqual({ format: 'png', width: 100, height: 100, orientation: 1 });
    expect(await readImageInfo(join(albums, 'event-1', '01-day-1', 'IMG_3.webp'))).toEqual({ format: 'webp', width: 120, height: 80, orientation: 1 });
  });

  it('notices a GPS position in the EXIF data (for the photos:check privacy warning)', async () => {
    const file = join(tmp, 'gps.jpg');
    await writeFile(file, await makeJpeg({ width: 40, height: 30, date: '2026:09:20 10:00:00', gps: true }));
    expect(await readImageInfo(file)).toMatchObject({ hasGps: true, exifDateTimeOriginal: '2026:09:20 10:00:00' });
    expect((await readImageInfo(join(albums, 'event-1', '@alice', 'IMG_1.jpg'))).hasGps).toBeUndefined();
  });

  it('throws for files that are not images', async () => {
    await expect(readImageInfo(join(albums, 'event-1', 'broken.jpg'))).rejects.toThrow();
  });

  it('swaps width and height for orientations 5–8 only', () => {
    for (const orientation of [1, 2, 3, 4]) expect(uprightSize(300, 200, orientation)).toEqual({ width: 300, height: 200 });
    for (const orientation of [5, 6, 7, 8]) expect(uprightSize(300, 200, orientation)).toEqual({ width: 200, height: 300 });
  });

  it('strips the Exif header that sharp returns for JPEG and WebP', () => {
    const tiff = Buffer.from('II*\0rest', 'latin1');
    expect(exifTiffBlock(Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]))).toEqual(tiff);
    expect(exifTiffBlock(tiff)).toEqual(tiff);
  });
});

describe('loadAlbums', () => {
  it('runs the whole pipeline and reports issues with repo-relative paths', async () => {
    const result = await loadAlbums({ root: albums });
    const event = result.nodes.get('event-1');
    expect(event?.title).toBe('Event One');
    // IMG_2.PNG has no EXIF date, so it falls back to the event date (midnight) and sorts first.
    expect(event?.photos.map((photo) => photo.relPath)).toEqual(['IMG_2.PNG', '@alice/IMG_1.jpg', 'rotated.jpg']);
    expect(event?.photos.find((photo) => photo.relPath === '@alice/IMG_1.jpg')).toMatchObject({ caption: 'First', alt: 'First', photographer: { name: 'Alice A' }, sources: { date: 'exif' } });
    expect(result.nodes.get('event-1/day-1')?.photos.map((photo) => photo.format)).toEqual(['webp']);
    expect(result.photographers.get('alice')?.name).toBe('Alice A');

    const byCode = (code: string) => result.issues.filter((issue) => issue.code === code).map((issue) => issue.file.replace(/^.*albums\//, ''));
    expect(byCode('unsupported-format')).toEqual(['event-1/anim.gif', 'event-1/photo.heic']);
    expect(byCode('unreadable-image')).toEqual(['event-1/broken.jpg']);
    expect(byCode('misplaced-file')).toEqual([
      '@root-photographer',
      'event-1/@',
      'event-1/@alice/index.md',
      'event-1/@alice/nested',
      'event-1/@alice/photos.yaml',
      'event-1/photographers.yaml',
      'index.md',
      'photos.yaml',
      'stray.jpg',
    ]);
    expect(byCode('misnamed-file')).toEqual(['event-1/photos.yaml.txt', 'event-1/photos.yml']);
    expect(byCode('ignored-file')).toEqual(['clip.mp4', 'event-1/@alice/clip.MOV']);
    expect(result.errors.every((issue) => issue.level === 'error')).toBe(true);
    expect(result.stats).toMatchObject({ nodes: 2, photos: 4, hiddenPhotos: 0, draftNodes: 0 });
  });

  it('is memoised per options, and rebuilds when a file changes', async () => {
    const first = await loadAlbums({ root: albums });
    expect(await loadAlbums({ root: albums })).toBe(first);
    expect(await loadAlbums({ root: albums, includeDrafts: true })).not.toBe(first);

    await put('event-1/photos.yaml', '"@alice/IMG_1.jpg":\n  caption: "Changed"\n');
    const second = await loadAlbums({ root: albums });
    expect(second).not.toBe(first);
    expect(second.nodes.get('event-1')?.photos.find((photo) => photo.relPath === '@alice/IMG_1.jpg')?.caption).toBe('Changed');
  });

  it('throws one readable error listing every error for the build', async () => {
    const error = await loadAlbumsOrThrow({ root: albums }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AlbumContentError);
    const { message, issues } = error as AlbumContentError;
    expect(message).toMatch(/^The photo albums have \d+ errors, so the site cannot be built:/);
    for (const issue of issues) expect(message).toContain(issue.file);
    expect(message).toContain('npm run photos:check');
  });

  it('rejects an invalid TIMEZONE', async () => {
    await expect(loadAlbums({ root: albums, timeZone: 'Nowhere/Land' })).rejects.toThrow('not a valid time zone');
  });
});
