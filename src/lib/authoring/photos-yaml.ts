/**
 * photos:init: add a `photos.yaml` entry with an empty caption for every photo of a node
 * that has none yet (TRD §4.4, §9). PURE: text in, text out.
 *
 * Existing content is never rewritten: new entries are **appended** to the file's text
 * exactly as it is, so existing entries, their order, comments, quoting, blank lines and
 * line endings (Windows CRLF included) stay byte-for-byte the same. The yaml package's
 * Document API parses the file, renders the new entries (with correct quoting), and checks
 * the result: if appending would change the meaning of anything already there, nothing is
 * written. A blank caption means "no caption" (DECISIONS.md, milestone 2), so the
 * skeleton changes nothing on the site until someone fills it in.
 */
import YAML, { Document, Pair, Scalar, YAMLMap, isMap } from 'yaml';
import { matchPhotoKeys, normaliseKey } from '../content/resolve.ts';
import { parseYaml } from '../content/schemas.ts';
import type { PhotoOverride } from '../content/types.ts';

/** Comment at the top of a photos.yaml that photos:init creates. */
export const NEW_FILE_HEADER = [
  '# Captions for the photos in this folder: write each caption between the quotes.',
  '# An empty caption ("") changes nothing on the site, so you can leave it or delete it.',
  '# Other fields you can add under a photo: date: 2026-09-20, photographer: andi-pratama,',
  '# alt: "Text for screen readers", hidden: true (hides the photo from the site).',
].join('\n');

/** Photos that got no new entry because an existing key may already mean them. */
export interface SkippedPhotos {
  key: string;
  /** The photos the key may mean. */
  candidates: string[];
  /**
   * `ambiguous`: a bare file name that matches several photos.
   * `case`: the key differs from a photo's name only in capitals (`suggestion` is the right spelling).
   * Either way, adding an entry would give a "listed twice" error once the key is fixed.
   */
  reason: 'ambiguous' | 'case';
  suggestion?: string;
}

export type InitResult =
  | {
      ok: true;
      /** The new file text (equal to the input when nothing was added). */
      text: string;
      /** Keys added, in the order they were appended. */
      added: string[];
      /** Photos skipped because an existing key may mean them (fix that key first). */
      skipped: SkippedPhotos[];
    }
  | { ok: false; problem: string };

const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

/**
 * The key for a photo in TRD §4.4 format: the path relative to the node
 * (`@andi-pratama/IMG_0012.jpg`). A photo directly in the node gets its bare file name, or
 * `./name` when a photographer folder has a file with the same name.
 */
export function keyFor(relPath: string, allPaths: readonly string[]): string {
  if (relPath.includes('/')) return relPath;
  const sameName = allPaths.filter((path) => baseName(path) === relPath);
  return sameName.length > 1 ? `./${relPath}` : relPath;
}

function renderEntries(keys: readonly string[]): string {
  const map = new YAMLMap();
  keys.forEach((key, index) => {
    const keyNode = new Scalar(key);
    keyNode.type = Scalar.QUOTE_DOUBLE;
    if (index > 0) keyNode.spaceBefore = true; // one blank line between entries
    const caption = new Scalar('');
    caption.type = Scalar.QUOTE_DOUBLE;
    const fields = new YAMLMap();
    fields.add(new Pair(new Scalar('caption'), caption));
    map.add(new Pair(keyNode, fields));
  });
  return new Document(map).toString({ lineWidth: 0 });
}

/** The existing top-level keys, or a problem explaining why the file cannot be extended safely. */
function existingKeys(text: string): { ok: true; keys: string[]; data: Record<string, unknown> } | { ok: false; problem: string } {
  const parsed = parseYaml(text);
  if (!parsed.ok) {
    return { ok: false, problem: `photos.yaml has a mistake, so photos:init did not change it: ${parsed.problems.join(' ')}` };
  }
  const doc = YAML.parseDocument(text);
  if (doc.contents !== null && (!isMap(doc.contents) || doc.contents.flow)) {
    return {
      ok: false,
      problem:
        'photos.yaml is not written as a list of photos (one "path": line per photo, with fields indented below it), ' +
        'so photos:init did not change it. Run "npm run photos:check" for details.',
    };
  }
  const data = (parsed.value ?? {}) as Record<string, unknown>;
  return { ok: true, keys: Object.keys(data), data };
}

/**
 * Plan the new photos.yaml text.
 * @param existing current file text, or undefined when the node has no photos.yaml yet
 * @param photoPaths relPaths of the node's photos, in the order new entries should appear
 *   (display order works best: captions are then written in the order they are seen)
 */
export function addMissingEntries(existing: string | undefined, photoPaths: readonly string[]): InitResult {
  const current = existing === undefined ? undefined : existingKeys(existing);
  if (current && !current.ok) return current;

  // Every key already in the file counts, valid or not: adding a second entry for a photo
  // would only create a "listed twice" error. That includes a key that only differs from a
  // photo's name in capitals: once photos:check's suggestion is followed, it means that photo.
  const entries = new Map<string, PhotoOverride>((current?.keys ?? []).map((key) => [key.trim(), {}]));
  const match = matchPhotoKeys(entries, photoPaths);
  const skipped: SkippedPhotos[] = [
    ...match.ambiguous.map(({ key, candidates }) => ({ key, candidates, reason: 'ambiguous' as const })),
    ...match.unmatched.flatMap(({ key, suggestion, reason }) => {
      if (reason !== 'case' || suggestion === undefined) return [];
      const candidates = normaliseKey(key).explicitPath ? [suggestion] : photoPaths.filter((path) => baseName(path) === suggestion);
      return [{ key, candidates, reason: 'case' as const, suggestion }];
    }),
  ].filter((item) => item.candidates.some((path) => !match.matched.has(path))); // only report what it blocks
  const skippedPhotos = new Set(skipped.flatMap((item) => item.candidates));
  const missing = photoPaths.filter((path) => !match.matched.has(path) && !skippedPhotos.has(path));
  const added = missing.map((path) => keyFor(path, photoPaths));

  if (added.length === 0) return { ok: true, text: existing ?? '', added, skipped };

  // A missing or blank file starts with a short explanation; anything else is appended to.
  const blank = existing === undefined || existing.trim() === '';
  const newline = existing?.includes('\r\n') ? '\r\n' : '\n';
  const block = (blank ? `${NEW_FILE_HEADER}\n\n${renderEntries(added)}` : renderEntries(added)).replace(/\n/g, newline);
  const text = blank ? block : `${(existing ?? '').replace(/(\r?\n)*$/, '')}${newline}${newline}${block}`;

  // Never write a file that means something different for the existing entries.
  const check = existingKeys(text);
  const before = current?.ok ? current.data : {};
  const unchanged =
    check.ok &&
    Object.keys(before).every((key) => JSON.stringify(check.data[key]) === JSON.stringify(before[key])) &&
    added.every((key) => JSON.stringify(check.data[key]) === JSON.stringify({ caption: '' })) &&
    check.keys.length === Object.keys(before).length + added.length;
  if (!unchanged) {
    return {
      ok: false,
      problem:
        'photos:init could not add entries to this photos.yaml without changing what is already there ' +
        '(for example because of unusual indentation). Add the entries by hand, or run "npm run photos:check" for details.',
    };
  }
  return { ok: true, text, added, skipped };
}
