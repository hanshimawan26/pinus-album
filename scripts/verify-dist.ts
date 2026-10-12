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
import { findSourceCopies, listFiles, relativePosix } from '../src/lib/build-checks/files.ts';
import { scanImageMetadata } from '../src/lib/build-checks/image-metadata.ts';
import { dimensionProblem, extractImageClaims, type ImageClaim } from '../src/lib/build-checks/image-claims.ts';
import { extractCssReferences, extractHtmlReferences, resolveReference, sitePathOf, type Reference } from '../src/lib/build-checks/links.ts';
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

async function checkLinks(files: readonly string[]): Promise<{ checked: number; failures: Failure[] }> {
  const failures: Failure[] = [];
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
      } else if (!resolution.candidates.some((candidate) => existsSync(join(DIST_DIR, candidate)))) {
        failures.push({ file: distRelative, message: `${reference.source} "${reference.url}" is broken: no such file in dist/` });
      }
    }
  }
  return { checked, failures };
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

  printFailures('Images with metadata', metadata.failures);
  printFailures('Copies of original photos', copies);
  printFailures('Broken or misplaced links', links.failures);
  printFailures('Images whose size does not match the page', dimensions.failures);

  const failed = metadata.failures.length + copies.length + links.failures.length + dimensions.failures.length;
  if (links.failures.some((failure) => failure.message.includes('outside the site'))) {
    console.log(dim(`Hint: run verify:dist with the same BASE_PATH as the build (now "${BASE_PATH}").\n`));
  }
  const summary =
    `${metadata.checked} images checked for metadata, ${files.length} files checked for copies of originals, ` +
    `${links.checked} internal links checked, ${dimensions.checked} image sizes checked.`;
  if (failed > 0) {
    console.log(red(bold(`✗ ${failed} problem${failed === 1 ? '' : 's'}. ${summary}`)));
    return 1;
  }
  console.log(green(bold(`✓ No problems. ${summary}`)));
  return 0;
}

runCli('verify:dist', main);
