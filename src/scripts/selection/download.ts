/**
 * Gets selected photos onto the device (TRD §6.4.1): fetches the same JPEGs the viewer's
 * download link saves, then hands them over as a file, a ZIP or to the share sheet. Which one
 * is decided in `delivery.ts`. The files are untouched, so each keeps its photographer credit.
 */
import type { ViewerDownload } from '../../lib/viewer-data.ts';
import type { Device } from './delivery.ts';
import { zipParts, type ZipFile } from './zip.ts';

/** Enough to be quick; few enough that a slow connection is not overwhelmed. */
const PARALLEL_FETCHES = 4;

/** Long enough for a phone to start saving a large blob before its URL goes away. */
const BLOB_URL_LIFETIME_MS = 60_000;

/** Between separate downloads: browsers drop some when they are started all at once. */
const SEPARATE_DOWNLOAD_GAP_MS = 250;

/** Fetches the photos, a few at a time, and returns them in the order given. */
export async function fetchPhotos(
  photos: readonly ViewerDownload[],
  options: { signal: AbortSignal; onProgress: (done: number) => void },
): Promise<ZipFile[]> {
  const files = new Array<ZipFile>(photos.length);
  let next = 0;
  let done = 0;
  const worker = async (): Promise<void> => {
    while (next < photos.length) {
      const index = next++;
      const photo = photos[index]!;
      const response = await fetch(photo.src, { signal: options.signal });
      if (!response.ok) throw new Error(`${photo.fileName}: HTTP ${response.status}`);
      files[index] = { name: photo.fileName, bytes: new Uint8Array(await response.arrayBuffer()) };
      options.onProgress(++done);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL_FETCHES, photos.length) }, worker));
  return files;
}

export function saveUrl(url: string, fileName: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
}

/**
 * Starts one download per photo, in order. The browser fetches them itself, so nothing is held
 * in memory; the first starts inside the tap, which is what lets the download begin at all.
 */
export async function saveEach(
  photos: readonly ViewerDownload[],
  options: { signal: AbortSignal; onProgress: (done: number) => void },
): Promise<void> {
  for (const [index, photo] of photos.entries()) {
    if (options.signal.aborted) return;
    saveUrl(photo.src, photo.fileName);
    options.onProgress(index + 1);
    await new Promise((resolve) => window.setTimeout(resolve, SEPARATE_DOWNLOAD_GAP_MS));
  }
}

export function saveZip(files: readonly ZipFile[], fileName: string): void {
  const url = URL.createObjectURL(new Blob(zipParts(files, new Date()), { type: 'application/zip' }));
  saveUrl(url, fileName);
  window.setTimeout(() => URL.revokeObjectURL(url), BLOB_URL_LIFETIME_MS);
}

const asFile = ({ name, bytes }: ZipFile): File => new File([bytes], name, { type: 'image/jpeg' });

export const shareFiles = (files: readonly ZipFile[]): Promise<void> => navigator.share({ files: files.map(asFile) });

/** A dismissed share sheet rejects with this; it is not a failure. */
export const isDismissed = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError';

export function currentDevice(): Device {
  const probe = asFile({ name: 'probe.jpg', bytes: new Uint8Array(1) });
  return {
    phone: window.matchMedia('(pointer: coarse)').matches,
    android: /Android/i.test(navigator.userAgent),
    canShareFiles: typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] }),
  };
}
