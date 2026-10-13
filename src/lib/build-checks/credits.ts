/**
 * Which published images may carry metadata, and exactly what. PURE.
 *
 * Every published image is metadata-free (TRD §7, §10) except the viewer images of credited
 * photos: those carry an EXIF block with only Artist and Copyright naming the photo's
 * photographer (credit/credit.ts). `npm run verify:dist` maps every viewer image to the
 * credit its photo's viewer data names and checks each file against it. Since the
 * watermark and the EXIF are written in the same step, a matching EXIF block also shows the
 * watermark pass ran.
 */
import type { CreditFacts } from '../authoring/exif-block.ts';
import { creditFor, type Credit } from '../credit/credit.ts';
import type { MetadataKind } from './image-metadata.ts';
import { inlineJson, srcsetUrls } from './links.ts';

export interface ViewerImageCredit {
  /** An image URL from the viewer data (`src` or a srcset entry). */
  url: string;
  /** The credit the image must carry; undefined for a photo without a photographer. */
  credit?: Credit;
}

/** Every viewer image URL in a page's viewer data, with its expected credit. Throws on invalid JSON. */
export function viewerImageCredits(html: string): ViewerImageCredit[] {
  const result: ViewerImageCredit[] = [];
  for (const data of inlineJson(html)) {
    const photos = data && typeof data === 'object' ? (data as { photos?: unknown }).photos : undefined;
    if (!Array.isArray(photos)) continue;
    for (const photo of photos as Array<{ image?: { src?: unknown; srcset?: unknown }; photographer?: { name?: unknown } }>) {
      const name = photo?.photographer?.name;
      const credit = creditFor(typeof name === 'string' ? name : undefined);
      const image = photo?.image;
      const urls = [
        ...(typeof image?.src === 'string' ? [image.src] : []),
        ...(typeof image?.srcset === 'string' ? srcsetUrls(image.srcset) : []),
      ];
      for (const url of new Set(urls)) result.push(credit ? { url, credit } : { url });
    }
  }
  return result;
}

export interface FoundMetadata {
  /** Metadata blocks found in the file (image-metadata.ts). */
  blocks: readonly MetadataKind[];
  /** The EXIF block's credit tags, when the file has one that could be read. */
  credit?: CreditFacts;
}

/** What is wrong with an image's metadata when it should carry `expected` (or none), or undefined. */
export function creditProblem(expected: Credit | undefined, found: FoundMetadata): string | undefined {
  if (!expected) {
    return found.blocks.length > 0 ? `contains metadata: ${found.blocks.join(', ')}` : undefined;
  }
  const others = found.blocks.filter((block) => block !== 'EXIF');
  if (others.length > 0) return `contains metadata besides the photographer credit: ${others.join(', ')}`;
  if (!found.blocks.includes('EXIF') || !found.credit) return `is missing the photographer credit (${expected.copyright})`;
  if (found.credit.hasOtherTags) return 'has EXIF tags besides the photographer credit (Artist, Copyright)';
  if (found.credit.artist !== expected.artist || found.credit.copyright !== expected.copyright) {
    const actual = found.credit.copyright ?? found.credit.artist ?? 'no name';
    return `credits "${actual}", but the photo's photographer is ${expected.artist}`;
  }
  return undefined;
}
