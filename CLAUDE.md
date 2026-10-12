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
- `npm run verify:dist` — after a build: no EXIF/GPS in published images, no copies of source
  photos, no broken internal links, every image file the size (and orientation) its page
  claims. Run it with the same `BASE_PATH` as the build.
- Build under a sub-path: `BASE_PATH=/pinus-album/ npm run build`. In Git Bash, prefix
  `MSYS_NO_PATHCONV=1` when passing `BASE_PATH=/`, or MSYS rewrites it into a Windows path.

## Architecture

```
src/
  albums/            content only (event folders, index.md, photos.yaml, @photographer folders)
  lib/               plain TypeScript, unit-tested; framework-free except images.ts (Astro-only)
    config.ts        env-driven settings (BASE_PATH, TIMEZONE, ALLOW_INDEXING, CONTACT_EMAIL)
    url.ts           withBase()/albumUrl() — every internal link goes through these
    slug.ts          slugify, numeric-prefix stripping, title-from-slug, photo/photographer slugs
    dates.ts         EXIF date parsing in TIMEZONE, display formatting, ranges
    content/
      types.ts       domain types (AlbumNode, Photo, Photographer, Issue)
      schemas.ts     zod schemas for index.md frontmatter, photos.yaml, photographers.yaml
      scan.ts        filesystem walk → SourceTree (fs IO lives only in scan.ts, exif.ts and
                     build-checks/files.ts)
      exif.ts        EXIF date / orientation / upright dimensions (build time only)
      resolve.ts     PURE: per-photo metadata precedence (TRD §4.6), photos.yaml key matching
      model.ts       PURE: SourceTree → ContentModel (every node and photo, drafts/hidden included)
      tree.ts        PURE: ContentModel → published AlbumNode tree: ordering, counts, covers, drafts
      validate.ts    PURE: ContentModel → TRD §4.8 errors and warnings (Issue[])
      index.ts       loadAlbums() / loadAlbumsOrThrow(): scan → exif → model → tree + validate
    image-sizes.ts   PURE: derivative widths, crops, `sizes` strings, eager/lazy policy (TRD §7)
    presentation.ts  PURE: counts, date labels, meta descriptions, JSON-for-<script> escaping
    viewer-data.ts   PURE: per-photo data embedded for the post viewer (TRD §6.5)
    images.ts        ASTRO-ONLY: photos → getImage() derivatives (thumb, viewer srcset, covers)
    build-checks/    checks of the built site: image-metadata.ts, links.ts, image-claims.ts
                     (all PURE), files.ts (fs). Not named dist/: that name is the build output
  content.config.ts  `stories` collection: renders index.md stories with Astro's Markdown
  integrations/      remove-source-copies.ts — deletes copies of original photos from dist/
  styles/global.css  design tokens (see DESIGN.md) and base styles, imported once by the layout
  components/        .astro components (one responsibility each)
  layouts/           BaseLayout.astro (head, skip link, header › main › footer)
  pages/             index.astro, albums/[...path].astro, 404.astro — thin; data comes from lib
  scripts/viewer/    the post viewer (client TS, bundled by Astro, shipped only with PhotoGrid):
                     PURE navigation.ts, hash.ts, history.ts (history rules), rows.ts (which
                     rows a photo fills), swipe.ts, focus-order.ts, data.ts (unit-tested);
                     DOM dom.ts, view.ts, image.ts, gestures.ts, scroll-lock.ts; controller.ts
                     (state, history, focus); index.ts (entry, used by PostViewer.astro)
scripts/             maintainer CLIs (photos:check, photos:prep, photos:init, demo:images,
                     verify:dist) — thin wrappers over src/lib, run with Node type stripping;
                     cli.ts holds the shared colours and runCli() (readable crash message)
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
- **Absent data disappears.** Never render "Unknown" or an empty row (TRD §4.6, §6.5). In
  the viewer, rows without data get the `hidden` attribute (a global rule makes `[hidden]`
  win over component `display`), and user text is set with `textContent`, never `innerHTML`.
- **Viewer JS budget:** ≤ 60 KB gzipped (TRD §11); it is about 4.8 KB. No viewer library.
  Decisions the viewer makes (history, which rows show) go in its pure modules, not in
  `controller.ts`/`view.ts`, so they are unit-tested. `VIEWER_LAYOUT` in `image-sizes.ts`
  mirrors the viewer's CSS widths (a test reads the CSS to keep them in step).
- **Links:** never hard-code a leading `/`; use `withBase()` / `albumUrl()`.
- **Privacy:** published images must carry no EXIF/GPS, and original source files must not be
  copied into `dist/` (they still contain EXIF). Never read a property of an imported image
  (`.src`, `.width`, …): Astro then keeps the original in `dist/`. Pass it only to
  `getImage()` in `images.ts`; sizes come from the content engine. `verify:dist` enforces it.
- **Design:** visual decisions and colour roles live in `DESIGN.md`; use the tokens in
  `src/styles/global.css`, never raw colours in components. Page titles use `.page-title`.
- **Content errors fail the build** via `loadAlbumsOrThrow()`; pages pass
  `includeDrafts: import.meta.env.DEV`. Validation messages are written for non-developers:
  say what is wrong and how to fix it.
- **Tests:** pure modules get in-memory trees (`tests/helpers/content.ts`); `scan`/`exif` get a
  fixture tree generated with sharp in a temp folder at test time (no binaries committed).
- Record any assumption or deviation from the TRD in `docs/DECISIONS.md`.
- Every milestone ends green: `npm test`, `npm run typecheck`, `npm run photos:check`,
  `npm run build` + `npm run verify:dist`, and the same build + verify with `BASE_PATH=/`.
