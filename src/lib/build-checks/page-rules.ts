/**
 * Site-wide rules every built page must follow. PURE: page HTML in, problems out;
 * `npm run verify:dist` reads the files and measures the scripts.
 *
 *   - Search indexing (TRD §10): `<meta name="robots">` says `noindex` unless the site was
 *     built with `ALLOW_INDEXING=true`, and then it must not.
 *   - Takedown line (TRD §10): every page has the footer line with a mailto link to the
 *     contact address.
 *   - JavaScript (TRD §11): only pages with a photo grid load scripts, and the scripts a page
 *     loads stay within the viewer budget (60 KB gzipped).
 */
import { markupOnly } from './links.ts';

/** TRD §11: viewer JavaScript, gzipped. */
export const JS_BUDGET_GZIP_BYTES = 60 * 1024;

/** The start of the footer's takedown sentence (TRD §10); SiteFooter.astro renders it. */
export const TAKEDOWN_TEXT = 'Not comfortable with a photo?';

export interface PagePolicy {
  /** The `ALLOW_INDEXING` setting the site was built with. */
  allowIndexing: boolean;
  /** The `CONTACT_EMAIL` the footer must link to. */
  contactEmail: string;
}

export interface PageScripts {
  /** `src` of every external script, as written in the page. */
  external: string[];
  /** Inline scripts that run code (JSON data blocks do not count). */
  inline: number;
}

const SCRIPT_TAGS = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const TYPE_ATTRIBUTE = /\btype\s*=\s*["']?([^"'\s>]+)/i;
const SRC_ATTRIBUTE = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
const DATA_TYPES = /^application\/(?:ld\+)?json$/i;

/** The scripts a page runs. `<script type="application/json">` data blocks are not scripts. */
export function extractScripts(html: string): PageScripts {
  const scripts: PageScripts = { external: [], inline: 0 };
  for (const [, attributes = '', body = ''] of html.matchAll(SCRIPT_TAGS)) {
    const type = TYPE_ATTRIBUTE.exec(attributes)?.[1] ?? '';
    if (DATA_TYPES.test(type)) continue;
    const src = SRC_ATTRIBUTE.exec(attributes);
    if (src) scripts.external.push(src[1] ?? src[2] ?? src[3] ?? '');
    else if (body.trim().length > 0) scripts.inline++;
  }
  return scripts;
}

/** Whether the page has a photo grid (and therefore the viewer's data). */
export const hasPhotoGrid = (html: string): boolean => /<script\b[^>]*\bid\s*=\s*["']?viewer-data\b/i.test(html);

/** The `content` of `<meta name="robots">`, or undefined when the page has none. */
export function robotsContent(html: string): string | undefined {
  for (const [tag] of markupOnly(html).matchAll(/<meta\b[^>]*>/gi)) {
    if (!/\bname\s*=\s*["']?robots\b/i.test(tag)) continue;
    return /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag)?.slice(1).find((value) => value !== undefined) ?? '';
  }
  return undefined;
}

/** Problems with the page's robots meta, takedown line and inline scripts. */
export function pageProblems(html: string, policy: PagePolicy): string[] {
  const problems: string[] = [];

  const robots = robotsContent(html);
  const noindex = robots !== undefined && /\bnoindex\b/i.test(robots);
  if (robots === undefined) {
    problems.push('has no <meta name="robots"> tag');
  } else if (!policy.allowIndexing && !noindex) {
    problems.push(`has robots "${robots}", but the site was built without ALLOW_INDEXING=true, so it must say "noindex"`);
  } else if (policy.allowIndexing && noindex) {
    problems.push(`has robots "${robots}", but the site was built with ALLOW_INDEXING=true`);
  }

  const markup = markupOnly(html);
  const footer = /<footer\b[\s\S]*?<\/footer>/i.exec(markup)?.[0] ?? '';
  if (!footer.includes(TAKEDOWN_TEXT)) {
    problems.push(`has no takedown line ("${TAKEDOWN_TEXT} …") in its footer`);
  } else if (!mailtoAddresses(footer).includes(policy.contactEmail.toLowerCase())) {
    problems.push(`has a takedown line that does not link to mailto:${policy.contactEmail}`);
  }

  const scripts = extractScripts(html);
  if (scripts.inline > 0) {
    problems.push(`runs ${scripts.inline} inline script(s); the site ships JavaScript only as the photo viewer's bundle`);
  }
  if (!hasPhotoGrid(html) && scripts.external.length > 0) {
    problems.push(`loads JavaScript (${scripts.external.join(', ')}) but has no photos; the viewer belongs only on pages with photos`);
  }
  return problems;
}

/** Lower-cased addresses of the `mailto:` links in some markup. */
function mailtoAddresses(markup: string): string[] {
  return [...markup.matchAll(/\bhref\s*=\s*["']?mailto:([^"'\s>?]+)/gi)].map((match) => (match[1] ?? '').toLowerCase());
}

/** A problem when a page's scripts together exceed the budget (gzipped bytes). */
export function scriptBudgetProblem(gzipBytes: number, budget = JS_BUDGET_GZIP_BYTES): string | undefined {
  if (gzipBytes <= budget) return undefined;
  return `loads ${kilobytes(gzipBytes)} of JavaScript (gzipped), over the ${kilobytes(budget)} budget (TRD §11)`;
}

/** `4780` → `"4.7 KB"` (1 KB = 1024 bytes). */
export const kilobytes = (bytes: number): string => `${(bytes / 1024).toFixed(1).replace(/\.0$/, '')} KB`;
