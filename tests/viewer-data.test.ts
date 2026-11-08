import { describe, expect, it } from 'vitest';
import { build, sourceTree } from './helpers/content.ts';
import type { AlbumNode, Photo } from '../src/lib/content/types.ts';
import { archiveFileName, downloadFileName, gridPhotos, viewerContext, viewerPhoto, type ViewerDownload, type ViewerImage } from '../src/lib/viewer-data.ts';

const image: ViewerImage = { src: '/x/a.webp', srcset: '/x/a.webp 800w', sizes: '100vw', width: 800, height: 533 };
const download: ViewerDownload = { src: '/x/a.jpg', width: 2400, height: 1600, fileName: 'event-a.jpg' };

function photosOf(node: AlbumNode): Map<string, Photo> {
  return new Map(node.photos.map((photo) => [photo.relPath, photo]));
}

describe('viewerPhoto', () => {
  const { root } = build(
    sourceTree(
      [
        {
          folder: 'event',
          index: '---\ntitle: "Event"\ndate: 2026-09-20\n---\n',
          photos: '"@andi/full.jpg":\n  caption: "Opening dance"\n',
          images: {
            '@andi/full.jpg': { exif: '2026:09:20 18:30:00' },
            '@sari/plain.jpg': {},
            'loose.jpg': {},
          },
        },
      ],
      { photographers: 'andi:\n  name: "Andi Pratama"\n  instagram: "andi.pratama"\nsari:\n  name: "Sari Wijaya"\n' },
    ),
  );
  const event = root.children[0] as AlbumNode;
  const photos = photosOf(event);

  it('carries every field the viewer shows (TRD §6.5)', () => {
    expect(viewerPhoto(photos.get('@andi/full.jpg') as Photo, image, download)).toEqual({
      slug: 'andi-full',
      image,
      download,
      alt: 'Opening dance',
      caption: 'Opening dance',
      photographer: {
        name: 'Andi Pratama',
        instagramUrl: 'https://www.instagram.com/andi.pratama/',
      },
      date: { label: '20 Sep 2026', iso: '2026-09-20' },
    });
  });

  it('leaves out the caption and Instagram link when absent', () => {
    const data = viewerPhoto(photos.get('@sari/plain.jpg') as Photo, image, download);
    expect(data).not.toHaveProperty('caption');
    expect(data.photographer).toEqual({ name: 'Sari Wijaya' });
    // Date falls back to the event's index.md date (TRD §4.6).
    expect(data.date).toEqual({ label: '20 Sep 2026', iso: '2026-09-20' });
  });

  it('leaves out the photographer when nobody is credited', () => {
    const data = viewerPhoto(photos.get('loose.jpg') as Photo, image, download);
    expect(data).not.toHaveProperty('photographer');
    expect(data.alt).toBe('Photo from Event');
  });

  it('leaves out the date when there is none', () => {
    const { root: undated } = build(sourceTree([{ folder: 'e', images: ['a.jpg'] }]));
    const photo = (undated.children[0] as AlbumNode).photos[0] as Photo;
    expect(viewerPhoto(photo, image, download)).not.toHaveProperty('date');
  });

  it('uses the slug and context of its place on the page (the "All photos" page)', () => {
    const photo = photos.get('@sari/plain.jpg') as Photo;
    expect(viewerPhoto(photo, image, download)).not.toHaveProperty('context');
    const placed = viewerPhoto(photo, image, download, { slug: 'day-1/sari-plain', context: 'Day 1 · Event' });
    expect(placed).toMatchObject({ slug: 'day-1/sari-plain', context: 'Day 1 · Event' });
  });
});

describe('archiveFileName', () => {
  it('names the ZIP after the album path', () => {
    expect(archiveFileName(['pinus-ori', 'day-1'])).toBe('pinus-ori-day-1-photos.zip');
    expect(archiveFileName(['halloween'])).toBe('halloween-photos.zip');
  });
});

describe('downloadFileName', () => {
  it('names the file after the album path and the photo, the same from either page', () => {
    expect(downloadFileName(['pinus-ori', 'day-1'], 'img-0012')).toBe('pinus-ori-day-1-img-0012.jpg');
    expect(downloadFileName(['pinus-ori'], 'day-1/img-0012')).toBe('pinus-ori-day-1-img-0012.jpg');
  });
});

describe('gridPhotos', () => {
  it('places an album\'s photos under their own slugs', () => {
    const { root } = build(sourceTree([{ folder: 'e', images: ['@a/IMG_1.jpg', '@b/IMG_1.jpg'] }]));
    const album = root.children[0] as AlbumNode;
    expect(gridPhotos(album.photos)).toEqual(album.photos.map((photo) => ({ photo, slug: photo.slug })));
  });
});

describe('viewerContext', () => {
  it('lists the node, then its ancestors', () => {
    expect(viewerContext(['Pergelaran 2026', 'Day 1'])).toBe('Day 1 · Pergelaran 2026');
    expect(viewerContext(['Welcome Picnic'])).toBe('Welcome Picnic');
  });
});
