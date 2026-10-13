/**
 * TRD §4.8 validation: content model → Issue[]. PURE.
 *
 * Errors fail the build and `photos:check`; warnings are printed only. Every message is
 * plain English and says what to do, because maintainers may not be developers.
 * Validation covers everything, including draft nodes and hidden photos, so problems are
 * caught before a draft is published.
 */
import { formatDate, formatDateRange, isDayWithin } from '../dates.ts';
import { ALL_PHOTOS_SLUG } from '../slug.ts';
import type { ContentModel, Issue, IssueCode, ModelNode, Photo, SourceStray } from './types.ts';

/** Images above this size get a warning (TRD §4.8: "image over 2 MB"). */
export const LARGE_IMAGE_BYTES = 2 * 1024 * 1024;
/** Total content above this size gets a warning (TRD §4.8: "over 700 MB"). */
export const CONTENT_WARNING_BYTES = 700 * 1024 * 1024;

const SUPPORTED_CONTENT_FORMATS = new Set(['jpeg', 'png', 'webp']);

/** How to turn a HEIC/HEIF photo into a JPEG. Shared with photos:prep. */
export const HEIC_CONVERSION_HELP =
  'To convert: on a Mac, open it in Preview and use File → Export → JPEG; on Windows, open it in Photos and use "Save as" → JPG. ' +
  'Then delete the .heic file. To avoid this in future, set the iPhone to Settings → Camera → Formats → Most Compatible.';

/** The command that shrinks photos and removes their location (TRD §9), for messages. */
const PREP_COMMAND = (folder: string) => `npm run photos:prep -- "${folder}"`;
const folderOf = (file: string) => file.slice(0, file.lastIndexOf('/'));

const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

/** The metadata file a near-miss name was meant to be: `Photos.yml` → `photos.yaml`. */
function intendedMetadataName(name: string): string {
  if (/^photographer/i.test(name)) return 'photographers.yaml';
  if (/^photo/i.test(name)) return 'photos.yaml';
  return 'index.md';
}

/** Windows hides known extensions, so Notepad's "photos.yaml.txt" looks like "photos.yaml". */
const txtHint = (name: string) =>
  /\.txt$/i.test(name)
    ? ' Windows may hide the ".txt" ending: in File Explorer, turn on View → Show → File name extensions to see and remove it.'
    : '';

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const quoteList = (items: readonly string[]) => items.map((item) => `"${item}"`).join(', ');

class IssueList {
  readonly issues: Issue[] = [];
  error(code: IssueCode, file: string, message: string): void {
    this.issues.push({ level: 'error', code, file, message });
  }
  warning(code: IssueCode, file: string, message: string): void {
    this.issues.push({ level: 'warning', code, file, message });
  }
}

export function validateContent(model: ContentModel): Issue[] {
  const list = new IssueList();

  if (model.photographersFile) {
    for (const problem of model.photographersProblems) {
      list.error('invalid-photographers-yaml', model.photographersFile, problem);
    }
  }
  visitNode(model.root, list);
  checkFeatured(model.root, list);

  if (model.totalBytes > CONTENT_WARNING_BYTES) {
    list.warning(
      'content-too-large',
      model.root.source.dir,
      `All album files together are ${megabytes(model.totalBytes)} (warning limit ${megabytes(CONTENT_WARNING_BYTES)}). ` +
        'A GitHub Pages site is limited to 1 GB. Run npm run photos:prep on the largest events, or move old events out ' +
        'of the repository. The "Size limits" section of README.md explains the options.',
    );
  }

  // Errors first, then warnings; within a level, by file. The sort is stable.
  return list.issues.sort(
    (a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1) || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0),
  );
}

function visitNode(node: ModelNode, list: IssueList): void {
  const { source } = node;
  const isRoot = node.depth === 0;

  for (const stray of source.strays) reportStray(stray, list);
  checkImageFiles(node, list);
  checkSiblingSlugs(node, list);

  if (!isRoot) {
    if (node.slug === '') {
      list.error(
        'invalid-folder-name',
        source.dir,
        `The folder name "${source.folderName}" has no plain letters (a–z) or digits, so it cannot be used in a web address. ` +
          'Rename it using a–z, 0–9 and dashes, for example "day-1".',
      );
    }
    if (source.indexMd) {
      for (const problem of node.indexProblems) list.error('invalid-index-md', source.indexMd.file, problem);
    }
    if (source.photosYaml) {
      for (const problem of node.photosYamlProblems) list.error('invalid-photos-yaml', source.photosYaml.file, problem);
      checkPhotoKeys(node, source.photosYaml.file, list);
    }
    checkPhotoSlugs(node, list);
    checkCover(node, list);
    checkHighlights(node, list);
    checkNoCover(node, list);
    for (const photo of node.photos) checkPhoto(photo, node, list);
  }

  node.children.forEach((child) => visitNode(child, list));
}

// ---------------------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------------------

function reportStray(stray: SourceStray, list: IssueList): void {
  const extension = stray.file.slice(stray.file.lastIndexOf('.')).toLowerCase();
  switch (stray.kind) {
    case 'heic':
      list.error(
        'unsupported-format',
        stray.file,
        `HEIC/HEIF photos (the iPhone default) cannot be shown on the website. Convert it to JPEG. ${HEIC_CONVERSION_HELP}`,
      );
      return;
    case 'unsupported-image':
      list.error(
        'unsupported-format',
        stray.file,
        `"${extension}" images are not supported. Convert the file to .jpg (or .png / .webp) and delete this one.`,
      );
      return;
    case 'video':
      list.warning(
        'ignored-file',
        stray.file,
        'Videos are not shown on the website, so this file is ignored. Remove it to keep the repository small.',
      );
      return;
    // Metadata files that are not read are errors, not warnings: they may carry
    // `hidden: true` or `draft: true`, and ignoring those would publish what should not be.
    case 'misnamed-metadata': {
      const name = baseName(stray.file);
      list.error(
        'misnamed-file',
        stray.file,
        `"${name}" is not read, because the name must be exactly "${intendedMetadataName(name)}" (all lowercase). Rename it.${txtHint(name)}`,
      );
      return;
    }
    case 'metadata-in-photographer-folder': {
      const name = baseName(stray.file);
      const intended = intendedMetadataName(name);
      const folder = baseName(stray.file.slice(0, stray.file.lastIndexOf('/')));
      const how =
        intended === 'photos.yaml'
          ? `Move it up one level, next to the "${folder}" folder, and write each key as a path such as "${folder}/IMG_0012.jpg" (in double quotes). ` +
            'If that folder already has a photos.yaml, add the entries to it.'
          : intended === 'index.md'
            ? `Move it up one level, next to the "${folder}" folder (merge it with the index.md there, if there is one).`
            : 'Move its entries to photographers.yaml in the main albums folder.';
      list.error(
        'misplaced-file',
        stray.file,
        `"${name}" is not read inside a photographer folder (${folder}), which holds photos only. ${how}${txtHint(name)}`,
      );
      return;
    }
    case 'metadata-in-albums-folder': {
      const name = baseName(stray.file);
      list.error(
        'misplaced-file',
        stray.file,
        `"${name}" is not read in the main albums folder: every event has its own ${intendedMetadataName(name)} inside the event folder. ` +
          'Move it into the event folder it describes.',
      );
      return;
    }
    case 'photographers-yaml-in-node':
      list.error(
        'misplaced-file',
        stray.file,
        `photographers.yaml is only read in the main albums folder (next to the event folders), so "${baseName(stray.file)}" here is ignored. ` +
          'Move its entries to src/albums/photographers.yaml.',
      );
      return;
    case 'nested-in-photographer-folder':
      list.error(
        'misplaced-file',
        stray.file,
        'Photographer folders (@name) must contain photos only, not sub-folders. Move the photos up into the @ folder, or make this a section folder (without @) next to it.',
      );
      return;
    case 'outside-event':
      list.error(
        'misplaced-file',
        stray.file,
        'Photos and @photographer folders must be inside an event folder, not directly in the albums folder. Move it into an event folder.',
      );
      return;
    case 'invalid-photographer-folder':
      list.error(
        'misplaced-file',
        stray.file,
        'A photographer folder needs a name after the @ with plain letters (a–z) or digits, for example "@andi-pratama". Rename it.',
      );
      return;
  }
}

function checkImageFiles(node: ModelNode, list: IssueList): void {
  for (const image of node.source.images) {
    if (image.readError !== undefined) {
      list.error(
        'unreadable-image',
        image.file,
        `This image could not be read (${image.readError}). The file may be damaged or not really an image. Replace it with a working .jpg.`,
      );
    } else if (image.info && !SUPPORTED_CONTENT_FORMATS.has(image.info.format)) {
      const extension = image.relPath.slice(image.relPath.lastIndexOf('.'));
      list.error(
        'unsupported-format',
        image.file,
        `This file is named "${extension}" but is really a ${image.info.format.toUpperCase()} image, which the website cannot show. ` +
          'Convert it to JPEG (for example with Preview on a Mac or Photos on Windows) and replace this file.',
      );
    }
    // The repository is public: anyone can download the original file and read its location.
    // photos:prep only rewrites JPEGs, so PNG and WebP files get different advice.
    if (image.info?.hasGps) {
      const fix =
        image.info.format === 'jpeg'
          ? `Remove it with ${PREP_COMMAND(folderOf(image.file))}.`
          : 'Export it again without location data (or save it as a JPEG and run photos:prep on its folder).';
      list.warning(
        'location-in-photo',
        image.file,
        'This photo contains the GPS location where it was taken. The website never shows it, but the original file in the ' +
          `public repository does. ${fix} Once the photo has been committed, its location also stays in the repository's ` +
          'history; "Take a photo down" in README.md explains how to remove it from there.',
      );
    }
    if (image.size > LARGE_IMAGE_BYTES) {
      list.warning(
        'large-image',
        image.file,
        `This image is ${megabytes(image.size)} (limit ${megabytes(LARGE_IMAGE_BYTES)}). Shrink it to at most 2400 px on the long side ` +
          `so the repository stays small: for JPEG photos, run ${PREP_COMMAND(folderOf(image.file))}; ` +
          'for PNG or WebP files, export them again at a smaller size.',
      );
    }
  }
}

function checkSiblingSlugs(node: ModelNode, list: IssueList): void {
  const seen = new Map<string, ModelNode>();
  for (const child of node.children) {
    if (child.slug === '') continue;
    // Events may be called "all"; a section may not, since …/<event>/all/ shows all photos.
    if (node.depth > 0 && child.slug === ALL_PHOTOS_SLUG) {
      list.error(
        'reserved-folder-name',
        child.source.dir,
        `The folder "${child.source.folderName}" would get the web address …/${ALL_PHOTOS_SLUG}/, which is already the ` +
          `"All photos" page of "${node.title}". Rename the folder, for example to "${ALL_PHOTOS_SLUG}-day".`,
      );
    }
    const first = seen.get(child.slug);
    if (!first) {
      seen.set(child.slug, child);
      continue;
    }
    list.error(
      'duplicate-node-slug',
      child.source.dir,
      `The folders "${first.source.folderName}" and "${child.source.folderName}" would get the same web address (…/${child.slug}/), ` +
        'because number prefixes and capital letters are not part of the address. Rename or merge one of them.',
    );
  }
}

function checkPhotoKeys(node: ModelNode, file: string, list: IssueList): void {
  const { unmatched, ambiguous, duplicates } = node.keyMatch;
  for (const { key, suggestion, reason } of unmatched) {
    let hint = ' Keys are paths relative to this folder, for example "@andi-pratama/IMG_0012.jpg". Check the spelling, or remove the entry if the photo was deleted.';
    if (reason === 'case') {
      hint =
        ` Did you mean "${suggestion}"? Capital letters matter: the website is built on Linux, where "IMG_1.JPG" and "img_1.jpg" are different files.`;
    } else if (reason === 'child-folder') {
      hint = ` "${suggestion}" is a sub-folder with its own album; move this entry to ${suggestion}/photos.yaml (without the "${suggestion}/" part).`;
    }
    list.error('photos-yaml-no-match', file, `"${key}" does not match any photo in this folder.${hint}`);
  }
  for (const { key, candidates } of ambiguous) {
    const options = candidates.map((path) => (path.includes('/') ? path : `./${path}`));
    list.error(
      'photos-yaml-ambiguous',
      file,
      `"${key}" matches more than one photo (${quoteList(candidates)}). Write the full path instead, for example ${quoteList(options)}.`,
    );
  }
  for (const { relPath, keys } of duplicates) {
    list.error('photos-yaml-duplicate', file, `The photo "${relPath}" is listed more than once (as ${quoteList(keys)}). Keep one entry.`);
  }
}

function checkPhotoSlugs(node: ModelNode, list: IssueList): void {
  const seen = new Map<string, Photo>();
  for (const photo of node.photos) {
    if (photo.slug === '') {
      list.error(
        'invalid-file-name',
        photo.file,
        `The file name "${baseName(photo.relPath)}" has no plain letters (a–z) or digits, so the photo cannot get its own link. ` +
          'Rename it using a–z, 0–9, dashes or underscores, for example "IMG_0001.jpg".',
      );
      continue;
    }
    const first = seen.get(photo.slug);
    if (!first) {
      seen.set(photo.slug, photo);
      continue;
    }
    list.error(
      'duplicate-photo-slug',
      photo.file,
      `The photos "${first.relPath}" and "${photo.relPath}" would get the same link (#${photo.slug}), ` +
        'because capital letters, punctuation and file extensions are not part of it. Rename one of the files.',
    );
  }
}

function allModelPhotos(node: ModelNode): Photo[] {
  return [...node.photos, ...node.children.flatMap(allModelPhotos)];
}

function checkCover(node: ModelNode, list: IssueList): void {
  const cover = node.meta.cover;
  const indexFile = node.source.indexMd?.file;
  if (cover === undefined || indexFile === undefined) return;

  const target = node.coverFile;
  const photos = allModelPhotos(node);
  const photo = target ? photos.find((p) => p.file === target) : undefined;
  if (photo) {
    checkCoverShown(node, photo, cover, indexFile, list);
    return;
  }

  const caseMatch = target ? photos.find((p) => p.file.toLowerCase() === target.toLowerCase()) : undefined;
  const hint = caseMatch
    ? ` Did you mean "${caseMatch.file.slice(node.source.dir.length + 1)}"? Capital letters matter: the website is built on Linux.`
    : ' The path is relative to this folder, for example "day-1/@andi-pratama/IMG_0012.jpg". Remove "cover" to use the first photo.';
  list.error('missing-cover', indexFile, `cover: "${cover}" does not match any photo in this folder or its sub-folders.${hint}`);
}

/**
 * index.md `featured: true` pins an event to the home page hero. On a section it does nothing;
 * on several events, the home page features the newest of them.
 */
function checkFeatured(root: ModelNode, list: IssueList): void {
  const featured: ModelNode[] = [];
  const visit = (node: ModelNode) => {
    if (node.meta.featured && node.source.indexMd) featured.push(node);
    node.children.forEach(visit);
  };
  visit(root);
  for (const node of featured.filter((candidate) => candidate.depth > 1)) {
    list.warning(
      'featured-ignored',
      node.source.indexMd?.file ?? node.source.dir,
      '"featured: true" only works for a whole event (a folder directly in src/albums), not for a section. Remove the line, or put it in the index.md of the event.',
    );
  }
  const events = featured.filter((candidate) => candidate.depth === 1);
  if (events.length > 1) {
    for (const node of events) {
      list.warning(
        'featured-ignored',
        node.source.indexMd?.file ?? node.source.dir,
        `More than one event has "featured: true" (${quoteList(events.map((event) => event.title))}). The home page features the newest of them. Remove the line from the others.`,
      );
    }
  }
}

/** index.md `highlights:`: each entry must name a photo of this album; one that is not shown is a warning. */
function checkHighlights(node: ModelNode, list: IssueList): void {
  const entries = node.meta.highlights;
  const indexFile = node.source.indexMd?.file;
  if (entries === undefined || indexFile === undefined) return;

  const photos = allModelPhotos(node);
  entries.forEach((entry, index) => {
    const target = node.highlightFiles?.[index];
    const photo = target ? photos.find((p) => p.file === target) : undefined;
    if (!photo) {
      const caseMatch = target ? photos.find((p) => p.file.toLowerCase() === target.toLowerCase()) : undefined;
      const hint = caseMatch
        ? ` Did you mean "${caseMatch.file.slice(node.source.dir.length + 1)}"? Capital letters matter: the website is built on Linux.`
        : ' The path is relative to this folder, for example "day-1/@andi-pratama/IMG_0012.jpg". Fix it, or remove the line.';
      list.error('missing-highlight', indexFile, `highlights: "${entry}" does not match any photo in this folder or its sub-folders.${hint}`);
      return;
    }
    if (node.meta.draft || node.meta.hidden) return; // the whole album is unpublished anyway
    const reason = notShownReason(node, photo);
    if (reason) {
      list.warning(
        'highlight-not-shown',
        indexFile,
        `highlights: "${entry}" ${reason}, so the home page leaves it out. Remove it from the list, or choose another photo.`,
      );
    }
  });
}

// ---------------------------------------------------------------------------------------
// Warnings
// ---------------------------------------------------------------------------------------

/** Nodes from `node` down to the node that holds the photo `file` (inclusive). */
function pathToPhoto(node: ModelNode, file: string): ModelNode[] | undefined {
  if (node.photos.some((photo) => photo.file === file)) return [node];
  for (const child of node.children) {
    const below = pathToPhoto(child, file);
    if (below) return [node, ...below];
  }
  return undefined;
}

/**
 * Why a photo of `node` is not shown although `node` is published: hidden in photos.yaml, or
 * inside a hidden or draft section. Undefined when it is shown.
 */
function notShownReason(node: ModelNode, photo: Photo): string | undefined {
  if (photo.hidden) return 'is a photo that is hidden in photos.yaml';
  const sections = pathToPhoto(node, photo.file)?.slice(1) ?? [];
  const hidden = sections.find((section) => section.meta.hidden);
  if (hidden) return `is in "${hidden.title}", which is hidden (hidden: true in its index.md)`;
  const draft = sections.find((section) => section.meta.draft);
  if (draft) return `is in "${draft.title}", which is a draft (not published yet)`;
  return undefined;
}

/**
 * A cover that exists but is not shown: hidden, or inside a draft or hidden section.
 * Warnings, not errors: hiding a photo is how a takedown request is handled (TRD §10), and a
 * takedown must never be blocked by a failing build. The album falls back to its first
 * photo (tree.ts).
 */
function checkCoverShown(node: ModelNode, photo: Photo, cover: string, indexFile: string, list: IssueList): void {
  if (photo.hidden) {
    list.warning(
      'cover-not-shown',
      indexFile,
      `cover: "${cover}" is a photo that is hidden in photos.yaml, so the album shows its first photo as the cover instead. ` +
        'Choose another cover, or remove "cover" to keep using the first photo.',
    );
    return;
  }
  if (node.meta.draft || node.meta.hidden) return; // the whole album is unpublished anyway
  const sections = pathToPhoto(node, photo.file)?.slice(1) ?? [];
  const hidden = sections.find((section) => section.meta.hidden);
  if (hidden) {
    list.warning(
      'cover-not-shown',
      indexFile,
      `cover: "${cover}" is in "${hidden.title}", which is hidden (hidden: true in its index.md). The website shows ` +
        'the first published photo as the cover instead. Choose a cover outside the hidden section to avoid this.',
    );
    return;
  }
  const draft = sections.find((section) => section.meta.draft);
  if (draft) {
    list.warning(
      'cover-not-shown',
      indexFile,
      `cover: "${cover}" is in "${draft.title}", which is a draft (not published yet). Until it is published, the website shows ` +
        'the first published photo as the cover. Choose a cover outside the draft to avoid this.',
    );
  }
}

function checkPhoto(photo: Photo, node: ModelNode, list: IssueList): void {
  if (photo.hidden) return;

  if (!photo.photographer) {
    list.warning(
      'no-photographer',
      photo.file,
      'No photographer is credited for this photo. Put it in an @photographer folder, or add "photographer:" for it in photos.yaml or in index.md.',
    );
  }
  if (!photo.date) {
    list.warning(
      'no-date',
      photo.file,
      'This photo has no date: the file has no camera date, and neither photos.yaml nor any index.md above it sets one. ' +
        'Add "date: YYYY-MM-DD" to the event\'s index.md, or to this photo in photos.yaml.',
    );
  }
  const expected = node.expectedDays;
  if (photo.date && photo.sources.date === 'exif' && expected && !isDayWithin(photo.date.day, expected.start, expected.end)) {
    list.warning(
      'date-out-of-range',
      photo.file,
      `The camera date (${formatDate(photo.date)}) is outside this album's dates (${formatDateRange(expected.start, expected.end)}, from ${expected.file}). ` +
        'The camera clock was probably wrong. The camera date is still used; to show the right date, add "date: YYYY-MM-DD" for this photo in photos.yaml.',
    );
  }
}

/** "Node with no cover": nothing visible in the folder or its sub-folders. */
function checkNoCover(node: ModelNode, list: IssueList): void {
  if (node.depth === 0) return;
  if (allModelPhotos(node).some((photo) => !photo.hidden)) return;
  list.warning(
    'no-cover',
    node.source.dir,
    'This album has no visible photos yet, so it has no cover picture and will look empty. Add photos to this folder or its sub-folders.',
  );
}

