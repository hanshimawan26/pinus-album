/**
 * Domain types of the content engine. The pipeline is:
 *
 *   scan.ts + exif.ts (filesystem)  →  SourceTree
 *   model.ts (pure)                 →  ContentModel   every node and photo, metadata resolved
 *   tree.ts (pure)                  →  AlbumNode       the published tree (drafts, order, counts)
 *   validate.ts (pure)              →  Issue[]         TRD §4.8
 *
 * All file paths in these types are repo-relative POSIX paths (`src/albums/x/IMG_1.jpg`)
 * unless the name says `absPath`.
 */
import type { AlbumDate, LocalDateTime } from '../dates.ts';

// ---------------------------------------------------------------------------------------
// Source: what is on disk (produced by scan.ts, image facts filled in by exif.ts)
// ---------------------------------------------------------------------------------------

/** A small text file read from disk. */
export interface SourceText {
  file: string;
  text: string;
}

/** Facts read from an image file at build time (exif.ts). */
export interface ImageInfo {
  /** Format detected from the file contents by sharp: `jpeg`, `png`, `webp`, `heif`, … */
  format: string;
  /** Upright pixel size: width and height are swapped for EXIF orientations 5–8. */
  width: number;
  height: number;
  /** EXIF orientation, 1–8 (1 when absent). */
  orientation: number;
  /** Raw EXIF `DateTimeOriginal`, e.g. `2026:09:20 18:30:00` (no zone). */
  exifDateTimeOriginal?: string;
  /** Raw EXIF `OffsetTimeOriginal`, e.g. `+08:00`. */
  exifOffsetTimeOriginal?: string;
  /** The EXIF data includes a GPS position (the master file reveals where it was taken). */
  hasGps?: boolean;
}

/** A supported image file inside a node, directly or in an `@photographer` folder. */
export interface SourceImage {
  /** Path relative to the node folder: `@andi/IMG_1.jpg` or `IMG_1.jpg`. */
  relPath: string;
  file: string;
  absPath: string;
  size: number;
  mtimeMs: number;
  /** Photographer slug from the `@folder` the image sits in, if any. */
  photographerFolder?: string;
  /** Filled in by exif.ts; undefined if the file could not be read (see `readError`). */
  info?: ImageInfo;
  readError?: string;
}

/** Files and folders that are not part of the content model but must be reported. */
export type StrayKind =
  /** `.heic` / `.heif` */
  | 'heic'
  /** Any other image-like file that the site cannot show (`.gif`, `.tiff`, raw files, …). */
  | 'unsupported-image'
  /** Video files: not shown on the site (video is a non-goal). */
  | 'video'
  /** `photos.yml`, `Index.md`, `photos.yaml.txt`, … : a metadata file with a near-miss name, so it is not read. */
  | 'misnamed-metadata'
  /** index.md, photos.yaml (or a near miss) inside an `@photographer` folder, where it is not read. */
  | 'metadata-in-photographer-folder'
  /** index.md or photos.yaml (or a near miss) directly in `src/albums`, where it is not read. */
  | 'metadata-in-albums-folder'
  /** photographers.yaml (or a near miss) inside an event or section; it is only read in `src/albums`. */
  | 'photographers-yaml-in-node'
  /** A folder inside an `@photographer` folder (photographer folders hold photos only). */
  | 'nested-in-photographer-folder'
  /** A photo or `@photographer` folder directly in `src/albums`, outside any event. */
  | 'outside-event'
  /** A folder named just `@` (no photographer slug). */
  | 'invalid-photographer-folder';

export interface SourceStray {
  kind: StrayKind;
  /** File or folder path. */
  file: string;
}

/** A node folder (event, section, sub-section) as found on disk. */
export interface SourceNode {
  folderName: string;
  dir: string;
  indexMd?: SourceText;
  photosYaml?: SourceText;
  images: SourceImage[];
  strays: SourceStray[];
  children: SourceNode[];
}

export interface SourceTree {
  /** The albums folder itself: a virtual root whose children are the events. */
  root: SourceNode;
  photographersYaml?: SourceText;
  /** Total bytes of all files under the albums folder. */
  totalBytes: number;
}

// ---------------------------------------------------------------------------------------
// Parsed metadata files (schemas.ts)
// ---------------------------------------------------------------------------------------

export type PhotoSort = 'date' | 'filename';

/** `index.md` frontmatter after validation. Dates are zone-free calendar dates. */
export interface IndexMeta {
  title?: string;
  date?: LocalDateTime;
  endDate?: LocalDateTime;
  /** Where the event took place, e.g. "UTown Green". Shown on the album page. */
  venue?: string;
  cover?: string;
  /** Photos for the home page, best first (paths relative to this folder, like `cover`). */
  highlights?: string[];
  /** Pins an event to the home page hero (events only; the newest event otherwise). */
  featured?: boolean;
  /** Photographer slug. */
  photographer?: string;
  order?: number;
  /** Shown in `npm run dev` only, never published. */
  draft: boolean;
  /** Not shown anywhere (dev included) unless SHOW_HIDDEN is set. */
  hidden: boolean;
  sort: PhotoSort;
}

/** One `photos.yaml` entry after validation. */
export interface PhotoOverride {
  caption?: string;
  /** Calendar date, or date and time, in TIMEZONE. */
  date?: LocalDateTime;
  /** Photographer slug. */
  photographer?: string;
  alt?: string;
  hidden?: boolean;
}

/** One `photographers.yaml` entry after validation. */
export interface PhotographerEntry {
  name?: string;
  /** Normalised handle without `@` or URL. */
  instagram?: string;
}

// ---------------------------------------------------------------------------------------
// Domain
// ---------------------------------------------------------------------------------------

export interface Photographer {
  slug: string;
  /** From photographers.yaml, else the slug title-cased. */
  name: string;
  /** Avatar initials, e.g. `AP`. */
  initials: string;
  instagram?: string;
  instagramUrl?: string;
  /** True if the slug is listed in photographers.yaml. */
  listed: boolean;
}

export type ImageFormat = 'jpeg' | 'png' | 'webp';
export type CaptionSource = 'photos.yaml' | 'embedded';
export type PhotographerSource = 'photos.yaml' | 'folder' | 'index.md' | 'embedded';
export type DateSource = 'photos.yaml' | 'exif' | 'index.md';
export type AltSource = 'photos.yaml' | 'caption' | 'generated';

export interface Photo {
  /** Stable deep-link slug, unique within its node (TRD §4.7). */
  slug: string;
  /** Path relative to the node folder. */
  relPath: string;
  file: string;
  absPath: string;
  /** Format from the file extension. */
  format: ImageFormat;
  size: number;
  /** Upright pixel size (0 if the file could not be read). */
  width: number;
  height: number;
  orientation: number;
  caption?: string;
  photographer?: Photographer;
  date?: AlbumDate;
  alt: string;
  hidden: boolean;
  /** Where each value came from (TRD §4.6); used by validation and tests. */
  sources: {
    caption?: CaptionSource;
    photographer?: PhotographerSource;
    date?: DateSource;
    alt: AltSource;
  };
}

/** A node of the content model: every node (drafts included) with every photo (hidden included). */
export interface ModelNode {
  source: SourceNode;
  /** URL slug (numeric prefix removed). Empty for the root. */
  slug: string;
  prefix?: number;
  depth: number;
  title: string;
  /** Validated frontmatter (defaults when index.md is absent or invalid). */
  meta: IndexMeta;
  /** Markdown story after the frontmatter; undefined when empty. */
  story?: string;
  /** Dates from this node's own index.md. */
  date?: AlbumDate;
  endDate?: AlbumDate;
  /**
   * Calendar days that EXIF dates of this node's photos should fall in: this node's own
   * index.md date/endDate, else the nearest ancestor's. Undefined when no ancestor sets a date.
   */
  expectedDays?: { start: string; end: string; file: string };
  /**
   * Repo-relative path that index.md `cover:` points to (resolved once, here, for both
   * tree.ts and validate.ts). Undefined when there is no `cover:` or it leaves the folder.
   */
  coverFile?: string;
  /**
   * Repo-relative paths that index.md `highlights:` point to, one per entry (undefined for an
   * entry that leaves the folder). Undefined when there is no `highlights:`.
   */
  highlightFiles?: (string | undefined)[];
  /** Problems found in index.md (invalid YAML or frontmatter). */
  indexProblems: string[];
  /** Problems found in photos.yaml (invalid YAML or entries). */
  photosYamlProblems: string[];
  keyMatch: KeyMatchResult;
  /** All readable photos of this node, hidden ones included, in scan order. */
  photos: Photo[];
  children: ModelNode[];
}

export interface ContentModel {
  root: ModelNode;
  /** Listed photographers, by slug. */
  registry: ReadonlyMap<string, PhotographerEntry>;
  photographersProblems: string[];
  photographersFile?: string;
  totalBytes: number;
  timeZone: string;
}

/** Result of matching photos.yaml keys to the photos of a node. */
export interface KeyMatchResult {
  /** relPath → the entry that describes it. */
  matched: Map<string, { key: string; override: PhotoOverride }>;
  /** Keys that match no photo. `suggestion` is a near miss (letter case or sub-folder). */
  unmatched: { key: string; suggestion?: string; reason?: 'case' | 'child-folder' }[];
  /** Bare file names that match more than one photo. */
  ambiguous: { key: string; candidates: string[] }[];
  /** Photos described by more than one key. */
  duplicates: { relPath: string; keys: string[] }[];
}

/** A node of the published tree. */
export interface AlbumNode {
  /** URL segment; empty for the root. */
  slug: string;
  /** Slugs from the event down to this node; empty for the root. */
  slugPath: string[];
  folderName: string;
  dir: string;
  /** 0 = root, 1 = event, 2 = section, … */
  depth: number;
  title: string;
  /**
   * From index.md, else derived: the earliest photos.yaml/EXIF date of this node's own photos
   * and its children's dates (dates inherited from an ancestor's index.md are not used).
   */
  date?: AlbumDate;
  endDate?: AlbumDate;
  dateSource?: 'index.md' | 'photos';
  venue?: string;
  story?: string;
  draft: boolean;
  /** True only while previewing with SHOW_HIDDEN (hidden nodes are otherwise left out). */
  hidden: boolean;
  order?: number;
  prefix?: number;
  sort: PhotoSort;
  /** Visible photos of this node itself, in display order. */
  photos: Photo[];
  /** Published child nodes, in display order. */
  children: AlbumNode[];
  /** Visible photos in this node and all published descendants. */
  photoCount: number;
  /** Number of published direct children. */
  sectionCount: number;
  cover?: Photo;
  /**
   * index.md `highlights:` that are shown (visible photos in published albums), in the listed
   * order, without repeats. Empty when there is no list: the home page then picks photos
   * itself (landing.ts).
   */
  highlights: Photo[];
  /** index.md `featured: true` (pins an event to the home page hero). */
  featured: boolean;
}

// ---------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------

export type IssueLevel = 'error' | 'warning';

export type IssueCode =
  // errors
  | 'invalid-index-md'
  | 'invalid-photos-yaml'
  | 'invalid-photographers-yaml'
  | 'photos-yaml-no-match'
  | 'photos-yaml-ambiguous'
  | 'photos-yaml-duplicate'
  | 'duplicate-photo-slug'
  | 'duplicate-node-slug'
  | 'reserved-folder-name'
  | 'invalid-folder-name'
  | 'unsupported-format'
  | 'unreadable-image'
  | 'missing-cover'
  | 'missing-highlight'
  | 'misplaced-file'
  | 'misnamed-file'
  | 'invalid-file-name'
  // warnings
  | 'no-photographer'
  | 'no-date'
  | 'date-out-of-range'
  | 'large-image'
  | 'no-cover'
  | 'cover-not-shown'
  | 'highlight-not-shown'
  | 'featured-ignored'
  | 'location-in-photo'
  | 'content-too-large'
  | 'ignored-file';

export interface Issue {
  level: IssueLevel;
  code: IssueCode;
  /** Repo-relative POSIX path of the file or folder to fix. */
  file: string;
  /** Plain English, actionable for a non-developer. */
  message: string;
}
