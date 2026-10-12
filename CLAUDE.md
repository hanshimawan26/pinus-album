# Pinus Community — Digital Photo Album

Static Astro site (TypeScript, plain CSS) deployed to GitHub Pages. The spec is
[docs/TRD.md](docs/TRD.md), product context is [PRODUCT.md](PRODUCT.md), and assumptions are
logged in [docs/DECISIONS.md](docs/DECISIONS.md). Read the TRD before changing behaviour.

## Commands

- `npm run dev` / `npm run build` / `npm run preview` — Astro
- `npm test` — Vitest unit tests (`tests/**/*.test.ts`)
- `npm run typecheck` — `astro check`
- `npm run photos:check` — validate `src/albums/` (exit 1 on errors)
- `npm run demo:images` — regenerate the placeholder demo images (deterministic, idempotent)
- Build under a sub-path: `BASE_PATH=/pinus-album/ npm run build`. In Git Bash, prefix
  `MSYS_NO_PATHCONV=1` when passing `BASE_PATH=/`, or MSYS rewrites it into a Windows path.

## Architecture

```
src/
  albums/            content only (event folders, index.md, photos.yaml, @photographer folders)
  lib/               plain TypeScript, framework-free, unit-tested
    config.ts        env-driven settings (TIMEZONE, ALLOW_INDEXING, CONTACT_EMAIL)
    url.ts           withBase()/albumUrl() — every internal link goes through these
    slug.ts          slugify, numeric-prefix stripping, title-from-slug, photo/photographer slugs
    dates.ts         EXIF date parsing in TIMEZONE, display formatting, ranges
    content/
      types.ts       domain types (AlbumNode, Photo, Photographer, Issue)
      schemas.ts     zod schemas for index.md frontmatter, photos.yaml, photographers.yaml
      scan.ts        filesystem walk → SourceTree (the only fs-reading module besides exif.ts)
      exif.ts        EXIF date / orientation / upright dimensions (build time only)
      resolve.ts     PURE: per-photo metadata precedence (TRD §4.6), photos.yaml key matching
      model.ts       PURE: SourceTree → ContentModel (every node and photo, drafts/hidden included)
      tree.ts        PURE: ContentModel → published AlbumNode tree: ordering, counts, covers, drafts
      validate.ts    PURE: ContentModel → TRD §4.8 errors and warnings (Issue[])
      index.ts       loadAlbums() / loadAlbumsOrThrow(): scan → exif → model → tree + validate
  components/        .astro components (one responsibility each)
  layouts/           BaseLayout.astro
  pages/             index.astro, albums/[...path].astro, 404.astro — thin; data comes from lib
  scripts/           client-side TS (the post viewer), bundled by Astro, only on pages with photos
scripts/             maintainer CLIs (photos:check, photos:prep, photos:init, demo:images) —
                     thin wrappers over src/lib, run with Node type stripping
tests/               Vitest; helpers under tests/helpers/ (fs fixtures are generated at test time)
```

## Conventions

- **Keep `src/lib` pure where it says PURE.** Pass data in, return data out. No fs, no Astro,
  no `import.meta.glob`. That is what makes the TRD §4.6/§4.8 rules unit-testable.
- **Node-runnable imports:** anything imported by `scripts/` must use relative imports with a
  `.ts` extension, and only erasable TypeScript (no enums, namespaces, parameter properties,
  path aliases). Astro and Vitest handle the same files.
- **No UI framework.** `.astro` components with scoped CSS. Design tokens are CSS custom
  properties defined once in the layout's global stylesheet.
- **Absent data disappears.** Never render "Unknown" or an empty row (TRD §4.6, §6.5).
- **Links:** never hard-code a leading `/`; use `withBase()` / `albumUrl()`.
- **Privacy:** published images must carry no EXIF/GPS, and original source files must not be
  copied into `dist/` (they still contain EXIF).
- **Content errors fail the build** via `loadAlbumsOrThrow()`; pages pass
  `includeDrafts: import.meta.env.DEV`. Validation messages are written for non-developers:
  say what is wrong and how to fix it.
- **Tests:** pure modules get in-memory trees (`tests/helpers/content.ts`); `scan`/`exif` get a
  fixture tree generated with sharp in a temp folder at test time (no binaries committed).
- Record any assumption or deviation from the TRD in `docs/DECISIONS.md`.
- Every milestone ends green: `npm test`, `npm run typecheck`, `npm run photos:check`, and
  `npm run build` all pass.
