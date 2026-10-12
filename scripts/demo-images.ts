/**
 * `npm run demo:images` — generates the placeholder demo photos (TRD §12.1).
 *
 * Deterministic and idempotent: the same manifest always produces the same bytes, and a
 * file is only written when its bytes differ. Only image files inside `src/albums/demo-*`
 * are ever written; the hand-written index.md / photos.yaml files are not touched.
 *
 * What the images exercise:
 * - coloured gradients with the file path and metadata drawn on them;
 * - landscape, portrait and square shapes; .jpg, .JPG, .jpeg, .png and .webp files;
 * - some with an EXIF DateTimeOriginal (one with OffsetTimeOriginal), some without;
 * - one stored sideways with EXIF Orientation 6 and a big "UP" arrow, to check upright display;
 * - one with GPS EXIF tags, to prove published images are stripped.
 *
 * Runs directly with Node's type stripping: `node scripts/demo-images.ts`.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { isInDemoFolder } from '../src/lib/authoring/target.ts';
import { ALBUMS_DIR, DEMO_EVENTS } from '../src/lib/config.ts';

type Shape = 'landscape' | 'portrait' | 'square';

interface DemoImage {
  /** Path relative to the albums folder. Must start with `demo-`. */
  path: string;
  shape: Shape;
  /** EXIF DateTimeOriginal, `YYYY:MM:DD HH:MM:SS`. Omitted = no EXIF date (like WhatsApp copies). */
  exifDate?: string;
  /** EXIF OffsetTimeOriginal, e.g. `+08:00`. */
  exifOffset?: string;
  /** Store the pixels rotated with EXIF Orientation 6 (needs a 90° clockwise turn to display). */
  rotated?: boolean;
  /** Add GPS EXIF tags (a fixed demo location). */
  gps?: boolean;
  /** Extra line drawn on the image. */
  note?: string;
}

const SIZES: Record<Shape, { width: number; height: number }> = {
  landscape: { width: 1600, height: 1067 },
  portrait: { width: 1067, height: 1600 },
  square: { width: 1200, height: 1200 },
};

const A1 = 'demo-event-a/day-1';
const A2 = 'demo-event-a/day-2';
const A3 = 'demo-event-a/day-3';
const A3_CLOSING = 'demo-event-a/day-3/closing-photo';
const A4 = 'demo-event-a/day-4';
const B = 'demo-event-b';

/** The demo photo set. Which metadata case each photo covers is documented in the photos.yaml files. */
export const DEMO_IMAGES: readonly DemoImage[] = [
  // Demo Event A, Day 1 (no index.md: title and date come from the folder and the photos)
  { path: `${A1}/@alice-demo/IMG_0001.jpg`, shape: 'landscape', exifDate: '2026:09:18 09:05:00' },
  { path: `${A1}/@alice-demo/IMG_0002.jpg`, shape: 'portrait', exifDate: '2026:09:18 09:20:00' },
  { path: `${A1}/@alice-demo/IMG_0003.jpg`, shape: 'landscape', exifDate: '2026:09:18 10:02:00' },
  {
    path: `${A1}/@alice-demo/IMG_0004.jpg`,
    shape: 'portrait',
    exifDate: '2026:09:18 10:30:00',
    rotated: true,
    note: 'Stored sideways, EXIF Orientation 6: must display upright',
  },
  { path: `${A1}/@alice-demo/IMG_0005.jpg`, shape: 'square', exifDate: '2026:09:18 11:15:00' },
  {
    path: `${A1}/@alice-demo/IMG_0006.jpg`,
    shape: 'landscape',
    exifDate: '2026:09:18 13:40:00',
    exifOffset: '+08:00',
    note: 'EXIF date with OffsetTimeOriginal +08:00',
  },
  { path: `${A1}/@alice-demo/IMG_0007.JPG`, shape: 'portrait', exifDate: '2026:09:18 15:00:00', note: 'Upper-case .JPG extension' },
  { path: `${A1}/@budi-demo/IMG_0001.jpg`, shape: 'landscape', exifDate: '2026:09:18 09:10:00' },
  { path: `${A1}/@budi-demo/IMG_0002.jpg`, shape: 'portrait', exifDate: '2026:09:18 09:45:00' },
  { path: `${A1}/@budi-demo/IMG_0003.jpg`, shape: 'landscape', exifDate: '2026:09:18 11:00:00' },
  { path: `${A1}/@budi-demo/IMG_0004.jpg`, shape: 'landscape', note: 'No EXIF date: falls back to the event date' },
  { path: `${A1}/@budi-demo/IMG_0005.jpeg`, shape: 'portrait', exifDate: '2026:09:18 16:20:00', note: '.jpeg extension' },
  { path: `${A1}/@budi-demo/IMG_0006.jpg`, shape: 'landscape', exifDate: '2026:09:18 17:05:00' },

  // Demo Event A, Day 2
  { path: `${A2}/@alice-demo/IMG_2001.jpg`, shape: 'landscape', exifDate: '2026:09:19 09:00:00' },
  { path: `${A2}/@alice-demo/IMG_2002.jpg`, shape: 'portrait', exifDate: '2026:09:19 10:10:00' },
  { path: `${A2}/@alice-demo/IMG_2003.jpg`, shape: 'landscape', exifDate: '2026:09:19 11:30:00' },
  { path: `${A2}/@alice-demo/IMG_2004.jpg`, shape: 'square', exifDate: '2026:09:19 12:45:00' },
  { path: `${A2}/@alice-demo/IMG_2005.jpg`, shape: 'landscape', note: 'No EXIF date: falls back to the Day 2 date' },
  { path: `${A2}/@alice-demo/IMG_2006.jpg`, shape: 'portrait', exifDate: '2026:09:19 15:30:00' },
  { path: `${A2}/@budi-demo/DSC_0101.jpg`, shape: 'landscape', exifDate: '2026:09:19 09:30:00' },
  { path: `${A2}/@budi-demo/DSC_0102.jpg`, shape: 'portrait', exifDate: '2026:09:19 10:45:00', note: 'Cover of Demo Event A' },
  { path: `${A2}/@budi-demo/DSC_0103.jpg`, shape: 'landscape', note: 'No EXIF date: date set in photos.yaml' },
  { path: `${A2}/@budi-demo/DSC_0104.webp`, shape: 'landscape', note: 'WebP file, no EXIF date' },
  { path: `${A2}/@budi-demo/DSC_0105.jpg`, shape: 'portrait', exifDate: '2026:09:19 16:00:00' },
  { path: `${A2}/@budi-demo/DSC_0106.jpg`, shape: 'landscape', exifDate: '2026:09:19 17:30:00', note: 'Hidden in photos.yaml' },

  // Demo Event A, Day 3 (index.md credits citra-demo for photos without an @ folder)
  { path: `${A3}/PXL_0001.jpg`, shape: 'landscape', exifDate: '2026:09:20 10:00:00' },
  { path: `${A3}/PXL_0002.jpg`, shape: 'portrait', exifDate: '2026:09:20 10:20:00' },
  { path: `${A3}/PXL_0003.jpg`, shape: 'landscape', note: 'No EXIF date: falls back to the Day 3 date' },
  { path: `${A3}/PXL_0004.png`, shape: 'square', note: 'PNG file, no EXIF date' },
  { path: `${A3}/PXL_0005.jpg`, shape: 'landscape', exifDate: '2020:01:01 00:12:00', note: 'Wrong camera clock (2020)' },
  { path: `${A3}/@alice-demo/IMG_3001.jpg`, shape: 'landscape', exifDate: '2026:09:20 13:00:00' },
  { path: `${A3}/@alice-demo/IMG_3002.jpg`, shape: 'portrait', exifDate: '2026:09:20 13:30:00' },
  { path: `${A3}/@alice-demo/IMG_3003.jpg`, shape: 'landscape', exifDate: '2026:09:20 14:15:00' },
  { path: `${A3}/@alice-demo/IMG_3004.jpg`, shape: 'square', exifDate: '2026:09:20 15:00:00' },
  { path: `${A3}/@alice-demo/IMG_3005.jpg`, shape: 'landscape', exifDate: '2026:09:20 18:45:00' },

  // Demo Event A, Day 3, sub-section "closing-photo": the third level, with a single photo
  { path: `${A3_CLOSING}/@dewi-demo/DSC_9001.jpg`, shape: 'landscape', exifDate: '2026:09:20 21:30:00', note: 'The only photo in its sub-section' },

  // Demo Event A, Day 4: a draft section (shown in `npm run dev` only, never published)
  { path: `${A4}/@alice-demo/IMG_4001.jpg`, shape: 'landscape', exifDate: '2026:09:21 09:00:00', note: 'Draft section: never published' },
  { path: `${A4}/@alice-demo/IMG_4002.jpg`, shape: 'portrait', exifDate: '2026:09:21 09:30:00', note: 'Draft section: never published' },
  { path: `${A4}/@alice-demo/IMG_4003.jpg`, shape: 'square', exifDate: '2026:09:21 10:00:00', note: 'Draft section: never published' },

  // Demo Event B (flat: no sections)
  { path: `${B}/@alice-demo/IMG_5001.jpg`, shape: 'landscape', exifDate: '2026:08:15 10:00:00' },
  { path: `${B}/@alice-demo/IMG_5002.jpg`, shape: 'portrait', exifDate: '2026:08:15 10:30:00' },
  { path: `${B}/@alice-demo/IMG_5003.jpg`, shape: 'landscape', exifDate: '2026:08:15 11:00:00' },
  { path: `${B}/@alice-demo/IMG_5004.jpg`, shape: 'square', exifDate: '2026:08:15 11:45:00' },
  { path: `${B}/@alice-demo/IMG_5005.jpg`, shape: 'landscape', exifDate: '2026:08:15 12:10:00' },
  { path: `${B}/@alice-demo/IMG_5006.jpg`, shape: 'portrait', exifDate: '2026:08:15 13:00:00' },
  { path: `${B}/IMG-20260815-WA0001.jpg`, shape: 'landscape', note: 'WhatsApp copy: no EXIF' },
  { path: `${B}/IMG-20260815-WA0002.jpg`, shape: 'portrait', note: 'WhatsApp copy: no EXIF' },
  { path: `${B}/IMG-20260815-WA0003.jpg`, shape: 'landscape', note: 'WhatsApp copy: no EXIF, no credit' },
  { path: `${B}/IMG-20260815-WA0004.png`, shape: 'square', note: 'PNG file, no EXIF' },
  { path: `${B}/IMG-20260815-WA0005.jpg`, shape: 'landscape', note: 'WhatsApp copy: no EXIF' },
  {
    path: `${B}/IMG-20260815-WA0006.jpg`,
    shape: 'landscape',
    exifDate: '2026:08:15 14:00:00',
    gps: true,
    note: 'Has GPS EXIF: published copies must not',
  },
];

// ---------------------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------------------

const PALETTE: readonly [string, string][] = [
  ['#334E97', '#8FA8E0'],
  ['#EF4C2B', '#F7B39F'],
  ['#F1B244', '#7A5A12'],
  ['#2F6F5E', '#A6D8C4'],
  ['#5B3F8C', '#C7B3E8'],
  ['#1F2A44', '#5E7BB5'],
  ['#8C3B2E', '#E8A07F'],
  ['#3E5F2A', '#C9DB8A'],
];

/** FNV-1a: a stable small hash so colours depend only on the path. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

const escapeXml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function describeDate(image: DemoImage): string {
  if (!image.exifDate) return 'No EXIF date';
  const [date = '', time = ''] = image.exifDate.split(' ');
  return `EXIF date ${date.replaceAll(':', '-')} ${time.slice(0, 5)}${image.exifOffset ? ` (${image.exifOffset})` : ''}`;
}

/** Upright artwork as SVG. */
function artwork(image: DemoImage, width: number, height: number): string {
  const [from, to] = PALETTE[hash(image.path) % PALETTE.length] ?? PALETTE[0]!;
  const angle = hash(`${image.path}#angle`) % 2 === 0;
  const fileName = image.path.slice(image.path.lastIndexOf('/') + 1);
  const folder = image.path.slice(0, image.path.lastIndexOf('/')).replaceAll('/', ' / ');
  const unit = Math.min(width, height) / 100;
  const font = "DejaVu Sans, Arial, Helvetica, sans-serif";
  const lines = [
    { text: fileName, size: unit * 7.5, weight: 700 },
    { text: folder, size: unit * 3.6, weight: 400 },
    { text: describeDate(image), size: unit * 3.6, weight: 400 },
    ...(image.note ? [{ text: image.note, size: unit * 3.2, weight: 400 }] : []),
  ];
  const lineGap = unit * 2.5;
  const blockHeight = lines.reduce((sum, line) => sum + line.size + lineGap, -lineGap);
  let y = height / 2 - blockHeight / 2 + (image.rotated ? unit * 12 : 0);
  const text = lines
    .map((line) => {
      y += line.size;
      const element = `<text x="${width / 2}" y="${y.toFixed(1)}" text-anchor="middle" font-family="${font}" font-size="${line.size.toFixed(1)}" font-weight="${line.weight}" fill="#FFFFFF">${escapeXml(line.text)}</text>`;
      y += lineGap;
      return element;
    })
    .join('');
  const arrow = image.rotated
    ? `<polygon points="${width / 2},${unit * 6} ${width / 2 + unit * 14},${unit * 24} ${width / 2 + unit * 5},${unit * 24} ${width / 2 + unit * 5},${unit * 40} ${width / 2 - unit * 5},${unit * 40} ${width / 2 - unit * 5},${unit * 24} ${width / 2 - unit * 14},${unit * 24}" fill="#FFFFFF"/>` +
      `<text x="${width / 2}" y="${unit * 54}" text-anchor="middle" font-family="${font}" font-size="${unit * 12}" font-weight="700" fill="#FFFFFF">UP ↑</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs><linearGradient id="g" x1="0" y1="${angle ? 0 : 1}" x2="1" y2="${angle ? 1 : 0}">
    <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
  </linearGradient></defs>
  <rect width="${width}" height="${height}" fill="url(#g)"/>
  <rect x="${unit * 3}" y="${height - unit * 11}" width="${unit * 34}" height="${unit * 7}" rx="${unit * 1.5}" fill="#000000" fill-opacity="0.35"/>
  <text x="${unit * 6}" y="${height - unit * 6.2}" font-family="${font}" font-size="${unit * 3.4}" font-weight="700" fill="#FFFFFF">DEMO PLACEHOLDER</text>
  ${arrow}${text}
</svg>`;
}

/** Encode one demo image, with the EXIF it should carry. */
export async function renderDemoImage(image: DemoImage): Promise<Buffer> {
  const { width, height } = SIZES[image.shape];
  let pipeline = sharp(Buffer.from(artwork(image, width, height)));
  // Orientation 6 = "rotate 90° clockwise to display", so store the pixels turned 90° anticlockwise.
  if (image.rotated) pipeline = sharp(await pipeline.png().toBuffer()).rotate(270);

  const ifd0: Record<string, string> = {};
  const exifIfd: Record<string, string> = {};
  const gpsIfd: Record<string, string> = {};
  if (image.exifDate) {
    ifd0.Software = 'pinus-album demo:images';
    exifIfd.DateTimeOriginal = image.exifDate;
    if (image.exifOffset) exifIfd.OffsetTimeOriginal = image.exifOffset;
  }
  if (image.gps) {
    // A made-up demo location (Singapore area); only here to prove it gets stripped.
    Object.assign(gpsIfd, {
      GPSLatitudeRef: 'N',
      GPSLatitude: '1/1 17/1 3000/100',
      GPSLongitudeRef: 'E',
      GPSLongitude: '103/1 46/1 0/1',
    });
  }
  if (Object.keys(ifd0).length + Object.keys(exifIfd).length + Object.keys(gpsIfd).length > 0) {
    pipeline = pipeline.withExif({ IFD0: ifd0, IFD2: exifIfd, IFD3: gpsIfd });
  }
  if (image.rotated) pipeline = pipeline.withMetadata({ orientation: 6 });

  const extension = image.path.slice(image.path.lastIndexOf('.') + 1).toLowerCase();
  if (extension === 'png') return pipeline.png({ palette: true, colours: 64, compressionLevel: 9 }).toBuffer();
  if (extension === 'webp') return pipeline.webp({ quality: 78 }).toBuffer();
  return pipeline.jpeg({ quality: 80, mozjpeg: true }).toBuffer();
}

// ---------------------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------------------

/** Resolve a manifest path, refusing anything outside the demo event folders. */
function safeOutputPath(albumsAbs: string, path: string): string {
  const target = resolve(albumsAbs, path);
  if (!isInDemoFolder(albumsAbs, target)) throw new Error(`Refusing to write outside ${DEMO_EVENTS.map((event) => `${ALBUMS_DIR}/${event}`).join(' and ')}: ${path}`);
  return target;
}

async function main(): Promise<void> {
  const albumsAbs = resolve(ALBUMS_DIR);
  let written = 0;
  let unchanged = 0;
  let totalBytes = 0;
  for (const image of DEMO_IMAGES) {
    const target = safeOutputPath(albumsAbs, image.path);
    const bytes = await renderDemoImage(image);
    totalBytes += bytes.length;
    const existing = await readFile(target).catch(() => undefined);
    if (existing?.equals(bytes)) {
      unchanged++;
      continue;
    }
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
    written++;
    console.log(`  wrote ${ALBUMS_DIR}/${image.path} (${Math.round(bytes.length / 1024)} KB)`);
  }
  console.log(
    `demo:images — ${DEMO_IMAGES.length} images (${(totalBytes / 1024 / 1024).toFixed(1)} MB): ${written} written, ${unchanged} unchanged.`,
  );
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(`demo:images failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
