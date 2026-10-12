import { describe, expect, it } from 'vitest';
import { build, sourceTree } from '../helpers/content.ts';
import type { AlbumNode } from '../../src/lib/content/types.ts';
import { viewerPhoto, type ViewerImage } from '../../src/lib/viewer-data.ts';
import { rowsFor } from '../../src/scripts/viewer/rows.ts';

const alice = { name: 'Alice (Demo)', initials: 'AD', instagramUrl: 'https://www.instagram.com/alice.demo.placeholder/' };
const budi = { name: 'Budi (Demo)', initials: 'BD' };
const date = { label: '20 Sep 2026', iso: '2026-09-20' };

describe('rowsFor (TRD §6.5: absent data disappears)', () => {
  it('shows every row, with the name as a link, when everything is known', () => {
    expect(rowsFor({ photographer: alice, date, caption: 'Hi' })).toEqual({
      credit: true,
      avatar: true,
      nameRow: true,
      nameLink: true,
      nameText: false,
      dateRow: true,
      captionBlock: true,
    });
  });

  it('shows the name as plain text without an Instagram handle', () => {
    expect(rowsFor({ photographer: budi, date })).toMatchObject({ nameLink: false, nameText: true, captionBlock: false });
  });

  it('never links a malformed profile URL', () => {
    expect(rowsFor({ photographer: { ...alice, instagramUrl: 'javascript:alert(1)' } })).toMatchObject({ nameLink: false, nameText: true });
  });

  it('hides the photographer row but keeps the date when nobody is credited', () => {
    expect(rowsFor({ date })).toMatchObject({ credit: true, avatar: false, nameRow: false, nameLink: false, nameText: false, dateRow: true });
  });

  it('hides the date row when the date is unknown', () => {
    expect(rowsFor({ photographer: budi })).toMatchObject({ credit: true, nameRow: true, dateRow: false });
  });

  it('hides the whole credit when neither photographer nor date is known', () => {
    expect(rowsFor({})).toEqual({
      credit: false,
      avatar: false,
      nameRow: false,
      nameLink: false,
      nameText: false,
      dateRow: false,
      captionBlock: false,
    });
  });

  it('hides the caption area for an empty caption', () => {
    expect(rowsFor({ caption: '' }).captionBlock).toBe(false);
  });
});

describe('rowsFor on photos built by the content engine', () => {
  const image: ViewerImage = { src: '/x/a.webp', srcset: '/x/a.webp 800w', sizes: '100vw', width: 800, height: 533 };
  const { root } = build(
    sourceTree(
      [
        {
          folder: 'event',
          photos: '"@andi/full.jpg":\n  caption: "Opening dance"\n',
          images: { '@andi/full.jpg': { exif: '2026:09:20 18:30:00' }, '@sari/plain.jpg': {}, 'loose.jpg': {} },
        },
      ],
      { photographers: 'andi:\n  name: "Andi Pratama"\n  instagram: "andi.pratama"\nsari:\n  name: "Sari Wijaya"\n' },
    ),
  );
  const photos = new Map((root.children[0] as AlbumNode).photos.map((photo) => [photo.relPath, viewerPhoto(photo, image)]));
  const rows = (relPath: string) => {
    const photo = photos.get(relPath);
    if (!photo) throw new Error(`No photo ${relPath}`);
    return rowsFor(photo);
  };

  it('links a photographer with a handle and shows the caption', () => {
    expect(rows('@andi/full.jpg')).toMatchObject({ nameLink: true, nameText: false, dateRow: true, captionBlock: true });
  });

  it('shows a plain name and no caption area for a photographer without a handle', () => {
    expect(rows('@sari/plain.jpg')).toMatchObject({ nameLink: false, nameText: true, captionBlock: false });
  });

  it('shows no photographer row and no date row for an uncredited, undated photo', () => {
    expect(rows('loose.jpg')).toMatchObject({ credit: false, nameRow: false, dateRow: false, captionBlock: false });
  });
});
