import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { THEME_COLOR } from '../src/lib/config.ts';

describe('THEME_COLOR', () => {
  it('equals the --color-bg token in global.css, so the browser UI matches the page', () => {
    const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');
    const token = /--color-bg:\s*(#[0-9a-f]{3,8})\b/i.exec(css)?.[1];
    expect(token?.toLowerCase()).toBe(THEME_COLOR.toLowerCase());
  });
});
