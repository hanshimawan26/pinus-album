/**
 * Where a path typed by a maintainer points, and whether photos:prep may change files
 * there. Shared by the photos:prep and photos:init CLIs (and by demo:images).
 *
 * npm always runs scripts from the project folder, but maintainers type paths relative to
 * the folder their terminal is in; npm passes that folder as `INIT_CWD`.
 */
import { stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { ALBUMS_DIR, DEMO_EVENTS } from '../config.ts';

/** Is `child` the folder `parent` itself or somewhere inside it? */
export function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

/** Is `absPath` inside one of the generated demo event folders ({@link DEMO_EVENTS})? */
export function isInDemoFolder(albumsAbs: string, absPath: string): boolean {
  if (!isInside(albumsAbs, absPath)) return false;
  const first = relative(albumsAbs, absPath).split(sep)[0] ?? '';
  return DEMO_EVENTS.includes(first);
}

export interface PathContext {
  /** The folder the maintainer's terminal is in (`INIT_CWD` under npm). */
  shellDir: string;
  /** The project folder (where package.json is). */
  projectDir: string;
}

/** The context of the running CLI. `projectDir` comes from the script's own location. */
export function cliPathContext(projectDir: string): PathContext {
  return { shellDir: process.env.INIT_CWD || process.cwd(), projectDir };
}

const exists = async (path: string) => (await stat(path).catch(() => undefined)) !== undefined;

/**
 * The absolute path a maintainer meant. A path is first taken relative to their terminal's
 * folder, as in any command. If nothing exists there, it is taken relative to the project
 * folder, so a command copied from photos:check output (which prints project paths) works
 * from any folder. When neither exists, the terminal-relative path is returned (for the
 * "not found" message).
 */
export async function resolveUserPath(arg: string, context: PathContext): Promise<string> {
  const fromShell = resolve(context.shellDir, arg);
  if (await exists(fromShell)) return fromShell;
  const fromProject = resolve(context.projectDir, arg);
  return (await exists(fromProject)) ? fromProject : fromShell;
}

/**
 * A plain-English reason why photos:prep must not change files at `targetAbs`, or
 * undefined when it may. photos:prep overwrites photos in place, so:
 * - inside `src/albums`: always allowed (the photos there are copies the maintainer put there);
 * - the project folder itself, a folder containing it, or any other folder of the project
 *   (node_modules, dist, public, …): always refused, even with `force`;
 * - a folder outside the project (e.g. Downloads, maybe the only copy of the originals):
 *   only with `force`.
 * @param typed the path as the maintainer typed it, for the messages
 */
export async function checkPrepTarget(
  typed: string,
  targetAbs: string,
  options: { projectDir: string; force: boolean },
): Promise<string | undefined> {
  const albumsAbs = resolve(options.projectDir, ALBUMS_DIR);
  const example = `npm run photos:prep -- ${ALBUMS_DIR}/my-event`;
  if (!(await exists(targetAbs))) {
    return `"${typed}" was not found (looked for ${targetAbs}). Give the folder with the photos, for example: ${example}`;
  }
  if (isInside(albumsAbs, targetAbs)) return undefined;
  if (isInside(targetAbs, options.projectDir)) {
    return `"${typed}" (${targetAbs}) contains the whole project, not just photos. Give the event or section folder with the new photos, for example: ${example}`;
  }
  if (isInside(options.projectDir, targetAbs)) {
    return (
      `"${typed}" (${targetAbs}) is a project folder outside ${ALBUMS_DIR}. photos:prep only changes photos inside ${ALBUMS_DIR}, ` +
      `so it never touches files the website needs. Give the event or section folder, for example: ${example}`
    );
  }
  if (!options.force) {
    return (
      `"${typed}" (${targetAbs}) is outside ${ALBUMS_DIR}. photos:prep changes photos in place (it overwrites them), so to protect your ` +
      `originals it only works inside ${ALBUMS_DIR}. Copy the photos into an event folder first, or add --force to change them where they are.`
    );
  }
  return undefined;
}
