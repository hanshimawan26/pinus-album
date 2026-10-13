/**
 * Image dimension claims of the built site. PURE: HTML text in, claims out; claim and
 * measured size in, problem out. `npm run verify:dist` reads the real image sizes.
 *
 * A page tells the browser how big each image file is: `<img width height>` describes
 * `src`, and a srcset `800w` descriptor says that file is 800 px wide (with the same aspect
 * ratio). The viewer JSON does the same with `{ src, srcset, width, height }`, and the link
 * preview tags with `og:image`, `og:image:width` and `og:image:height`. Comparing
 * these claims with the published files proves that every derivative is upright (TRD §12.3:
 * portrait phone photos display upright) and that the srcset descriptors are exact.
 */
import { decodeEntities, inlineJson, markupOnly, metaProperties, parseSrcset } from './links.ts';

export interface ImageClaim {
  /** Where the claim came from: `img` or `json`. */
  source: string;
  url: string;
  /** Claimed pixel width of the file. */
  width: number;
  /** Claimed pixel height, when the page states an aspect ratio. */
  height?: number;
}

const IMG_TAGS = /<img\b[^>]*>/gi;
const ATTRIBUTE = /\s([a-z][a-z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;

function attributesOf(tag: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const match of tag.matchAll(ATTRIBUTE)) {
    attributes.set((match[1] ?? '').toLowerCase(), decodeEntities(match[2] ?? match[3] ?? match[4] ?? ''));
  }
  return attributes;
}

const positiveNumber = (value: unknown): number | undefined => {
  const number = typeof value === 'string' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) && number > 0 ? number : undefined;
};

/**
 * Claims of one image: `src` is `width`×`height`; each `Nw` srcset candidate is N px wide
 * with the same aspect ratio. Without a stated size, only the `w` descriptors are claims.
 */
function claimsOf(source: string, src: string | undefined, srcset: string | undefined, width?: number, height?: number): ImageClaim[] {
  const claims: ImageClaim[] = [];
  if (src && width !== undefined && height !== undefined) claims.push({ source, url: src, width, height });
  for (const candidate of parseSrcset(srcset ?? '')) {
    if (candidate.width === undefined) continue;
    const claim: ImageClaim = { source, url: candidate.url, width: candidate.width };
    if (width !== undefined && height !== undefined) claim.height = Math.round((candidate.width * height) / width);
    claims.push(claim);
  }
  return claims;
}

/** Every image size a page claims, from `<img>` tags and from the inline JSON (viewer data). */
export function extractImageClaims(html: string): ImageClaim[] {
  const claims: ImageClaim[] = [];
  for (const [tag] of markupOnly(html).matchAll(IMG_TAGS)) {
    const attributes = attributesOf(tag);
    claims.push(
      ...claimsOf(
        'img',
        attributes.get('src'),
        attributes.get('srcset'),
        positiveNumber(attributes.get('width')),
        positiveNumber(attributes.get('height')),
      ),
    );
  }
  for (const json of inlineJson(html)) collectJsonClaims(json, claims);
  claims.push(...previewImageClaims(html));
  return claims;
}

/** The link preview image: `og:image` is `og:image:width` × `og:image:height`. */
function previewImageClaims(html: string): ImageClaim[] {
  const meta = new Map(metaProperties(html).map(({ property, content }) => [property, content]));
  const url = meta.get('og:image');
  const width = positiveNumber(meta.get('og:image:width'));
  const height = positiveNumber(meta.get('og:image:height'));
  return url && width !== undefined && height !== undefined ? [{ source: 'og:image', url, width, height }] : [];
}

function collectJsonClaims(value: unknown, claims: ImageClaim[]): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonClaims(item, claims));
    return;
  }
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  const src = typeof record.src === 'string' ? record.src : undefined;
  const srcset = typeof record.srcset === 'string' ? record.srcset : undefined;
  if (src !== undefined || srcset !== undefined) {
    claims.push(...claimsOf('json', src, srcset, positiveNumber(record.width), positiveNumber(record.height)));
  }
  for (const item of Object.values(record)) collectJsonClaims(item, claims);
}

/** An SVG scales to any size, so only its aspect ratio can be wrong (within 2%). */
const VECTOR_RATIO_TOLERANCE = 0.02;
const isVector = (url: string) => /\.svg$/i.test(url.replace(/[?#].*$/, ''));

/**
 * What is wrong when a file measuring `actual` is published under `claim`, or undefined.
 * The width must match exactly; the height may differ by 1 px of rounding. A file whose
 * sides are swapped is reported as sideways (an EXIF orientation that was not applied).
 * An SVG (the logo) is drawn at whatever size the page asks for, so for it only a
 * stretched aspect ratio is a problem.
 */
export function dimensionProblem(claim: ImageClaim, actual: { width: number; height: number }): string | undefined {
  if (isVector(claim.url)) {
    if (claim.height === undefined) return undefined;
    const claimedRatio = claim.width / claim.height;
    const actualRatio = actual.width / actual.height;
    if (Math.abs(actualRatio / claimedRatio - 1) <= VECTOR_RATIO_TOLERANCE) return undefined;
    return `is a ${actual.width}×${actual.height} drawing but the page shows it at ${claim.width}×${claim.height}, so it is stretched`;
  }
  const claimed = claim.height === undefined ? `${claim.width} px wide` : `${claim.width}×${claim.height}`;
  const widthMatches = actual.width === claim.width;
  const heightMatches = claim.height === undefined || Math.abs(actual.height - claim.height) <= 1;
  if (widthMatches && heightMatches) return undefined;
  const sideways =
    claim.height !== undefined &&
    claim.height !== claim.width &&
    Math.abs(actual.width - claim.height) <= 1 &&
    Math.abs(actual.height - claim.width) <= 1;
  return `is ${actual.width}×${actual.height} but the page says ${claimed}${sideways ? ' (the image is sideways)' : ''}`;
}
