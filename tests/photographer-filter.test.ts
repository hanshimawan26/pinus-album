import { describe, expect, it } from 'vitest';
import type { Photographer } from '../src/lib/content/types.ts';
import { photographerChips } from '../src/lib/photographer-filter.ts';

const person = (slug: string, name: string): Photographer => ({ slug, name, initials: '', listed: true });
const rayhan = person('rayhan-adi', 'Rayhan Adi');
const eizel = person('eizel-jaffan', 'Eizel Jaffan');
const aninda = person('aninda', 'Aninda');

describe('photographerChips (TRD §6.3 item 8)', () => {
  it('has one chip per photographer, most photos first, then by name', () => {
    const photos = [eizel, rayhan, aninda, rayhan, eizel, rayhan].map((photographer) => ({ photographer }));
    expect(photographerChips(photos)).toEqual([
      { slug: 'rayhan-adi', name: 'Rayhan Adi', count: 3 },
      { slug: 'eizel-jaffan', name: 'Eizel Jaffan', count: 2 },
      { slug: 'aninda', name: 'Aninda', count: 1 },
    ]);
    expect(photographerChips([{ photographer: eizel }, { photographer: aninda }]).map((chip) => chip.name)).toEqual(['Aninda', 'Eizel Jaffan']);
  });

  it('gives uncredited photos no chip (they show under "All")', () => {
    const chips = photographerChips([{ photographer: rayhan }, {}, { photographer: eizel }, {}]);
    expect(chips.map((chip) => chip.slug)).toEqual(['eizel-jaffan', 'rayhan-adi']);
  });

  it('has no chips with fewer than two photographers', () => {
    expect(photographerChips([])).toEqual([]);
    expect(photographerChips([{ photographer: rayhan }, { photographer: rayhan }, {}])).toEqual([]);
  });
});
