/**
 * How selected photos reach the person's device (TRD §6.4.1). PURE.
 *
 * - `share`: the share sheet, on iPhones, where "Save N Images" puts them straight in Photos.
 *   Not on Android: its sheet only sends files to other apps and has no way to save them.
 * - `files`: Android. Each photo downloads as its own JPEG, so it is in Downloads and in the
 *   gallery at once, with nothing to unzip.
 * - `zip`: one ZIP file. Computers, and iPhones that cannot share these files.
 * - `file`: a single photo needs no ZIP; it is the same JPEG the viewer's download link saves.
 */

export type Delivery = 'file' | 'files' | 'share' | 'zip';

export interface Device {
  /** A touch-first device. Windows and Mac browsers can share too, but a ZIP suits them better. */
  phone: boolean;
  android: boolean;
  canShareFiles: boolean;
}

export function deliveryFor(count: number, device: Device): Delivery {
  if (device.phone && device.canShareFiles && !device.android) return 'share';
  if (count === 1) return 'file';
  return device.android ? 'files' : 'zip';
}
