/**
 * `npm run verify:dist` — checks the built site in dist/ (run after `npm run build`):
 *
 *   1. Privacy (TRD §7, §10): no published image carries EXIF, GPS, XMP or IPTC metadata,
 *      except the viewer images of credited photos, which carry exactly their photographer's
 *      credit (EXIF Artist and Copyright, nothing else; see src/lib/credit/).
 *   2. Privacy: no file in dist/ is a byte-for-byte copy of a source photo in src/albums/
 *      (sources keep their EXIF/GPS data).
 *   3. Links (TRD §12.3): every internal href/src/srcset (including the viewer's JSON data
 *      and inline stylesheet url()s) points to a file that exists under the configured base path.
 *   4. Image sizes (TRD §12.3): every published image is as wide as its srcset descriptor says
 *      and has the aspect ratio the page declares, so portrait photos are upright.
 *   5. Published content (TRD §4.3, §4.4): there is a page for every published album and none
 *      for a draft or a hidden album, each page's viewer data lists exactly the album's
 *      visible photos (no
 *      hidden ones), and every image in _astro/ is used by a page, so nothing derived from an
 *      unpublished photo is left behind.
 *   6. Page rules (TRD §10, §11): every page has the robots meta that ALLOW_INDEXING asks for
 *      (noindex by default) and the footer's takedown line linking to CONTACT_EMAIL; only
 *      pages with photos load JavaScript, and no page loads more than 60 KB gzipped.
 *   7. Link previews: every page but the 404 has the Open Graph tags, `og:url` is the page's
 *      own address, the preview URLs are absolute on SITE_URL (checked with the links and
 *      image sizes above) and the preview image stays under 300 KB.
 *
 * Use the same BASE_PATH, SITE_URL, ALLOW_INDEXING, CONTACT_EMAIL and SHOW_HIDDEN as the build. Exit code 1 if anything fails.
 * Runs directly with Node's type stripping: `node scripts/verify-dist.ts`.
 */
import exifr from 'exifr';
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { ALBUMS_DIR, ALLOW_INDEXING, BASE_PATH, SITE, SITE_URL } from '../src/lib/config.ts';
import { loadAlbums, siteLoadOptions } from '../src/lib/content/index.ts';
import { findSourceCopies, listFiles, relativePosix } from '../src/lib/build-checks/files.ts';
import { readCredit } from '../src/lib/authoring/exif-block.ts';
import { creditProblem, viewerImageCredits } from '../src/lib/build-checks/credits.ts';
import { scanImageMetadata } from '../src/lib/build-checks/image-metadata.ts';
import type { Credit } from '../src/lib/credit/credit.ts';
import { webpExif } from '../src/lib/credit/webp-exif.ts';
import { dimensionProblem, extractImageClaims, type ImageClaim } from '../src/lib/build-checks/image-claims.ts';
import { absoluteUrlProblem, extractCssReferences, extractHtmlReferences, metaProperties, resolveReference, sitePathOf, type Reference } from '../src/lib/build-checks/links.ts';
import { extractScripts, JS_BUDGET_GZIP_BYTES, kilobytes, pageProblems, previewImageSizeProblem, previewProblems, scriptBudgetProblem } from '../src/lib/build-checks/page-rules.ts';
import { albumPathOf, comparePublished, expectedAlbumPages, viewerPhotoSlugs, type BuiltAlbumPage } from '../src/lib/build-checks/published.ts';
import { bold, dim, green, red, runCli } from './cli.ts';

const DIST_DIR = resolve('dist');
const IMAGE_PATTERN = /\.(jpe?g|png|webp|gif|avif|tiff?|heic|heif)$/i;
/** Formats exifr can parse; WebP is covered by the structural scan only. */
const EXIFR_PATTERN = /\.(jpe?g|png|tiff?|heic|heif|avif)$/i;

/** The first of a reference's candidate files (dist/-relative) that exists in dist/. */
const existingInDist = (candidates: readonly string[]): string | undefined =>
  candidates.find((candidate) => existsSync(join(DIST_DIR, candidate)));

interface Failure {
  file: string;
  message: string;
}

/** The credit each viewer image must carry (absolute dist/ path → credit, undefined for none). */
async function expectedCredits(files: readonly string[]): Promise<Map<string, Credit | undefined>> {
  const credits = new Map<string, Credit | undefined>();
  for (const file of files) {
    if (!file.endsWith('.html')) continue;
    let images;
    try {
      images = viewerImageCredits(await readFile(file, 'utf8'));
    } catch {
      continue; // Invalid inline JSON is reported by the link check.
    }
    const fromSitePath = sitePathOf(relativePosix(DIST_DIR, file), BASE_PATH);
    for (const image of images) {
      const resolution = resolveReference(image.url, fromSitePath, BASE_PATH, SITE_URL);
      const found = resolution.kind === 'internal' ? existingInDist(resolution.candidates) : undefined;
      if (found !== undefined) credits.set(join(DIST_DIR, found), image.credit); // broken links: the link check
    }
  }
  return credits;
}

async function checkImageMetadata(
  files: readonly string[],
  credits: ReadonlyMap<string, Credit | undefined>,
): Promise<{ checked: number; credited: number; failures: Failure[] }> {
  const failures: Failure[] = [];
  const images = files.filter((file) => IMAGE_PATTERN.test(file));
  let credited = 0;
  for (const file of images) {
    const bytes = await readFile(file);
    const { blocks } = scanImageMetadata(bytes);
    // exifr cannot read WebP (every derivative); for other formats it also catches tags in
    // blocks the structural scan does not know. Credited images are always WebP.
    const extra: string[] = [];
    if (EXIFR_PATTERN.test(file)) {
      const parsed = await exifr
        .parse(bytes, { tiff: true, exif: true, gps: true, xmp: true, iptc: true, icc: false, jfif: false, ihdr: false })
        .catch(() => undefined);
      if (parsed && Object.keys(parsed).length > 0) extra.push('EXIF/XMP/IPTC tags (exifr)');
      const gps = await exifr.gps(bytes).catch(() => undefined);
      if (gps) extra.push('GPS position');
    }
    const expected = credits.get(file);
    const tiff = blocks.includes('EXIF') ? webpExif(bytes) : undefined;
    const problem =
      extra.length > 0
        ? `contains metadata: ${[...blocks, ...extra].join(', ')}`
        : creditProblem(expected, { blocks, credit: tiff ? readCredit(tiff) : undefined });
    if (problem) failures.push({ file: relativePosix(DIST_DIR, file), message: problem });
    else if (expected) credited++;
  }
  return { checked: images.length, credited, failures };
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
      const notOnSite = reference.absolute ? absoluteUrlProblem(reference.url, SITE_URL) : undefined;
      if (notOnSite) {
        checked++;
        failures.push({ file: distRelative, message: `${reference.source} "${reference.url}" ${notOnSite}` });
        continue;
      }
      const resolution = resolveReference(reference.url, fromSitePath, BASE_PATH, SITE_URL);
      if (resolution.kind === 'skip') continue;
      checked++;
      if (resolution.kind === 'error') {
        failures.push({ file: distRelative, message: `${reference.source} "${reference.url}" ${resolution.reason}` });
      } else {
        const found = existingInDist(resolution.candidates);
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

/**
 * Album pages (and "All photos" pages) match the published albums exactly (no drafts, no
 * hidden albums or photos).
 */
async function checkPublishedContent(files: readonly string[]): Promise<{ checked: number; failures: Failure[] }> {
  const albums = await loadAlbums(siteLoadOptions(false));
  const expected = expectedAlbumPages(albums.nodes.values());
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
      const resolution = resolveReference(claim.url, fromSitePath, BASE_PATH, SITE_URL);
      if (resolution.kind !== 'internal') continue; // External, or reported by the link check.
      const found = existingInDist(resolution.candidates);
      if (found === undefined) continue; // Broken links are reported by the link check.
      const image = join(DIST_DIR, found);
      checked++;
      const actual = await sizeOf(image);
      const problem = actual ? dimensionProblem(claim, actual) : 'could not be read as an image';
      if (problem) failures.push({ file: distRelative, message: `${claim.source} image "${claim.url}" ${problem}` });
    }
  }
  return { checked, failures };
}

/** The size in bytes of the page's link preview image, or undefined (none, or broken: the link check). */
async function previewImageBytes(html: string, distRelative: string): Promise<number | undefined> {
  const url = metaProperties(html).find(({ property }) => property === 'og:image')?.content;
  if (!url) return undefined;
  const resolution = resolveReference(url, sitePathOf(distRelative, BASE_PATH), BASE_PATH, SITE_URL);
  const found = resolution.kind === 'internal' ? existingInDist(resolution.candidates) : undefined;
  return found === undefined ? undefined : (await stat(join(DIST_DIR, found))).size;
}

/**
 * Robots meta, takedown line, JavaScript and link preview tags on every page. Returns the
 * heaviest page's JS.
 */
async function checkPageRules(files: readonly string[]): Promise<{ checked: number; failures: Failure[]; largestJs: number }> {
  const failures: Failure[] = [];
  const gzipSizes = new Map<string, number>();
  const policy = { allowIndexing: ALLOW_INDEXING, contactEmail: SITE.contactEmail };
  let checked = 0;
  let largestJs = 0;
  for (const file of files) {
    if (!file.endsWith('.html')) continue;
    checked++;
    const distRelative = relativePosix(DIST_DIR, file);
    const html = await readFile(file, 'utf8');
    for (const message of pageProblems(html, policy)) failures.push({ file: distRelative, message });

    // GitHub Pages serves 404.html for any unknown address, so it has no address of its own.
    const pageUrl = distRelative === '404.html' ? undefined : `${SITE_URL}${sitePathOf(distRelative, BASE_PATH)}`;
    for (const message of previewProblems(html, pageUrl)) failures.push({ file: distRelative, message });
    const previewBytes = await previewImageBytes(html, distRelative);
    const tooLarge = previewBytes === undefined ? undefined : previewImageSizeProblem(previewBytes);
    if (tooLarge) failures.push({ file: distRelative, message: tooLarge });

    let pageJs = 0;
    for (const src of extractScripts(html).external) {
      const resolution = resolveReference(src, sitePathOf(distRelative, BASE_PATH), BASE_PATH, SITE_URL);
      if (resolution.kind !== 'internal') continue; // External or broken: the link check reports it.
      const found = existingInDist(resolution.candidates);
      if (found === undefined) continue;
      const script = join(DIST_DIR, found);
      let size = gzipSizes.get(script);
      if (size === undefined) {
        size = gzipSync(await readFile(script)).length;
        gzipSizes.set(script, size);
      }
      pageJs += size;
    }
    largestJs = Math.max(largestJs, pageJs);
    const budget = scriptBudgetProblem(pageJs);
    if (budget) failures.push({ file: distRelative, message: budget });
  }
  return { checked, failures, largestJs };
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
  console.log(bold(`verify:dist — dist/ built for ${SITE_URL}${BASE_PATH}\n`));
  const files = await listFiles(DIST_DIR);

  const metadata = await checkImageMetadata(files, await expectedCredits(files));
  const copies = await checkSourceCopies();
  const links = await checkLinks(files);
  const dimensions = await checkImageDimensions(files);
  const published = await checkPublishedContent(files);
  const unused = checkUnusedImages(files, links.referenced);
  const pages = await checkPageRules(files);

  printFailures('Images with metadata (or without their photographer credit)', metadata.failures);
  printFailures('Copies of original photos', copies);
  printFailures('Broken or misplaced links', links.failures);
  printFailures('Images whose size does not match the page', dimensions.failures);
  printFailures('Album pages that do not match the published albums', published.failures);
  printFailures('Images no page uses', unused);
  printFailures('Pages that break a site-wide rule (robots, takedown line, JavaScript, link preview)', pages.failures);

  const failed =
    metadata.failures.length + copies.length + links.failures.length + dimensions.failures.length + published.failures.length + unused.length + pages.failures.length;
  if (links.failures.some((failure) => failure.message.includes('outside the site'))) {
    console.log(dim(`Hint: run verify:dist with the same BASE_PATH as the build (now "${BASE_PATH}").\n`));
  }
  if (published.failures.length > 0) {
    console.log(dim('Hint: run verify:dist with the same SHOW_HIDDEN as the build.\n'));
  }
  if ([...links.failures, ...pages.failures].some((failure) => /another site|og:url/.test(failure.message))) {
    console.log(dim(`Hint: run verify:dist with the same SITE_URL as the build (now "${SITE_URL}").\n`));
  }
  if (pages.failures.some((failure) => /robots|mailto/.test(failure.message))) {
    console.log(dim('Hint: run verify:dist with the same ALLOW_INDEXING and CONTACT_EMAIL as the build.\n'));
  }
  const summary =
    `${metadata.checked} images checked for metadata (${metadata.credited} carry a photographer credit), ${files.length} files checked for copies of originals, ` +
    `${links.checked} internal links checked, ${dimensions.checked} image sizes checked, ` +
    `${published.checked} album pages compared with the published albums, ${pages.checked} pages checked for robots ` +
    `(${ALLOW_INDEXING ? 'index' : 'noindex'}), takedown line, link preview and JavaScript ` +
    `(largest ${kilobytes(pages.largestJs)} gzipped, budget ${kilobytes(JS_BUDGET_GZIP_BYTES)}).`;
  if (failed > 0) {
    console.log(red(bold(`✗ ${failed} problem${failed === 1 ? '' : 's'}. ${summary}`)));
    return 1;
  }
  console.log(green(bold(`✓ No problems. ${summary}`)));
  return 0;
}

runCli('verify:dist', main);
