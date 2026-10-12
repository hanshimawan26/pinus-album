/**
 * Content model → published album tree. PURE.
 *
 * - Drafts: a draft node and its whole subtree are left out unless `includeDrafts` (dev).
 * - Hidden photos are left out everywhere (grids, counts, covers, derived dates).
 * - Ordering (TRD §4.3):
 *   - events (top level): newest date first;
 *   - sections and sub-sections: `order`, else numeric folder prefix, else date, else name;
 *   - photos: by date/time, then path; or by path when the node sets `sort: filename`.
 * - Counts: `photoCount` includes all published descendants; `sectionCount` = direct children.
 * - Cover: index.md `cover` → first photo of the node → cover of the first child that has one.
 * - Date: index.md `date`, else derived (TRD §4.2 rule 7): the earliest of the node's own
 *   photos.yaml/EXIF photo dates and its published children's dates. A photo date that only
 *   fell back to an ancestor's index.md says nothing about this node, so it is not used.
 */
import { compareAlbumDates, type AlbumDate } from '../dates.ts';
import type { AlbumNode, ContentModel, ModelNode, Photo, PhotoSort } from './types.ts';

export interface TreeOptions {
  /** Include draft nodes (true in `astro dev`, false in production builds). */
  includeDrafts: boolean;
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** Natural order ("day-2" before "day-10"), with a byte-order tiebreak so it is total. */
export function compareNames(a: string, b: string): number {
  return collator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0);
}

/** Ascending, undefined last. */
function compareOptionalNumbers(a: number | undefined, b: number | undefined): number {
  if (a !== undefined && b !== undefined) return a - b;
  if (a !== undefined) return -1;
  if (b !== undefined) return 1;
  return 0;
}

export function comparePhotos(sort: PhotoSort): (a: Photo, b: Photo) => number {
  if (sort === 'filename') return (a, b) => compareNames(a.relPath, b.relPath);
  return (a, b) => compareAlbumDates(a.date, b.date) || compareNames(a.relPath, b.relPath);
}

/** Top-level events: newest date first (undated last), then `order`, then name. */
export function compareEvents(a: AlbumNode, b: AlbumNode): number {
  const newestFirst = a.date && b.date ? b.date.instant - a.date.instant : compareAlbumDates(a.date, b.date);
  return (
    newestFirst ||
    compareOptionalNumbers(a.order, b.order) ||
    compareNames(a.slug, b.slug)
  );
}

/** Sections: `order`, else numeric prefix, else date, else name (all ascending; missing last). */
export function compareSections(a: AlbumNode, b: AlbumNode): number {
  return (
    compareOptionalNumbers(a.order, b.order) ||
    compareOptionalNumbers(a.prefix, b.prefix) ||
    compareAlbumDates(a.date, b.date) ||
    compareNames(a.slug, b.slug)
  );
}

/** All published photos of a node and its published descendants, in display order. */
export function photosInSubtree(node: AlbumNode): Photo[] {
  return [...node.photos, ...node.children.flatMap(photosInSubtree)];
}

export function buildTree(model: ContentModel, options: TreeOptions): AlbumNode {
  return assemble(model.root, [], options);
}

function assemble(model: ModelNode, parentPath: readonly string[], options: TreeOptions): AlbumNode {
  const slugPath = model.depth === 0 ? [] : [...parentPath, model.slug];
  const photos = model.photos.filter((photo) => !photo.hidden).sort(comparePhotos(model.meta.sort));
  const children = model.children
    .filter((child) => options.includeDrafts || !child.meta.draft)
    .map((child) => assemble(child, slugPath, options))
    .sort(model.depth === 0 ? compareEvents : compareSections);

  const node: AlbumNode = {
    slug: model.slug,
    slugPath,
    folderName: model.source.folderName,
    dir: model.source.dir,
    depth: model.depth,
    title: model.title,
    draft: model.meta.draft,
    sort: model.meta.sort,
    photos,
    children,
    photoCount: photos.length + children.reduce((sum, child) => sum + child.photoCount, 0),
    sectionCount: children.length,
  };
  if (model.story !== undefined) node.story = model.story;
  if (model.meta.order !== undefined) node.order = model.meta.order;
  if (model.prefix !== undefined) node.prefix = model.prefix;

  if (model.date) {
    node.date = model.date;
    node.dateSource = 'index.md';
    if (model.endDate) node.endDate = model.endDate;
  } else if (model.depth > 0) {
    const earliest = derivedDate(node);
    if (earliest) {
      node.date = earliest;
      node.dateSource = 'photos';
    }
  }

  const cover = chooseCover(model, node);
  if (cover) node.cover = cover;
  return node;
}

/**
 * Date of a node without an index.md date (TRD §4.2 rule 7: "the earliest photo").
 * Only dates that describe this node count: its own photos' photos.yaml and EXIF dates, and
 * its children's dates (their index.md date, or derived the same way). Since this node sets
 * no date, an own photo dated by `index.md` inherited it from an ancestor (for example a
 * WhatsApp photo in Day 3 that got the event's start date); using it would misdate the node
 * and misorder its siblings. Hidden photos and unpublished children are not passed in.
 */
function derivedDate(node: AlbumNode): AlbumDate | undefined {
  const candidates = [
    ...node.photos.filter((photo) => photo.sources.date !== 'index.md').map((photo) => photo.date),
    ...node.children.map((child) => child.date),
  ];
  return candidates.reduce<AlbumDate | undefined>((min, date) => (date && (!min || date.instant < min.instant) ? date : min), undefined);
}

function chooseCover(model: ModelNode, node: AlbumNode): Photo | undefined {
  if (model.coverFile) {
    const chosen = photosInSubtree(node).find((photo) => photo.file === model.coverFile);
    // A missing cover is a validation error; a hidden one, or one inside an unpublished draft,
    // is a warning. Either way, fall back to the default cover.
    if (chosen) return chosen;
  }
  return node.photos[0] ?? node.children.find((child) => child.cover)?.cover;
}

// ---------------------------------------------------------------------------------------
// Lookups (for pages: routes, breadcrumbs, sibling navigation)
// ---------------------------------------------------------------------------------------

export const slugPathKey = (slugPath: readonly string[]): string => slugPath.join('/');

/** Every node keyed by its slug path (`demo-event-a/day-1`); the root is `''`. */
export function indexNodes(root: AlbumNode): Map<string, AlbumNode> {
  const nodes = new Map<string, AlbumNode>();
  const visit = (node: AlbumNode) => {
    nodes.set(slugPathKey(node.slugPath), node);
    node.children.forEach(visit);
  };
  visit(root);
  return nodes;
}

/** Nodes from the event down to the node at `slugPath` (inclusive), or undefined. */
export function pathTo(root: AlbumNode, slugPath: readonly string[]): AlbumNode[] | undefined {
  const chain: AlbumNode[] = [];
  let current = root;
  for (const slug of slugPath) {
    const next = current.children.find((child) => child.slug === slug);
    if (!next) return undefined;
    chain.push(next);
    current = next;
  }
  return chain;
}

/** Previous and next sibling of the node at `slugPath`, in display order. */
export function siblingsOf(root: AlbumNode, slugPath: readonly string[]): { previous?: AlbumNode; next?: AlbumNode } {
  const chain = pathTo(root, slugPath);
  if (!chain || chain.length === 0) return {};
  const parent = chain.length > 1 ? chain[chain.length - 2] : root;
  const siblings = parent?.children ?? [];
  const index = siblings.findIndex((child) => child.slug === slugPath[slugPath.length - 1]);
  const result: { previous?: AlbumNode; next?: AlbumNode } = {};
  if (index > 0) result.previous = siblings[index - 1];
  if (index >= 0 && index < siblings.length - 1) result.next = siblings[index + 1];
  return result;
}
