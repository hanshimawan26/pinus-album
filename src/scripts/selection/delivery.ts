/**
 * How selected photos reach the person's device (TRD §6.4.1). PURE.
 *
 * - `share`: the phone's share sheet, where "Save N Images" puts them straight in the gallery.
 * - `zip`: one ZIP file. Computers, and phones that cannot share these files.
 * - `file`: a single photo needs no ZIP; it is the same JPEG the viewer's download link saves.
 */

export type Delivery = 'file' | 'share' | 'zip';

/**
 * Chrome refuses to share more than 10 files (`kMaxSharedFileCount` in Chromium's
 * share_service_impl.h), and Android browsers are built on it. Safari documents no limit.
 */
export const ANDROID_SHARE_LIMIT = 10;

export interface Device {
  /** A touch-first device. Windows and Mac browsers can share too, but a ZIP suits them better. */
  phone: boolean;
  android: boolean;
  canShareFiles: boolean;
}

export function deliveryFor(count: number, device: Device): Delivery {
  if (device.phone && device.canShareFiles && (!device.android || count <= ANDROID_SHARE_LIMIT)) return 'share';
  return count === 1 ? 'file' : 'zip';
}
