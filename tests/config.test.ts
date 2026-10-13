import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { THEME_COLOR } from '../src/lib/config.ts';

describe('THEME_COLOR', () => {
  it('equals the --color-bg token in global.css, so the browser UI matches the page', () => {
    const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');
    const token = /--color-bg:\s*(#[0-9a-f]{3,8})\b/i.exec(css)?.[1];
    expect(token?.toLowerCase()).toBe(THEME_COLOR.toLowerCase());
  });
});

describe('SHOW_HIDDEN', () => {
  const load = async (value: string | undefined) => {
    vi.resetModules();
    if (value === undefined) delete process.env.SHOW_HIDDEN;
    else process.env.SHOW_HIDDEN = value;
    const config = await import('../src/lib/config.ts');
    const content = await import('../src/lib/content/index.ts');
    return { flag: config.SHOW_HIDDEN, site: content.siteLoadOptions(false), dev: content.siteLoadOptions(true) };
  };
  const original = process.env.SHOW_HIDDEN;
  afterEach(() => {
    if (original === undefined) delete process.env.SHOW_HIDDEN;
    else process.env.SHOW_HIDDEN = original;
    vi.resetModules();
  });

  it('is off by default: the site leaves hidden albums out in dev and production', async () => {
    for (const value of [undefined, '', 'false', '0', 'no']) {
      const { flag, site, dev } = await load(value);
      expect(flag).toBe(false);
      expect(site).toEqual({ includeDrafts: false, includeHidden: false });
      expect(dev).toEqual({ includeDrafts: true, includeHidden: false });
    }
  });

  it('true, 1 or yes previews hidden albums', async () => {
    for (const value of ['true', 'TRUE', '1', 'yes']) {
      const { flag, site } = await load(value);
      expect(flag).toBe(true);
      expect(site).toEqual({ includeDrafts: false, includeHidden: true });
    }
  });
});
