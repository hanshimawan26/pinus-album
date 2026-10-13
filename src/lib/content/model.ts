/**
 * Source tree → content model. PURE.
 *
 * Parses every node's index.md and photos.yaml, matches photos.yaml keys to files and
 * resolves each photo's metadata (TRD §4.6). The model keeps everything (draft nodes,
 * hidden photos, parse problems) so validate.ts can report on all of it; tree.ts then
 * derives the published tree from it.
 */
import { toAlbumDate } from '../dates.ts';
import { parseFolderName, photoSlug, titleFromSlug } from '../slug.ts';
import { coverFile, matchPhotoKeys, resolvePhotoMetadata, type AncestorMeta } from './resolve.ts';
import { DEFAULT_INDEX_META, parseIndexMd, parsePhotographersYaml, parsePhotosYaml } from './schemas.ts';
import type {
  ContentModel,
  ImageFormat,
  IndexMeta,
  ModelNode,
  PhotoOverride,
  Photo,
  PhotographerEntry,
  SourceImage,
  SourceNode,
  SourceTree,
} from './types.ts';

interface BuildContext {
  registry: ReadonlyMap<string, PhotographerEntry>;
  timeZone: string;
}

/** Inherited from ancestors while walking down the tree. */
interface Inherited {
  /** index.md values, nearest first. */
  ancestors: readonly AncestorMeta[];
  expectedDays?: ModelNode['expectedDays'];
}

export function buildModel(source: SourceTree, timeZone: string): ContentModel {
  // Invalid entries are reported; the valid ones are still used.
  const parsed = source.photographersYaml ? parsePhotographersYaml(source.photographersYaml.text) : undefined;
  const registry: ReadonlyMap<string, PhotographerEntry> = parsed?.value ?? new Map();
  const photographersProblems = parsed?.problems ?? [];

  const ctx: BuildContext = { registry, timeZone };
  const model: ContentModel = {
    root: buildNode(source.root, 0, { ancestors: [] }, ctx),
    registry,
    photographersProblems,
    totalBytes: source.totalBytes,
    timeZone,
  };
  if (source.photographersYaml) model.photographersFile = source.photographersYaml.file;
  return model;
}

function buildNode(source: SourceNode, depth: number, inherited: Inherited, ctx: BuildContext): ModelNode {
  const isRoot = depth === 0;
  const folder = isRoot ? { slug: '' } : parseFolderName(source.folderName);

  // index.md (the root has none: it is the albums folder itself)
  let meta: IndexMeta = { ...DEFAULT_INDEX_META };
  let story: string | undefined;
  let indexProblems: string[] = [];
  if (source.indexMd && !isRoot) {
    const parsed = parseIndexMd(source.indexMd.text);
    if (parsed.ok) {
      meta = parsed.value.meta;
      story = parsed.value.story;
    } else {
      indexProblems = parsed.problems;
    }
  }

  const title = meta.title ?? (titleFromSlug(folder.slug) || source.folderName);
  const date = meta.date ? toAlbumDate(meta.date, ctx.timeZone) : undefined;
  const endDate = meta.endDate ? toAlbumDate(meta.endDate, ctx.timeZone) : undefined;
  const ancestors: AncestorMeta[] = [{ photographer: meta.photographer, date }, ...inherited.ancestors];
  const expectedDays =
    date && source.indexMd
      ? { start: date.day, end: (endDate ?? date).day, file: source.indexMd.file }
      : inherited.expectedDays;

  // photos.yaml
  const photosYaml = source.photosYaml && !isRoot ? parsePhotosYaml(source.photosYaml.text) : undefined;
  const entries: ReadonlyMap<string, PhotoOverride> = photosYaml?.value ?? new Map();
  const photosYamlProblems = photosYaml?.problems ?? [];
  const keyMatch = matchPhotoKeys(
    entries,
    source.images.map((image) => image.relPath),
    {
      childFolders: source.children.map((child) => child.folderName),
      otherFiles: source.strays.map((stray) => stray.file.slice(source.dir.length + 1)),
    },
  );

  const photos = source.images
    .filter((image) => image.info !== undefined)
    .map((image) =>
      buildPhoto(image, keyMatch.matched.get(image.relPath)?.override, { title, ancestors }, ctx),
    );

  const node: ModelNode = {
    source,
    slug: folder.slug,
    depth,
    title,
    meta,
    indexProblems,
    photosYamlProblems,
    keyMatch,
    photos,
    children: [],
  };
  if (folder.prefix !== undefined) node.prefix = folder.prefix;
  if (story !== undefined) node.story = story;
  if (date) node.date = date;
  if (endDate) node.endDate = endDate;
  if (expectedDays) node.expectedDays = expectedDays;
  const cover = meta.cover === undefined ? undefined : coverFile(source.dir, meta.cover);
  if (cover !== undefined) node.coverFile = cover;
  if (meta.highlights) node.highlightFiles = meta.highlights.map((path) => coverFile(source.dir, path));

  node.children = source.children.map((child) => buildNode(child, depth + 1, { ancestors, expectedDays }, ctx));
  return node;
}

const FORMAT_BY_EXTENSION: Record<string, ImageFormat> = { jpg: 'jpeg', jpeg: 'jpeg', png: 'png', webp: 'webp' };

function buildPhoto(
  image: SourceImage,
  override: PhotoOverride | undefined,
  node: { title: string; ancestors: readonly AncestorMeta[] },
  ctx: BuildContext,
): Photo {
  const info = image.info;
  const resolved = resolvePhotoMetadata({
    override,
    exif: { dateTimeOriginal: info?.exifDateTimeOriginal, offsetTimeOriginal: info?.exifOffsetTimeOriginal },
    folderPhotographer: image.photographerFolder,
    ancestors: node.ancestors,
    nodeTitle: node.title,
    registry: ctx.registry,
    timeZone: ctx.timeZone,
  });
  const extension = image.relPath.slice(image.relPath.lastIndexOf('.') + 1).toLowerCase();
  return {
    slug: photoSlug(image.relPath),
    relPath: image.relPath,
    file: image.file,
    absPath: image.absPath,
    format: FORMAT_BY_EXTENSION[extension] ?? 'jpeg',
    size: image.size,
    width: info?.width ?? 0,
    height: info?.height ?? 0,
    orientation: info?.orientation ?? 1,
    ...resolved,
  };
}
