/**
 * Text shown on pages: counts, date labels, meta descriptions. PURE.
 * Absent data disappears (TRD §4.6, §6.5): helpers return `undefined` or an empty list,
 * never "Unknown".
 */
import { formatDateRange } from './dates.ts';
import type { AlbumNode } from './content/types.ts';
import { SITE } from './config.ts';

/** `"1 photo"`, `"12 photos"`. */
export function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString('en')} ${count === 1 ? singular : plural}`;
}

/** `"18–20 Sep 2026"`, or undefined when the node has no date. */
export function nodeDateLabel(node: Pick<AlbumNode, 'date' | 'endDate'>): string | undefined {
  return node.date ? formatDateRange(node.date, node.endDate) : undefined;
}

/**
 * ISO day for a `<time datetime>` attribute: only for single-day nodes, since a range has
 * no single machine-readable value.
 */
export function nodeIsoDay(node: Pick<AlbumNode, 'date' | 'endDate'>): string | undefined {
  if (!node.date) return undefined;
  if (node.endDate && node.endDate.day > node.date.day) return undefined;
  return node.date.day;
}

/**
 * Counts for a card or page header: photos (all descendants), then sections when there
 * are any. `["35 photos", "3 sections"]`. Empty for a node with neither.
 */
export function nodeCounts(node: Pick<AlbumNode, 'photoCount' | 'sectionCount'>): string[] {
  const parts: string[] = [];
  if (node.photoCount > 0) parts.push(countLabel(node.photoCount, 'photo'));
  if (node.sectionCount > 0) parts.push(countLabel(node.sectionCount, 'section'));
  return parts;
}

/**
 * Plain text from a Markdown story: formatting, links, images, code and HTML removed,
 * whitespace collapsed. Good enough for a meta description; not a Markdown parser.
 */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/gm, '')
    .replace(/(\*\*|\*|~~|`)(?=\S)([\s\S]*?\S)\1/g, '$2')
    // `_emphasis_` only at word edges, so `snake_case` keeps its underscores.
    .replace(/(^|[^\p{L}\p{N}_])(__|_)(?=\S)([\s\S]*?\S)\2(?![\p{L}\p{N}_])/gu, '$1$3')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Shorten text to at most `max` characters at a word boundary, adding "…" when cut. */
export function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  // Back off to the previous space, unless the cut already ends a whole word.
  const endsWord = /\s/.test(text.charAt(max - 1));
  const lastSpace = cut.lastIndexOf(' ');
  const base = endsWord || lastSpace <= max * 0.6 ? cut : cut.slice(0, lastSpace);
  return `${base.replace(/[\s,.;:–-]+$/, '')}…`;
}

const DESCRIPTION_MAX = 160;

/**
 * Meta description for an album page: the start of its story, else a plain summary
 * ("35 photos from Demo Event A, 18–20 Sep 2026.").
 */
export function nodeDescription(node: Pick<AlbumNode, 'title' | 'story' | 'date' | 'endDate' | 'photoCount' | 'sectionCount'>): string {
  const story = node.story ? markdownToPlainText(node.story) : '';
  if (story) return truncateText(story, DESCRIPTION_MAX);
  const date = nodeDateLabel(node);
  const what = node.photoCount > 0 ? `${countLabel(node.photoCount, 'photo')} from ${node.title}` : node.title;
  return truncateText(`${what}${date ? `, ${date}` : ''}. ${SITE.name}, ${SITE.descriptor}.`, DESCRIPTION_MAX);
}

// Built from char codes so the source stays plain ASCII.
const UNSAFE_IN_SCRIPT = new RegExp(`[<>&${String.fromCharCode(0x2028, 0x2029)}]`, 'g');
const BACKSLASH = String.fromCharCode(92);

/**
 * Serialise data for an inline `<script type="application/json">`. `<`, `>` and `&` are
 * escaped so a caption containing `</script>` cannot end the element, and U+2028/U+2029
 * so the text is also valid JavaScript.
 */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(UNSAFE_IN_SCRIPT, (char) => `${BACKSLASH}u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
}
