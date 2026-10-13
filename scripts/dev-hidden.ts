/**
 * `npm run dev:hidden` — `npm run dev` with SHOW_HIDDEN=true, so albums marked
 * `hidden: true` (such as the demo albums) show in the local preview with a "Hidden" badge.
 * A script instead of `SHOW_HIDDEN=true npm run dev`, which works in Git Bash but not in
 * PowerShell or cmd. Extra arguments are passed on: `npm run dev:hidden -- --port 4322`.
 *
 * Runs directly with Node's type stripping: `node scripts/dev-hidden.ts`.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { PROJECT_DIR } from './cli.ts';

const require = createRequire(import.meta.url);
const astroPackage = require.resolve('astro/package.json');
const astroCli = join(dirname(astroPackage), (require(astroPackage) as { bin: { astro: string } }).bin.astro);

const child = spawn(process.execPath, [astroCli, 'dev', ...process.argv.slice(2)], {
  cwd: PROJECT_DIR,
  env: { ...process.env, SHOW_HIDDEN: 'true' },
  stdio: 'inherit',
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
