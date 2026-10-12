/**
 * Test images generated with sharp at test time (no binaries committed).
 */
import sharp, { type Sharp } from 'sharp';

export interface JpegOptions {
  width: number;
  height: number;
  /** EXIF DateTimeOriginal, `YYYY:MM:DD HH:MM:SS`. */
  date?: string;
  offset?: string;
  artist?: string;
  description?: string;
  /** Add GPS tags: a position, or (`'no-position'`) only a GPS date, as phones write with location off. */
  gps?: boolean | 'no-position';
  /** Add camera tags (Make, Model). */
  camera?: boolean;
  orientation?: number;
  /** An XMP packet with this dc:description and dc:creator. */
  xmp?: { description?: string; creator?: string };
  quality?: number;
  /** Random-looking pixels (big files) instead of a flat colour. */
  noise?: boolean;
  /**
   * Paint the top half of the *upright* picture red and the bottom half blue. With an
   * orientation, the stored pixels are turned so that the picture is upright when shown.
   */
  marked?: boolean;
}

export const XMP_PACKET = (description?: string, creator?: string) =>
  '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/">' +
  '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" ' +
  'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:exif="http://ns.adobe.com/exif/1.0/">' +
  (description ? `<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${description}</rdf:li></rdf:Alt></dc:description>` : '') +
  (creator ? `<dc:creator><rdf:Seq><rdf:li>${creator}</rdf:li></rdf:Seq></dc:creator>` : '') +
  '<exif:GPSLatitude>1,17.5N</exif:GPSLatitude></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>';

/** Inverse of the EXIF orientation's display rotation, for orientations 1, 3, 6 and 8. */
const STORE_ROTATION: Record<number, number> = { 1: 0, 3: 180, 6: 270, 8: 90 };

export async function makeJpeg(options: JpegOptions): Promise<Buffer> {
  const { width, height } = options;
  let image: Sharp;
  if (options.marked) {
    const half = Math.round(height / 2);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${half}" fill="#ff0000"/><rect y="${half}" width="${width}" height="${height - half}" fill="#0000ff"/></svg>`;
    image = sharp(Buffer.from(svg));
    const rotation = STORE_ROTATION[options.orientation ?? 1] ?? 0;
    if (rotation !== 0) image = sharp(await image.png().toBuffer()).rotate(rotation);
  } else if (options.noise) {
    image = sharp({ create: { width, height, channels: 3, background: '#808080', noise: { type: 'gaussian', mean: 128, sigma: 60 } } });
  } else {
    image = sharp({ create: { width, height, channels: 3, background: '#336699' } });
  }

  const ifd0: Record<string, string> = {};
  const exif: Record<string, string> = {};
  const gps: Record<string, string> = {};
  if (options.artist) ifd0.Artist = options.artist;
  if (options.description) ifd0.ImageDescription = options.description;
  if (options.camera) Object.assign(ifd0, { Make: 'TestCam', Model: 'Model 1' });
  if (options.date) exif.DateTimeOriginal = options.date;
  if (options.offset) exif.OffsetTimeOriginal = options.offset;
  if (options.gps === 'no-position') Object.assign(gps, { GPSDateStamp: '2026:09:20' });
  else if (options.gps) Object.assign(gps, { GPSLatitudeRef: 'N', GPSLatitude: '1/1 17/1 3000/100', GPSLongitudeRef: 'E', GPSLongitude: '103/1 46/1 0/1' });
  if (Object.keys(ifd0).length + Object.keys(exif).length + Object.keys(gps).length > 0) {
    image = image.withExif({ IFD0: ifd0, IFD2: exif, IFD3: gps });
  }
  if (options.xmp) image = image.withXmp(XMP_PACKET(options.xmp.description, options.xmp.creator));
  if (options.orientation) image = image.withMetadata({ orientation: options.orientation });
  return image.jpeg({ quality: options.quality ?? 80 }).toBuffer();
}

/** Mean colour of a horizontal band of the upright image (`from`/`to` as fractions of the height). */
export async function bandColour(bytes: Uint8Array, from: number, to: number): Promise<{ r: number; g: number; b: number }> {
  const upright = sharp(bytes).rotate();
  const { data, info } = await upright.raw().toBuffer({ resolveWithObject: true });
  const start = Math.floor(info.height * from);
  const end = Math.floor(info.height * to);
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = start; y < end; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      r += data[i] ?? 0;
      g += data[i + 1] ?? 0;
      b += data[i + 2] ?? 0;
      n++;
    }
  }
  return { r: r / n, g: g / n, b: b / n };
}

/** Raw EXIF text bytes → string, to compare kept tags in tests. */
export const bytesText = (bytes: Uint8Array | undefined): string | undefined => (bytes ? new TextDecoder().decode(bytes) : undefined);
