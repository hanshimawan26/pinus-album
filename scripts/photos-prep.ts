/**
 * `npm run photos:prep -- <folder>` — makes the JPEG photos in a folder web-ready, in place
 * (TRD §7, §9): long edge at most 2400 px, JPEG quality 85, upright, and no metadata except
 * the date (plus photographer and caption fields, if any). GPS locations are removed.
 * Idempotent: a second run changes nothing. PNG and WebP files are left alone (reported
 * when too big); HEIC files get conversion instructions.
 *
 *   npm run photos:prep -- src/albums/my-event            prepare every photo in the folder
 *   npm run photos:prep -- src/albums/my-event --dry-run  show what would change, write nothing
 *   npm run photos:prep -- ~/Downloads/photos --force     allow a folder outside the project
 *
 * Runs directly with Node's type stripping: `node scripts/photos-prep.ts`.
 */
import { dirname, resolve } from 'node:path';
import { listPrepCandidates, prepFile, type PrepOutcome } from '../src/lib/authoring/prep-files.ts';
import { describeOutcome, needsAttention, summarise, summaryLines, type LineTone } from '../src/lib/authoring/prep-report.ts';
import { checkPrepTarget, cliPathContext, resolveUserPath } from '../src/lib/authoring/target.ts';
import { relativePosix } from '../src/lib/build-checks/files.ts';
import { ALBUMS_DIR } from '../src/lib/config.ts';
import { bold, dim, green, PROJECT_DIR, red, runCli, yellow } from './cli.ts';

const USAGE = `Usage: npm run photos:prep -- <folder> [--dry-run] [--force]

  <folder>    the event or section folder with the new photos, e.g. ${ALBUMS_DIR}/my-event
              (relative to the folder your terminal is in, or to the project folder)
  --dry-run   only show what would change; no file is written
  --force     also allow a folder outside the project (photos are changed in place!)

The generated demo folders (${ALBUMS_DIR}/demo-*) are never changed.`;

const TONE: Record<LineTone, (text: string) => string> = { changed: green, ok: dim, attention: yellow, error: red };

interface Args {
  targets: string[];
  dryRun: boolean;
  force: boolean;
  help: boolean;
  unknown: string[];
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { targets: [], dryRun: false, force: false, help: false, unknown: [] };
  for (const arg of argv) {
    if (arg === '--dry-run' || arg === '-n') args.dryRun = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg.startsWith('-')) args.unknown.push(arg);
    else args.targets.push(arg);
  }
  return args;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return 0;
  }
  if (args.unknown.length > 0 || args.targets.length === 0) {
    if (args.unknown.length > 0) console.log(red(`Unknown option: ${args.unknown.join(' ')}`));
    console.log(USAGE);
    return 1;
  }
  const context = cliPathContext(PROJECT_DIR);
  const targets: string[] = [];
  for (const typed of args.targets) {
    const targetAbs = await resolveUserPath(typed, context);
    const problem = await checkPrepTarget(typed, targetAbs, { projectDir: PROJECT_DIR, force: args.force });
    if (problem) {
      console.log(red(problem));
      return 1;
    }
    targets.push(targetAbs);
  }

  const albumsAbs = resolve(PROJECT_DIR, ALBUMS_DIR);
  const outcomes: PrepOutcome[] = [];
  for (const targetAbs of targets) {
    console.log(bold(`photos:prep — ${relativePosix(PROJECT_DIR, targetAbs) || '.'}${args.dryRun ? ' (dry run: nothing is written)' : ''}`));
    const files = await listPrepCandidates(targetAbs);
    // File names relative to the folder keep the lines short; a single file shows its own name.
    const base = files.length === 1 && files[0] === targetAbs ? dirname(targetAbs) : targetAbs;
    for (const file of files) {
      const outcome = await prepFile(file, { dryRun: args.dryRun, albumsAbs });
      outcomes.push(outcome);
      const line = describeOutcome(outcome, args.dryRun);
      console.log(`  ${TONE[line.tone](line.label.padEnd(14))} ${relativePosix(base, file)}  ${dim(line.detail)}`);
    }
    if (files.length === 0) console.log(dim('  No images found.'));
  }

  const summary = summarise(outcomes);
  console.log('');
  for (const [index, line] of summaryLines(summary, args.dryRun).entries()) {
    const text = line.tone === 'attention' ? yellow(line.text) : line.text;
    console.log(index === 0 ? bold(text) : text);
  }
  if (needsAttention(summary)) {
    console.log(red(bold('✗ Some files need your attention (see above). Fix them and run photos:prep again.')));
    return 1;
  }
  if (!args.dryRun) console.log(green(bold('✓ Done. Running photos:prep again changes nothing.')));
  return 0;
}

runCli('photos:prep', main);
