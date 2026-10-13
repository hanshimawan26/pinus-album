/**
 * `npm run photos:check` — validates everything under src/albums/ (TRD §4.8, §9).
 * Prints errors, then warnings, grouped by file, and a summary.
 * Exit code 1 if there are errors; warnings alone do not fail.
 *
 * Runs directly with Node's type stripping: `node scripts/photos-check.ts`.
 */
import { loadAlbums, type Issue } from '../src/lib/content/index.ts';
import { ALBUMS_DIR, TIMEZONE } from '../src/lib/config.ts';
import { countLabel as plural } from '../src/lib/presentation.ts';
import { bold, dim, green, red, runCli, yellow } from './cli.ts';

function printGroup(title: string, issues: readonly Issue[], colour: (text: string) => string, marker: string): void {
  if (issues.length === 0) return;
  console.log(bold(colour(`${title} (${issues.length})`)));
  const byFile = new Map<string, Issue[]>();
  for (const issue of issues) byFile.set(issue.file, [...(byFile.get(issue.file) ?? []), issue]);
  for (const [file, fileIssues] of byFile) {
    console.log(`\n  ${bold(file)}`);
    for (const issue of fileIssues) {
      const [first, ...rest] = issue.message.split('\n');
      console.log(`    ${colour(marker)} ${first} ${dim(`[${issue.code}]`)}`);
      for (const line of rest) console.log(`      ${line}`);
    }
  }
  console.log('');
}

async function main(): Promise<number> {
  // Validation always covers everything, drafts and hidden albums and photos included, so
  // problems surface before they are published. (The load options only shape the published
  // tree, which this script does not use.)
  const albums = await loadAlbums();
  const { stats, errors, warnings } = albums;

  console.log(bold(`photos:check — ${ALBUMS_DIR}`));
  console.log(
    dim(
      `${plural(stats.nodes, 'album')} (${stats.draftNodes} draft, ${stats.hiddenNodes} hidden), ${plural(stats.photos, 'photo')} ` +
        `(${stats.hiddenPhotos} hidden), ${(stats.totalBytes / 1024 / 1024).toFixed(1)} MB, dates in ${TIMEZONE}\n`,
    ),
  );

  printGroup('Errors', errors, red, '✗');
  printGroup('Warnings', warnings, yellow, '!');

  const summary = `${plural(errors.length, 'error')}, ${plural(warnings.length, 'warning')}.`;
  if (errors.length > 0) {
    console.log(red(bold(`✗ ${summary} Fix the errors above; the site will not build until they are fixed.`)));
    return 1;
  }
  console.log(green(bold(`✓ ${summary}${warnings.length > 0 ? ' Warnings do not stop the build.' : ''}`)));
  return 0;
}

runCli('photos:check', main);
