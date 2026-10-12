import { describe, expect, it } from 'vitest';
import { toAlbumDate, type AlbumDate } from '../../src/lib/dates.ts';
import {
  coverFile,
  generatedAlt,
  lookupPhotographer,
  matchPhotoKeys,
  resolveAlt,
  resolveCaption,
  resolveDate,
  resolveHidden,
  resolvePhotoMetadata,
  resolvePhotographerSlug,
  type PhotoContext,
} from '../../src/lib/content/resolve.ts';
import type { PhotoOverride, PhotographerEntry } from '../../src/lib/content/types.ts';

const TZ = 'Asia/Singapore';
const calendar = (year: number, month: number, day: number): AlbumDate =>
  toAlbumDate({ year, month, day, hour: 0, minute: 0, second: 0, hasTime: false }, TZ);

const registry: ReadonlyMap<string, PhotographerEntry> = new Map([
  ['andi-pratama', { name: 'Andi Pratama', instagram: 'andi.pratama' }],
  ['sari-wijaya', { name: 'Sari Wijaya' }],
]);

describe('lookupPhotographer (TRD §4.5)', () => {
  it('uses photographers.yaml when the slug is listed', () => {
    expect(lookupPhotographer('andi-pratama', registry)).toEqual({
      slug: 'andi-pratama',
      name: 'Andi Pratama',
      initials: 'AP',
      instagram: 'andi.pratama',
      instagramUrl: 'https://www.instagram.com/andi.pratama/',
      listed: true,
    });
  });

  it('has no Instagram link when no handle is listed', () => {
    const sari = lookupPhotographer('sari-wijaya', registry);
    expect(sari.instagram).toBeUndefined();
    expect(sari.instagramUrl).toBeUndefined();
  });

  it('falls back to the slug title-cased', () => {
    expect(lookupPhotographer('budi-santoso', registry)).toEqual({
      slug: 'budi-santoso',
      name: 'Budi Santoso',
      initials: 'BS',
      listed: false,
    });
  });
});

describe('matchPhotoKeys (TRD §4.4)', () => {
  const photos = ['@andi/IMG_0001.jpg', '@sari/IMG_0001.jpg', '@sari/DSC_0441.jpg', 'IMG_0001.jpg', 'WA0001.jpg'];
  const entries = (...keys: string[]) => new Map<string, PhotoOverride>(keys.map((key) => [key, { caption: key }]));

  it('matches full paths exactly', () => {
    const result = matchPhotoKeys(entries('@andi/IMG_0001.jpg'), photos);
    expect(result.matched.get('@andi/IMG_0001.jpg')).toEqual({ key: '@andi/IMG_0001.jpg', override: { caption: '@andi/IMG_0001.jpg' } });
    expect(result.unmatched).toEqual([]);
  });

  it('matches an unambiguous bare file name', () => {
    expect(matchPhotoKeys(entries('DSC_0441.jpg'), photos).matched.has('@sari/DSC_0441.jpg')).toBe(true);
    expect(matchPhotoKeys(entries('WA0001.jpg'), photos).matched.has('WA0001.jpg')).toBe(true);
  });

  it('reports an ambiguous bare file name with every candidate', () => {
    const result = matchPhotoKeys(entries('IMG_0001.jpg'), photos);
    expect(result.matched.size).toBe(0);
    expect(result.ambiguous).toEqual([{ key: 'IMG_0001.jpg', candidates: ['@andi/IMG_0001.jpg', '@sari/IMG_0001.jpg', 'IMG_0001.jpg'] }]);
  });

  it('accepts "./name" as the explicit path of a photo directly in the node', () => {
    expect(matchPhotoKeys(entries('./IMG_0001.jpg'), photos).matched.has('IMG_0001.jpg')).toBe(true);
  });

  it('tolerates backslashes and surrounding spaces', () => {
    expect(matchPhotoKeys(entries(' @andi\\IMG_0001.jpg '), photos).matched.has('@andi/IMG_0001.jpg')).toBe(true);
  });

  it('reports keys that match no file', () => {
    expect(matchPhotoKeys(entries('@andi/IMG_9999.jpg', 'nothing.jpg'), photos).unmatched).toEqual([
      { key: '@andi/IMG_9999.jpg' },
      { key: 'nothing.jpg' },
    ]);
  });

  it('suggests a case-insensitive match (the build runs on case-sensitive Linux)', () => {
    expect(matchPhotoKeys(entries('@Andi/img_0001.JPG'), photos).unmatched).toEqual([
      { key: '@Andi/img_0001.JPG', suggestion: '@andi/IMG_0001.jpg', reason: 'case' },
    ]);
    expect(matchPhotoKeys(entries('dsc_0441.jpg'), photos).unmatched).toEqual([
      { key: 'dsc_0441.jpg', suggestion: 'DSC_0441.jpg', reason: 'case' },
    ]);
  });

  it('explains keys that point into a sub-folder (they belong in its own photos.yaml)', () => {
    expect(matchPhotoKeys(entries('day-1/@andi/IMG_1.jpg'), photos, { childFolders: ['day-1'] }).unmatched).toEqual([
      { key: 'day-1/@andi/IMG_1.jpg', suggestion: 'day-1', reason: 'child-folder' },
    ]);
  });

  it('does not report keys for files that are reported elsewhere (e.g. HEIC)', () => {
    expect(matchPhotoKeys(entries('IMG_5.heic'), photos, { otherFiles: ['@andi/IMG_5.heic'] }).unmatched).toEqual([]);
  });

  it('reports a photo described by two keys', () => {
    const result = matchPhotoKeys(entries('DSC_0441.jpg', '@sari/DSC_0441.jpg'), photos);
    expect(result.duplicates).toEqual([{ relPath: '@sari/DSC_0441.jpg', keys: ['DSC_0441.jpg', '@sari/DSC_0441.jpg'] }]);
    expect(result.matched.get('@sari/DSC_0441.jpg')?.key).toBe('DSC_0441.jpg');
  });
});

/**
 * The full TRD §4.6 table: for every field, every source, from the highest priority down.
 * Each case starts with all sources present and removes them one by one.
 */
describe('coverFile', () => {
  it('resolves cover paths relative to the node folder', () => {
    expect(coverFile('src/albums/e', './day-1\\@a/IMG_1.jpg')).toBe('src/albums/e/day-1/@a/IMG_1.jpg');
    expect(coverFile('src/albums/e', '../other/IMG_1.jpg')).toBeUndefined();
    expect(coverFile('src/albums/e', '  ')).toBeUndefined();
  });
});

describe('metadata precedence (TRD §4.6)', () => {
  const full = (): PhotoContext => ({
    override: {
      caption: 'Caption from photos.yaml',
      photographer: 'sari-wijaya',
      date: { year: 2026, month: 9, day: 22, hour: 0, minute: 0, second: 0, hasTime: false },
      alt: 'Alt from photos.yaml',
      hidden: true,
    },
    embedded: { description: 'Embedded description', artist: 'embedded-artist' },
    exif: { dateTimeOriginal: '2026:09:21 10:15:00' },
    folderPhotographer: 'andi-pratama',
    ancestors: [
      { photographer: 'node-photographer', date: calendar(2026, 9, 20) },
      { photographer: 'parent-photographer', date: calendar(2026, 9, 1) },
    ],
    nodeTitle: 'Day 1',
    registry,
    timeZone: TZ,
  });
  const without = (ctx: PhotoContext, ...fields: (keyof PhotoOverride)[]): PhotoContext => {
    const override = { ...ctx.override };
    for (const field of fields) delete override[field];
    return { ...ctx, override };
  };

  describe('caption: photos.yaml → P1 embedded → none', () => {
    it('1. photos.yaml caption', () => {
      expect(resolveCaption(full())).toEqual({ value: 'Caption from photos.yaml', source: 'photos.yaml' });
    });
    it('2. embedded IPTC/XMP description (P1 extension point)', () => {
      expect(resolveCaption(without(full(), 'caption'))).toEqual({ value: 'Embedded description', source: 'embedded' });
    });
    it('3. none', () => {
      expect(resolveCaption({ ...without(full(), 'caption'), embedded: undefined })).toEqual({});
    });
  });

  describe('photographer: photos.yaml → @folder → nearest index.md → P1 embedded → none', () => {
    it('1. photos.yaml photographer', () => {
      expect(resolvePhotographerSlug(full())).toEqual({ value: 'sari-wijaya', source: 'photos.yaml' });
    });
    it('2. @folder name', () => {
      expect(resolvePhotographerSlug(without(full(), 'photographer'))).toEqual({ value: 'andi-pratama', source: 'folder' });
    });
    it('3. nearest ancestor index.md (own node first)', () => {
      const ctx = { ...without(full(), 'photographer'), folderPhotographer: undefined };
      expect(resolvePhotographerSlug(ctx)).toEqual({ value: 'node-photographer', source: 'index.md' });
    });
    it('3. …then the parent when the own node has none', () => {
      const ctx = { ...without(full(), 'photographer'), folderPhotographer: undefined };
      ctx.ancestors = [{ date: calendar(2026, 9, 20) }, { photographer: 'parent-photographer' }];
      expect(resolvePhotographerSlug(ctx)).toEqual({ value: 'parent-photographer', source: 'index.md' });
    });
    it('4. embedded Artist / By-line (P1 extension point)', () => {
      const ctx = { ...without(full(), 'photographer'), folderPhotographer: undefined, ancestors: [] };
      expect(resolvePhotographerSlug(ctx)).toEqual({ value: 'embedded-artist', source: 'embedded' });
    });
    it('5. none', () => {
      const ctx = { ...without(full(), 'photographer'), folderPhotographer: undefined, ancestors: [], embedded: undefined };
      expect(resolvePhotographerSlug(ctx)).toEqual({});
    });
  });

  describe('date: photos.yaml → EXIF → nearest index.md → none', () => {
    it('1. photos.yaml date (calendar date)', () => {
      expect(resolveDate(full())).toEqual({ value: calendar(2026, 9, 22), source: 'photos.yaml' });
    });
    it('1. photos.yaml date with a time, in TIMEZONE', () => {
      const ctx = full();
      ctx.override = { date: { year: 2026, month: 9, day: 22, hour: 18, minute: 30, second: 0, hasTime: true } };
      expect(resolveDate(ctx)).toEqual({
        value: { instant: Date.UTC(2026, 8, 22, 10, 30), day: '2026-09-22', hasTime: true },
        source: 'photos.yaml',
      });
    });
    it('2. EXIF DateTimeOriginal, in TIMEZONE', () => {
      expect(resolveDate(without(full(), 'date'))).toEqual({
        value: { instant: Date.UTC(2026, 8, 21, 2, 15), day: '2026-09-21', hasTime: true },
        source: 'exif',
      });
    });
    it('2. EXIF with OffsetTimeOriginal uses the offset for the instant', () => {
      const ctx = { ...without(full(), 'date'), exif: { dateTimeOriginal: '2026:09:21 10:15:00', offsetTimeOriginal: '+07:00' } };
      expect(resolveDate(ctx).value?.instant).toBe(Date.UTC(2026, 8, 21, 3, 15));
    });
    it('3. nearest ancestor index.md date (own node first)', () => {
      const ctx = { ...without(full(), 'date'), exif: undefined };
      expect(resolveDate(ctx)).toEqual({ value: calendar(2026, 9, 20), source: 'index.md' });
    });
    it('3. …then the parent when the own node has none', () => {
      const ctx = { ...without(full(), 'date'), exif: { dateTimeOriginal: '0000:00:00 00:00:00' } };
      ctx.ancestors = [{ photographer: 'x' }, { date: calendar(2026, 9, 1) }];
      expect(resolveDate(ctx)).toEqual({ value: calendar(2026, 9, 1), source: 'index.md' });
    });
    it('4. none', () => {
      expect(resolveDate({ ...without(full(), 'date'), exif: undefined, ancestors: [] })).toEqual({});
    });
  });

  describe('alt: photos.yaml → caption → generated', () => {
    it('1. photos.yaml alt', () => {
      expect(resolveAlt(full(), 'A caption', 'Andi Pratama')).toEqual({ value: 'Alt from photos.yaml', source: 'photos.yaml' });
    });
    it('2. caption (as one line)', () => {
      expect(resolveAlt(without(full(), 'alt'), 'A caption\non two lines', 'Andi Pratama')).toEqual({
        value: 'A caption on two lines',
        source: 'caption',
      });
    });
    it('3. generated with the photographer', () => {
      expect(resolveAlt(without(full(), 'alt'), undefined, 'Andi Pratama')).toEqual({
        value: 'Photo from Day 1 by Andi Pratama',
        source: 'generated',
      });
    });
    it('3. generated without a photographer', () => {
      expect(resolveAlt(without(full(), 'alt'), undefined, undefined)).toEqual({ value: 'Photo from Day 1', source: 'generated' });
      expect(generatedAlt('Day 1')).toBe('Photo from Day 1');
    });
  });

  describe('hidden: photos.yaml only', () => {
    it('photos.yaml hidden: true / false / absent', () => {
      expect(resolveHidden(full())).toBe(true);
      expect(resolveHidden({ ...full(), override: { hidden: false } })).toBe(false);
      expect(resolveHidden({ ...full(), override: undefined })).toBe(false);
    });
  });

  describe('resolvePhotoMetadata', () => {
    it('combines all fields and resolves the photographer name for alt text', () => {
      const ctx = { ...without(full(), 'caption', 'alt', 'photographer'), embedded: undefined };
      expect(resolvePhotoMetadata(ctx)).toEqual({
        photographer: lookupPhotographer('andi-pratama', registry),
        date: calendar(2026, 9, 22),
        alt: 'Photo from Day 1 by Andi Pratama',
        hidden: true,
        sources: { photographer: 'folder', date: 'photos.yaml', alt: 'generated' },
      });
    });

    it('leaves absent values out entirely (never "Unknown")', () => {
      const resolved = resolvePhotoMetadata({ ancestors: [], nodeTitle: 'Day 1', registry, timeZone: TZ });
      expect(resolved).toEqual({ alt: 'Photo from Day 1', hidden: false, sources: { alt: 'generated' } });
      expect(JSON.stringify(resolved)).not.toMatch(/unknown/i);
    });

    it('uses the caption for alt text when there is no photos.yaml alt', () => {
      const ctx = { ...without(full(), 'alt'), embedded: undefined };
      expect(resolvePhotoMetadata(ctx)).toMatchObject({ alt: 'Caption from photos.yaml', sources: { alt: 'caption', caption: 'photos.yaml' } });
    });
  });
});
