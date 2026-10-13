/**
 * The home page's landing blocks (TRD §6.2): which event is featured, which photos each
 * "chapter" shows and which photo is in the spotlight. PURE.
 *
 * - **Featured event:** the event with `featured: true` in its index.md (the newest one, if
 *   several), else the newest event. Only events with photos count.
 * - **Hero:** its cover.
 * - **Spotlight:** its first `highlights:` photo; without a list, its first photo with a
 *   caption, else the photo in the middle of the event.
 * - **Chapters of the featured event:** one per section, with up to CHAPTER_PHOTOS photos
 *   each; an event without sections gets one "highlights" chapter instead.
 * - **More events:** the next MORE_EVENTS events with photos, one chapter each.
 *
 * Photos of a chapter are its album's `highlights:` (curated, best first), else picked
 * automatically: the album's cover, then photos evenly spread over the album in date order.
 * No photo appears twice on the page.
 */
import { compareAlbumDates } from './dates.ts';
import type { AlbumNode, Photo } from './content/types.ts';

/** Photos per chapter: a large pair, then a row of three (DESIGN.md, "Landing"). */
export const CHAPTER_PHOTOS = 5;

/** Events shown as chapters after the featured one. The full list follows below them. */
export const MORE_EVENTS = 3;

/** A photo with the album that holds it, for its deep link (`albums/<path>/#<slug>`). */
export interface PlacedPhoto {
  photo: Photo;
  /** Slug path of the album that holds the photo. */
  albumPath: string[];
  /** Titles from the event down to that album: `["Pinus ORI", "Day 1"]`. */
  titles: string[];
}

export interface Chapter {
  node: AlbumNode;
  /**
   * `section`: a section of the featured event. `highlights`: the featured event itself, when
   * it has no sections (the hero already shows its title). `event`: a later event.
   */
  kind: 'section' | 'highlights' | 'event';
  /** 1-based position among the featured event's sections (sections only). */
  position?: { index: number; total: number };
  photos: PlacedPhoto[];
}

export interface Landing {
  featured: AlbumNode;
  hero: PlacedPhoto;
  /** Distinct credited photographers in the featured event. */
  photographerCount: number;
  /** The featured event's sections, or the featured event itself when it has none. */
  chapters: Chapter[];
  spotlight?: PlacedPhoto;
  /** Later events, newest first. */
  moreEvents: Chapter[];
}

/** Every published photo of `node` and its sections with its place, oldest first (album order on ties). */
export function placedPhotos(node: AlbumNode, parentTitles: readonly string[] = []): PlacedPhoto[] {
  const placed: PlacedPhoto[] = [];
  const visit = (current: AlbumNode, titles: readonly string[]) => {
    for (const photo of current.photos) placed.push({ photo, albumPath: current.slugPath, titles: [...titles] });
    for (const child of current.children) visit(child, [...titles, child.title]);
  };
  visit(node, [...parentTitles, node.title]);
  return placed.sort((a, b) => compareAlbumDates(a.photo.date, b.photo.date));
}

/**
 * `count` photos spread evenly over `pool`: the first, then every (n / count)-th. All of them
 * when the pool is not larger than `count`.
 */
export function spreadEvenly<T>(pool: readonly T[], count: number): T[] {
  if (count <= 0) return [];
  if (pool.length <= count) return [...pool];
  return Array.from({ length: count }, (_, i) => pool[Math.floor((i * pool.length) / count)] as T);
}

/**
 * Up to `count` photos for `node`, leaving out the files in `used` (and adding the chosen
 * ones to it): its shown `highlights:`, else its cover followed by photos spread evenly.
 */
export function chapterPhotos(node: AlbumNode, count: number, used: Set<string>, parentTitles: readonly string[] = []): PlacedPhoto[] {
  const all = placedPhotos(node, parentTitles);
  const byFile = new Map(all.map((placed) => [placed.photo.file, placed]));
  const fresh = (placed: PlacedPhoto | undefined): placed is PlacedPhoto => placed !== undefined && !used.has(placed.photo.file);

  const curated = node.highlights.map((photo) => byFile.get(photo.file)).filter(fresh);
  let chosen: PlacedPhoto[];
  if (curated.length > 0) {
    chosen = curated.slice(0, count);
  } else {
    const cover = node.cover ? byFile.get(node.cover.file) : undefined;
    const lead = fresh(cover) ? [cover] : [];
    const pool = all.filter((placed) => fresh(placed) && placed !== cover);
    chosen = [...lead, ...spreadEvenly(pool, count - lead.length)];
  }
  for (const placed of chosen) used.add(placed.photo.file);
  return chosen;
}

/** The spotlight photo of the featured event (see the module comment). */
function spotlightOf(event: AlbumNode, used: ReadonlySet<string>): PlacedPhoto | undefined {
  const all = placedPhotos(event).filter((placed) => !used.has(placed.photo.file));
  const curated = event.highlights.map((photo) => all.find((placed) => placed.photo.file === photo.file)).find((placed) => placed);
  return curated ?? all.find((placed) => placed.photo.caption) ?? all[Math.floor(all.length / 2)];
}

function countPhotographers(event: AlbumNode): number {
  const slugs = placedPhotos(event).flatMap(({ photo }) => (photo.photographer ? [photo.photographer.slug] : []));
  return new Set(slugs).size;
}

/** The landing blocks for the published tree, or undefined when no event has photos yet. */
export function buildLanding(root: AlbumNode): Landing | undefined {
  const events = root.children.filter((event) => event.photoCount > 0 && event.cover);
  const featured = events.find((event) => event.featured) ?? events[0];
  if (!featured?.cover) return undefined;
  const later = events.filter((event) => event !== featured);

  const hero = placedPhotos(featured).find((placed) => placed.photo.file === featured.cover?.file);
  if (!hero) return undefined;
  const used = new Set([hero.photo.file]);

  const spotlight = spotlightOf(featured, used);
  if (spotlight) used.add(spotlight.photo.file);

  const sections = featured.children.filter((section) => section.photoCount > 0);
  const chapters: Chapter[] =
    sections.length > 0
      ? sections.map((section, index) => ({
          node: section,
          kind: 'section' as const,
          position: { index: index + 1, total: sections.length },
          photos: chapterPhotos(section, CHAPTER_PHOTOS, used, [featured.title]),
        }))
      : [{ node: featured, kind: 'highlights' as const, photos: chapterPhotos(featured, CHAPTER_PHOTOS, used) }];

  const moreEvents = later
    .slice(0, MORE_EVENTS)
    .map((event) => ({ node: event, kind: 'event' as const, photos: chapterPhotos(event, CHAPTER_PHOTOS, used) }));

  const landing: Landing = {
    featured,
    hero,
    photographerCount: countPhotographers(featured),
    chapters: chapters.filter((chapter) => chapter.photos.length > 0),
    moreEvents: moreEvents.filter((chapter) => chapter.photos.length > 0),
  };
  if (spotlight) landing.spotlight = spotlight;
  return landing;
}
