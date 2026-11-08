import { describe, expect, it } from 'vitest';
import { ANDROID_SHARE_LIMIT, deliveryFor, type Device } from '../../src/scripts/selection/delivery.ts';

const computer: Device = { phone: false, android: false, canShareFiles: false };
const iPhone: Device = { phone: true, android: false, canShareFiles: true };
const android: Device = { phone: true, android: true, canShareFiles: true };
const oldPhone: Device = { phone: true, android: false, canShareFiles: false };

describe('deliveryFor', () => {
  it('gives computers a ZIP, or the plain file for one photo', () => {
    expect(deliveryFor(2, computer)).toBe('zip');
    expect(deliveryFor(1, computer)).toBe('file');
  });

  it('a computer that can share still gets a ZIP', () => {
    expect(deliveryFor(5, { ...computer, canShareFiles: true })).toBe('zip');
  });

  it('uses the share sheet on phones, even for one photo', () => {
    expect(deliveryFor(1, iPhone)).toBe('share');
    expect(deliveryFor(200, iPhone)).toBe('share');
  });

  it('switches Android to a ZIP above what Chrome will share', () => {
    expect(deliveryFor(ANDROID_SHARE_LIMIT, android)).toBe('share');
    expect(deliveryFor(ANDROID_SHARE_LIMIT + 1, android)).toBe('zip');
  });

  it('falls back on phones that cannot share files', () => {
    expect(deliveryFor(3, oldPhone)).toBe('zip');
    expect(deliveryFor(1, oldPhone)).toBe('file');
  });
});
