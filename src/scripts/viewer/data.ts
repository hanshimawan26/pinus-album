/**
 * Reads the viewer data that the album page embeds as JSON (`#viewer-data`, built by
 * `src/lib/viewer-data.ts`). PURE: text in, data out.
 *
 * The data is generated at build time, so this is a guard rather than a parser of user
 * input: if the shape is wrong (an old cached page, a broken build), the viewer stays off
 * and the grid still shows its photos. Photos are never dropped one by one, because
 * `photos[i]` must stay aligned with the tile whose `data-index` is `i`.
 */
import type { ViewerData, ViewerPhoto } from '../../lib/viewer-data.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';
const isSize = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const optional = (value: unknown, check: (value: unknown) => boolean): boolean => value === undefined || check(value);

/** Only Instagram profile links over https are ever rendered as a link (TRD §10). */
export function isInstagramUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._]+\/?$/.test(value);
}

function isPhoto(value: unknown): value is ViewerPhoto {
  if (!isRecord(value) || !isText(value.slug) || typeof value.alt !== 'string') return false;
  const { image, photographer, date } = value;
  if (!isRecord(image) || !isText(image.src) || typeof image.srcset !== 'string' || typeof image.sizes !== 'string') return false;
  if (!isSize(image.width) || !isSize(image.height)) return false;
  if (!optional(value.caption, isText)) return false;
  if (!optional(value.context, isText)) return false;
  if (photographer !== undefined) {
    if (!isRecord(photographer) || !isText(photographer.name)) return false;
    if (!optional(photographer.instagramUrl, isInstagramUrl)) return false;
  }
  if (date !== undefined && (!isRecord(date) || !isText(date.label) || !isText(date.iso))) return false;
  return true;
}

/** The viewer data in `json`, or `null` when it is missing or not shaped as expected. */
export function parseViewerData(json: string | null | undefined): ViewerData | null {
  if (!json) return null;
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isRecord(value) || typeof value.context !== 'string' || !Array.isArray(value.photos)) return null;
  if (value.photos.length === 0 || !value.photos.every(isPhoto)) return null;
  return { context: value.context, photos: value.photos };
}
