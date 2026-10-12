/**
 * `npm run photos:init -- <node-folder>` — adds a photos.yaml entry with an empty caption
 * for every photo in an event or section folder that has no entry yet (TRD §4.4, §9).
 * Creates photos.yaml when it is missing. Existing entries, their order and comments are
 * never changed: new entries are added at the end. Running it again adds nothing.
 *
 *   npm run photos:init -- src/albums/my-event/day-1
 *   npm run photos:init -- src/albums/my-event/day-1 --dry-run   show what would be added
 *
 * Runs directly with Node's type stripping: `node scripts/photos-init.ts`.
 */
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { initNode } from '../src/lib/authoring/init-node.ts';
import type { SkippedPhotos } from '../src/lib/authoring/photos-yaml.ts';
import { cliPathContext, resolveUserPath } from '../src/lib/authoring/target.ts';
import { relativePosix } from '../src/lib/build-checks/files.ts';
import { ALBUMS_DIR } from '../src/lib/config.ts';
import { countLabel as plural } from '../src/lib/presentation.ts';
import { bold, dim, green, PROJECT_DIR, red, runCli, yellow } from './cli.ts';

const USAGE = `Usage: npm run photos:init -- <album-folder> [--dry-run]

  <album-folder>  an event or section folder, e.g. ${ALBUMS_DIR}/my-event/day-1
                  (relative to the folder your terminal is in, or to the project folder)
  --dry-run       only show which entries would be added; nothing is written`;

function skippedMessage({ key, candidates, reason, suggestion }: SkippedPhotos): string {
  const then = '(npm run photos:check explains), then run photos:init again.';
  if (reason === 'case') {
    return `"${key}" differs from the photo name "${suggestion}" only in capitals, so that photo got no new entry. Correct the capitals in that key ${then}`;
  }
  return `"${key}" matches several photos (${candidates.join(', ')}), so none of them got a new entry. Write the full path in that key ${then}`;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE);
    return 0;
  }
  const dryRun = argv.includes('--dry-run') || argv.includes('-n');
  const unknown = argv.filter((arg) => arg.startsWith('-') && !['--dry-run', '-n'].includes(arg));
  const folders = argv.filter((arg) => !arg.startsWith('-'));
  if (unknown.length > 0 || folders.length !== 1) {
    if (unknown.length > 0) console.log(red(`Unknown option: ${unknown.join(' ')}`));
    if (folders.length > 1) console.log(red('Give one album folder at a time.'));
    console.log(USAGE);
    return 1;
  }

  const folder = folders[0] ?? '';
  const folderAbs = await resolveUserPath(folder, cliPathContext(PROJECT_DIR));
  const info = await stat(folderAbs).catch(() => undefined);
  if (!info?.isDirectory()) {
    console.log(red(`"${folder}" (${folderAbs}) is not a folder. Give an event or section folder, for example: npm run photos:init -- ${ALBUMS_DIR}/my-event`));
    return 1;
  }

  const result = await initNode(resolve(PROJECT_DIR, ALBUMS_DIR), folderAbs, { dryRun });
  if (!result.ok) {
    console.log(red(result.problem));
    return 1;
  }

  const file = relativePosix(PROJECT_DIR, result.photosYaml);
  console.log(bold(`photos:init — ${file}${dryRun ? ' (dry run: nothing is written)' : ''}`));
  for (const key of result.added) console.log(`  ${green('+')} "${key}"`);
  for (const item of result.skipped) console.log(yellow(`  ! ${skippedMessage(item)}`));
  console.log('');
  if (result.added.length === 0) {
    const reason =
      result.photoCount === 0
        ? 'this folder has no photos of its own'
        : result.photoCount === 1
          ? 'its photo already has an entry'
          : `all ${plural(result.photoCount, 'photo')} already have an entry`;
    console.log(green(bold(`✓ Nothing to add: ${reason}.`)));
    return 0;
  }
  const verb = dryRun ? 'Would add' : 'Added';
  const where = result.created ? `a new ${file}` : file;
  const entries = `${result.added.length} ${result.added.length === 1 ? 'entry' : 'entries'}`;
  console.log(green(bold(`✓ ${verb} ${entries} to ${where}.`)));
  if (!dryRun) console.log(dim('Write the captions between the quotes. Empty captions change nothing on the site.'));
  return 0;
}

runCli('photos:init', main);
