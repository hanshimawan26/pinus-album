/**
 * `npm run verify:dist` — checks the built site in dist/ (run after `npm run build`):
 *
 *   1. Privacy (TRD §7, §10): no published image carries EXIF, GPS, XMP or IPTC metadata.
 *   2. Privacy: no file in dist/ is a byte-for-byte copy of a source photo in src/albums/
 *      (sources keep their EXIF/GPS data).
 *   3. Links (TRD §12.3): every internal href/src/srcset (including the viewer's JSON data
 *      and inline stylesheet url()s) points to a file that exists under the configured base path.
 *   4. Image sizes (TRD §12.3): every published image is as wide as its srcset descriptor says
 *      and has the aspect ratio the page declares, so portrait photos are upright.
 *   5. Published content (TRD §4.3, §4.4): there is a page for every published album and none
 *      for a draft, each page's viewer data lists exactly the album's visible photos (no
 *      hidden ones), and every image in _astro/ is used by a page, so nothing derived from an
 *      unpublished photo is left behind.
 *
 * Use the same BASE_PATH as the build. Exit code 1 if anything fails.
 * Runs directly with Node's type stripping: `node scripts/verify-dist.ts`.
 */
import exifr from 'exifr';
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ALBUMS_DIR, BASE_PATH } from '../src/lib/config.ts';
import { loadAlbums } from '../src/lib/content/index.ts';
import { findSourceCopies, listFiles, relativePosix } from '../src/lib/build-checks/files.ts';
import { scanImageMetadata } from '../src/lib/build-checks/image-metadata.ts';
import { dimensionProblem, extractImageClaims, type ImageClaim } from '../src/lib/build-checks/image-claims.ts';
import { extractCssReferences, extractHtmlReferences, resolveReference, sitePathOf, type Reference } from '../src/lib/build-checks/links.ts';
import { albumPathOf, comparePublished, viewerPhotoSlugs, type BuiltAlbumPage } from '../src/lib/build-checks/published.ts';
import { bold, dim, green, red, runCli } from './cli.ts';

const DIST_DIR = resolve('dist');
const IMAGE_PATTERN = /\.(jpe?g|png|webp|gif|avif|tiff?|heic|heif)$/i;
/** Formats exifr can parse; WebP is covered by the structural scan only. */
const EXIFR_PATTERN = /\.(jpe?g|png|tiff?|heic|heif|avif)$/i;


interface Failure {
  file: string;
  message: string;
}

async function checkImageMetadata(files: readonly string[]): Promise<{ checked: number; failures: Failure[] }> {
  const failures: Failure[] = [];
  const images = files.filter((file) => IMAGE_PATTERN.test(file));
  for (const file of images) {
    const bytes = await readFile(file);
    const found = new Set<string>(scanImageMetadata(bytes).blocks);
    if (EXIFR_PATTERN.test(file)) {
      const parsed = await exifr
        .parse(bytes, { tiff: true, exif: true, gps: true, xmp: true, iptc: true, icc: false, jfif: false, ihdr: false })
        .catch(() => undefined);
      if (parsed && Object.keys(parsed).length > 0) found.add('EXIF/XMP/IPTC tags (exifr)');
      const gps = await exifr.gps(bytes).catch(() => undefined);
      if (gps) found.add('GPS position');
    }
    if (found.size > 0) {
      failures.push({ file: relativePosix(DIST_DIR, file), message: `contains metadata: ${[...found].join(', ')}` });
    }
  }
  return { checked: images.length, failures };
}

async function checkSourceCopies(): Promise<Failure[]> {
  const copies = await findSourceCopies(DIST_DIR, resolve(ALBUMS_DIR));
  return copies.map((copy) => ({
    file: relativePosix(DIST_DIR, copy.distFile),
    message: `is an exact copy of the original ${relativePosix(process.cwd(), copy.sourceFile)} (originals keep EXIF/GPS data)`,
  }));
}

/** Also returns every file in dist/ that some page or stylesheet refers to (dist-relative). */
async function checkLinks(files: readonly string[]): Promise<{ checked: number; failures: Failure[]; referenced: Set<string> }> {
  const failures: Failure[] = [];
  const referenced = new Set<string>();
  let checked = 0;
  for (const file of files) {
    const isHtml = file.endsWith('.html');
    if (!isHtml && !file.endsWith('.css')) continue;
    const distRelative = relativePosix(DIST_DIR, file);
    const text = await readFile(file, 'utf8');
    let references: Reference[];
    try {
      references = isHtml ? extractHtmlReferences(text) : extractCssReferences(text);
    } catch (error) {
      failures.push({ file: distRelative, message: `could not read the page's inline JSON: ${String(error)}` });
      continue;
    }
    // A stylesheet's relative url()s resolve against the stylesheet itself.
    const fromSitePath = isHtml ? sitePathOf(distRelative, BASE_PATH) : `${BASE_PATH}${distRelative}`;
    for (const reference of references) {
      const resolution = resolveReference(reference.url, fromSitePath, BASE_PATH);
      if (resolution.kind === 'skip') continue;
      checked++;
      if (resolution.kind === 'error') {
        failures.push({ file: distRelative, message: `${reference.source} "${reference.url}" ${resolution.reason}` });
      } else {
        const found = resolution.candidates.find((candidate) => existsSync(join(DIST_DIR, candidate)));
        if (found === undefined) {
          failures.push({ file: distRelative, message: `${reference.source} "${reference.url}" is broken: no such file in dist/` });
        } else {
          referenced.add(found);
        }
      }
    }
  }
  return { checked, failures, referenced };
}

/** Album pages match the published albums exactly (no drafts, no hidden photos). */
async function checkPublishedContent(files: readonly string[]): Promise<{ checked: number; failures: Failure[] }> {
  const albums = await loadAlbums({ includeDrafts: false });
  const expected = [...albums.nodes.values()]
    .filter((node) => node.depth > 0)
    .map((node) => ({ path: node.slugPath.join('/'), photoSlugs: node.photos.map((photo) => photo.slug) }));
  const built: BuiltAlbumPage[] = [];
  const failures: Failure[] = [];
  for (const file of files) {
    const path = albumPathOf(relativePosix(DIST_DIR, file));
    if (path === undefined) continue;
    try {
      built.push({ path, photoSlugs: viewerPhotoSlugs(await readFile(file, 'utf8')) });
    } catch {
      built.push({ path, photoSlugs: [] }); // invalid JSON is reported by the link check
    }
  }
  for (const problem of comparePublished(expected, built)) {
    failures.push({ file: `albums/${problem.path}/`, message: problem.message });
  }
  return { checked: expected.length, failures };
}

/** Images Astro generated that no page uses: leftovers of hidden or draft photos. */
function checkUnusedImages(files: readonly string[], referenced: ReadonlySet<string>): Failure[] {
  return files
    .map((file) => relativePosix(DIST_DIR, file))
    .filter((file) => file.startsWith('_astro/') && IMAGE_PATTERN.test(file) && !referenced.has(file))
    .map((file) => ({ file, message: 'is not used by any page (left over from a hidden or draft photo?)' }));
}

async function checkImageDimensions(files: readonly string[]): Promise<{ checked: number; failures: Failure[] }> {
  const failures: Failure[] = [];
  const sizes = new Map<string, Promise<{ width: number; height: number } | undefined>>();
  const sizeOf = (file: string) => {
    let size = sizes.get(file);
    if (!size) {
      size = sharp(file)
        .metadata()
        .then(({ autoOrient }) => autoOrient)
        .catch(() => undefined);
      sizes.set(file, size);
    }
    return size;
  };
  let checked = 0;
  for (const file of files) {
    if (!file.endsWith('.html')) continue;
    const distRelative = relativePosix(DIST_DIR, file);
    let claims: ImageClaim[];
    try {
      claims = extractImageClaims(await readFile(file, 'utf8'));
    } catch {
      continue; // Invalid inline JSON is reported by the link check.
    }
    const fromSitePath = sitePathOf(distRelative, BASE_PATH);
    for (const claim of claims) {
      const resolution = resolveReference(claim.url, fromSitePath, BASE_PATH);
      if (resolution.kind !== 'internal') continue; // External, or reported by the link check.
      const image = resolution.candidates.map((candidate) => join(DIST_DIR, candidate)).find((path) => existsSync(path));
      if (!image) continue; // Broken links are reported by the link check.
      checked++;
      const actual = await sizeOf(image);
      const problem = actual ? dimensionProblem(claim, actual) : 'could not be read as an image';
      if (problem) failures.push({ file: distRelative, message: `${claim.source} image "${claim.url}" ${problem}` });
    }
  }
  return { checked, failures };
}

function printFailures(title: string, failures: readonly Failure[]): void {
  if (failures.length === 0) return;
  console.log(bold(red(`${title} (${failures.length})`)));
  const shown = failures.slice(0, 50);
  for (const failure of shown) console.log(`  ${red('✗')} ${bold(failure.file)} ${failure.message}`);
  if (failures.length > shown.length) console.log(dim(`  … and ${failures.length - shown.length} more`));
  console.log('');
}

async function main(): Promise<number> {
  if (!existsSync(join(DIST_DIR, 'index.html'))) {
    console.log(red('dist/index.html not found. Run "npm run build" first.'));
    return 1;
  }
  console.log(bold(`verify:dist — dist/ built for base path "${BASE_PATH}"\n`));
  const files = await listFiles(DIST_DIR);

  const metadata = await checkImageMetadata(files);
  const copies = await checkSourceCopies();
  const links = await checkLinks(files);
  const dimensions = await checkImageDimensions(files);
  const published = await checkPublishedContent(files);
  const unused = checkUnusedImages(files, links.referenced);

  printFailures('Images with metadata', metadata.failures);
  printFailures('Copies of original photos', copies);
  printFailures('Broken or misplaced links', links.failures);
  printFailures('Images whose size does not match the page', dimensions.failures);
  printFailures('Album pages that do not match the published albums', published.failures);
  printFailures('Images no page uses', unused);

  const failed =
    metadata.failures.length + copies.length + links.failures.length + dimensions.failures.length + published.failures.length + unused.length;
  if (links.failures.some((failure) => failure.message.includes('outside the site'))) {
    console.log(dim(`Hint: run verify:dist with the same BASE_PATH as the build (now "${BASE_PATH}").\n`));
  }
  const summary =
    `${metadata.checked} images checked for metadata, ${files.length} files checked for copies of originals, ` +
    `${links.checked} internal links checked, ${dimensions.checked} image sizes checked, ` +
    `${published.checked} published albums compared with their pages.`;
  if (failed > 0) {
    console.log(red(bold(`✗ ${failed} problem${failed === 1 ? '' : 's'}. ${summary}`)));
    return 1;
  }
  console.log(green(bold(`✓ No problems. ${summary}`)));
  return 0;
}

runCli('verify:dist', main);
