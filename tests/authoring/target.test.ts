/**
 * Where photos:prep and photos:init look, and what photos:prep refuses to change: a fake
 * project in a temp folder, plus the real CLIs run the way npm runs them.
 */
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkPrepTarget, isInDemoFolder, isInside, resolveUserPath } from '../../src/lib/authoring/target.ts';
import { makeJpeg } from '../helpers/images.ts';

const run = promisify(execFile);
const REPO = resolve(fileURLToPath(new URL('../..', import.meta.url)));

let tmp: string;
let project: string;
let albums: string;
let outside: string;

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'pinus-album-target-'));
  project = join(tmp, 'project');
  albums = join(project, 'src', 'albums');
  outside = join(tmp, 'Downloads');
  for (const dir of [join(albums, 'event', '@andi'), join(project, 'node_modules', 'pkg'), join(project, 'src', 'albums-old'), outside]) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(join(outside, 'original.jpg'), await makeJpeg({ width: 3000, height: 2000, gps: true }));
});

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe('isInside', () => {
  it('is true for the folder itself and anything below it', () => {
    expect(isInside(albums, albums)).toBe(true);
    expect(isInside(albums, join(albums, 'event', '@andi'))).toBe(true);
  });

  it('is false for siblings with a similar name, parents and ".." tricks', () => {
    expect(isInside(albums, join(project, 'src', 'albums-old'))).toBe(false);
    expect(isInside(albums, project)).toBe(false);
    expect(isInside(albums, join(albums, '..', 'albums-old'))).toBe(false);
  });

  it('accepts a folder whose name merely starts with two dots', () => {
    expect(isInside(albums, join(albums, '..event'))).toBe(true);
  });
});

describe('isInDemoFolder', () => {
  it('matches only the generated demo-* folders at the top of the albums folder', () => {
    expect(isInDemoFolder(albums, join(albums, 'demo-event-a', 'day-1', '@alice-demo', 'IMG_0001.jpg'))).toBe(true);
    expect(isInDemoFolder(albums, join(albums, 'event', 'demo-night', 'IMG_1.jpg'))).toBe(false);
    expect(isInDemoFolder(albums, join(project, 'demo-event-a', 'IMG_1.jpg'))).toBe(false);
    expect(isInDemoFolder(albums, albums)).toBe(false);
  });
});

describe('resolveUserPath', () => {
  it('reads a path relative to the folder the terminal is in (npm passes it as INIT_CWD)', async () => {
    const context = { shellDir: join(albums, 'event'), projectDir: project };
    expect(await resolveUserPath('.', context)).toBe(join(albums, 'event'));
    expect(await resolveUserPath('@andi', context)).toBe(join(albums, 'event', '@andi'));
  });

  it('falls back to the project folder, so commands copied from photos:check work anywhere', async () => {
    const context = { shellDir: join(albums, 'event'), projectDir: project };
    expect(await resolveUserPath('src/albums/event', context)).toBe(join(albums, 'event'));
  });

  it('returns the terminal-relative path when nothing exists (for the "not found" message)', async () => {
    const context = { shellDir: join(albums, 'event'), projectDir: project };
    expect(await resolveUserPath('missing', context)).toBe(join(albums, 'event', 'missing'));
  });
});

describe('checkPrepTarget', () => {
  const check = (target: string, force = false) => checkPrepTarget(target, target, { projectDir: project, force });

  it('allows the albums folder and anything inside it', async () => {
    expect(await check(albums)).toBeUndefined();
    expect(await check(join(albums, 'event'))).toBeUndefined();
  });

  it('refuses a path that does not exist, naming where it looked', async () => {
    expect(await check(join(albums, 'nope'))).toMatch(/was not found \(looked for .*nope\)/);
  });

  it('refuses the project folder, a folder containing it and other project folders, even with --force', async () => {
    for (const target of [project, tmp, join(project, 'node_modules'), join(project, 'src', 'albums-old'), join(project, 'src')]) {
      expect(await check(target, true)).toBeDefined();
    }
    expect(await check(tmp, true)).toContain('contains the whole project');
    expect(await check(join(project, 'node_modules'), true)).toContain('only changes photos inside src/albums');
  });

  it('refuses a folder outside the project unless --force is given', async () => {
    expect(await check(outside)).toContain('add --force');
    expect(await check(outside, true)).toBeUndefined();
  });
});

describe('the CLIs, run as npm runs them (from the project folder)', () => {
  const node = (script: string, args: string[], initCwd?: string) =>
    run(process.execPath, [join('scripts', script), ...args], {
      cwd: REPO,
      env: { ...process.env, NO_COLOR: '1', INIT_CWD: initCwd ?? REPO },
    }).then(
      ({ stdout }) => ({ code: 0, stdout }),
      (error: { code?: number; stdout?: string }) => ({ code: error.code ?? 1, stdout: error.stdout ?? '' }),
    );

  it('photos:prep refuses a folder outside the project without --force and changes nothing', async () => {
    const before = await readFile(join(outside, 'original.jpg'));
    const result = await node('photos-prep.ts', [outside]);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain('add --force');
    expect(await readFile(join(outside, 'original.jpg'))).toEqual(before);
  });

  it('photos:prep and photos:init read "." as the folder the terminal is in', async () => {
    const demoB = join(REPO, 'src', 'albums', 'demo-event-b');
    const prep = await node('photos-prep.ts', ['.', '--dry-run'], demoB);
    expect(prep.code).toBe(0);
    expect(prep.stdout).toContain('photos:prep — src/albums/demo-event-b (dry run');
    // The demo folders are generated: photos:prep never changes them (their GPS image is a test fixture).
    expect(prep.stdout).toContain('generated demo image');
    expect(prep.stdout).not.toMatch(/would (resize|compress|clean)/);

    const init = await node('photos-init.ts', ['.', '--dry-run'], demoB);
    expect(init.code).toBe(0);
    expect(init.stdout).toContain('photos:init — src/albums/demo-event-b/photos.yaml');
  });
});
