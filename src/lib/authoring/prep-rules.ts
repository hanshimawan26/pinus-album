/**
 * What photos:prep does to one JPEG (TRD §7 source-image limits, §9). PURE.
 *
 * Masters committed to the repository are "web-ready": long edge at most 2400 px, JPEG
 * quality about 85, ideally under 1 MB, and no metadata beyond the few kept tags
 * (exif-block.ts). The rules are chosen so a second run never changes a file again:
 *
 * 1. **resize**: long edge over 2400 px → scale down to 2400 px, re-encode at quality 85.
 * 2. **recompress**: within 2400 px but over 1 MB, and not written by photos:prep before →
 *    re-encode at quality 85, but only keep the result when it is at least 10% smaller.
 *    The marker photos:prep writes means a prepared file is never re-encoded twice.
 * 3. **strip**: otherwise, if the file carries more than the kept metadata → rewrite it
 *    without that metadata, **without re-encoding** (the pixels are untouched).
 * 4. **none**: the file is already web-ready and is left alone (not even rewritten).
 */

export const PREP_LIMITS = {
  /** TRD §7: long edge ≤ 2400 px. */
  maxLongEdge: 2400,
  /** TRD §7: JPEG quality about 85 (mozjpeg). */
  jpegQuality: 85,
  /** TRD §7: "ideally under 1 MB each". Bigger files are re-encoded once. */
  recompressAboveBytes: 1024 * 1024,
  /** A re-encode is only kept when it saves at least this share of the file size. */
  minSaving: 0.1,
} as const;

export type PrepAction = 'resize' | 'recompress' | 'strip' | 'none';

export interface JpegFacts {
  /** Stored pixel size (before EXIF orientation). */
  width: number;
  height: number;
  bytes: number;
  /** Written by photos:prep before (the marker is present). */
  prepared: boolean;
  /** The file has exactly the kept metadata already (rewriting it would give the same bytes). */
  metadataClean: boolean;
}

/** The first action that applies, in the order above. */
export function planJpeg(facts: JpegFacts): PrepAction {
  if (Math.max(facts.width, facts.height) > PREP_LIMITS.maxLongEdge) return 'resize';
  if (facts.bytes > PREP_LIMITS.recompressAboveBytes && !facts.prepared) return 'recompress';
  if (!facts.metadataClean) return 'strip';
  return 'none';
}

/** Is a re-encoded file small enough, compared with the original, to be worth keeping? */
export const recompressionPays = (beforeBytes: number, afterBytes: number): boolean =>
  afterBytes <= beforeBytes * (1 - PREP_LIMITS.minSaving);

/** PNG and WebP files are left alone; this says whether to warn that one is too big. */
export function isOversize(width: number, height: number, bytes: number, maxBytes: number): boolean {
  return Math.max(width, height) > PREP_LIMITS.maxLongEdge || bytes > maxBytes;
}
