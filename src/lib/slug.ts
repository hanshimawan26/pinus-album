/**
 * Text helpers for URLs and display names: slugs, numeric folder prefixes,
 * titles derived from folder names, photo slugs (TRD §4.2, §4.7) and avatar initials.
 * PURE: no filesystem, no Astro.
 */

/**
 * Lowercase ASCII slug: accents removed, anything that is not a letter or digit
 * becomes a single dash, no leading or trailing dashes.
 * `"Pergelaran 2026!"` → `"pergelaran-2026"`, `"IMG_0012"` → `"img-0012"`.
 */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface FolderName {
  /** Ordering prefix, e.g. `1` for `01-day-1`. Undefined when the folder has none. */
  prefix?: number;
  /** URL slug with the prefix removed, e.g. `day-1`. Empty if nothing usable remains. */
  slug: string;
}

/**
 * Split a node folder name into its optional numeric ordering prefix and its URL slug
 * (TRD §4.2 rule 6). Only 1–3 digit prefixes count, so a year such as `2026-retreat`
 * keeps its year in the URL instead of being treated as "order 2026".
 */
export function parseFolderName(folderName: string): FolderName {
  const match = /^(\d{1,3})[-_. ]+(.*)$/.exec(folderName);
  if (match && slugify(match[2] ?? '') !== '') {
    return { prefix: Number(match[1]), slug: slugify(match[2] ?? '') };
  }
  return { slug: slugify(folderName) };
}

/** `"day-1"` → `"Day 1"`, `"andi-pratama"` → `"Andi Pratama"` (TRD §4.2 rule 7, §4.5). */
export function titleFromSlug(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Stable photo slug for deep links (TRD §4.7): the path relative to the node, without
 * extension, `@` removed, `/` replaced by `-`, slugified. Depends only on the path, never
 * on the photo's position. `"@andi-pratama/IMG_0012.jpg"` → `"andi-pratama-img-0012"`.
 */
export function photoSlug(relativePath: string): string {
  const withoutExtension = relativePath.replace(/\.[^./]+$/, '');
  return slugify(withoutExtension.replaceAll('@', '').replaceAll('/', '-'));
}

/**
 * Photographer slug from an `@folder` name, a `photographer:` value or a photographers.yaml
 * key: leading `@` removed, then slugified. `"@Andi Pratama"` → `"andi-pratama"`.
 * The one rule for all three places, so credits and photographers.yaml entries always match.
 */
export function photographerSlug(raw: string): string {
  return slugify(raw.trim().replace(/^@+/, ''));
}

/** Avatar initials: first letter of the first and last word. `"Andi Pratama"` → `"AP"`. */
export function initials(name: string): string {
  const words = name.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (words.length === 0) return '';
  const first = words[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1] ?? '') : '';
  return (Array.from(first)[0] ?? '').concat(Array.from(last)[0] ?? '').toUpperCase();
}
