# Pinus Community — Digital Photo Album

Static Astro site (TypeScript, plain CSS) deployed to GitHub Pages. The spec is
[docs/TRD.md](docs/TRD.md), product context is [PRODUCT.md](PRODUCT.md), and assumptions are
logged in [docs/DECISIONS.md](docs/DECISIONS.md). Read the TRD before changing behaviour.
[README.md](README.md) is the maintainers' guide (written for non-developers): keep it in
step when a command, a content rule or a `photos:check` code changes.

## Commands

- `npm run dev` / `npm run build` / `npm run preview` — Astro; `npm run dev:hidden` = dev with
  `SHOW_HIDDEN=true` (albums with `hidden: true`, e.g. the demos, shown with a badge)
- `npm test` — Vitest unit tests (`tests/**/*.test.ts`)
- `npm run test:e2e` — Playwright browser tests (`e2e/*.spec.ts`): builds for `/pinus-album/`,
  serves with `astro preview` on port 4460 (`E2E_PORT`), drives the installed Chrome (bundled
  Chromium when `CI` is set; `E2E_BROWSER=chrome|chromium` overrides). Not in the deploy
  workflow; `.github/workflows/e2e.yml` runs it on pull requests
- `npm run typecheck` — `astro check`
- `npm run photos:check` — validate `src/albums/` (exit 1 on errors)
- `npm run photos:prep -- <folder> [--dry-run] [--force]` — make the JPEGs in a folder web-ready
  in place (≤ 2400 px, quality 85, upright, metadata reduced to date/artist/description, GPS
  removed). Idempotent. Refuses folders outside the project without `--force`, and other
  project folders (node_modules, dist, …) always. Never changes the demo folders
  (`DEMO_EVENTS` in `config.ts`: exactly `demo-event-a` and `demo-event-b`, not a prefix).
- `npm run photos:init -- <album-folder> [--dry-run]` — append a `caption: ""` entry to
  `photos.yaml` for every photo of that node without one (never rewrites existing text).
  Both tools read paths relative to the terminal's folder (`INIT_CWD`), else the project.
- `npm run demo:images` — regenerate the placeholder demo images (deterministic, idempotent;
  also restores a demo image that was changed by hand)
- `npm run verify:dist` — after a build: no EXIF/GPS in published images (viewer images of
  credited photos carry exactly their EXIF Artist/Copyright credit), no copies of source
  photos, no broken internal links, every image file the size (and orientation) its page
  claims, album pages exactly the published albums (no drafts, hidden albums or photos), no unused
  images in `_astro/`, and on every page the robots meta for `ALLOW_INDEXING`, the footer's
  takedown line with `CONTACT_EMAIL`, JavaScript only on photo pages within 60 KB gzipped, and
  link preview tags (Open Graph) on `SITE_URL`, naming the page itself, image ≤ 300 KB.
  Album pages include the "All photos" pages (`albums/<path>/all/`).
  Run it with the same `BASE_PATH`, `SITE_URL`, `ALLOW_INDEXING`, `CONTACT_EMAIL` and `SHOW_HIDDEN` as the build.
- Build under a sub-path: `BASE_PATH=/pinus-album/ npm run build`. In Git Bash, prefix
  `MSYS_NO_PATHCONV=1` when passing `BASE_PATH=/`, or MSYS rewrites it into a Windows path.

## Architecture

```
src/
  albums/            content only (event folders, index.md, photos.yaml, @photographer folders)
  lib/               plain TypeScript, unit-tested; framework-free except images.ts (Astro-only)
    config.ts        env-driven settings (BASE_PATH, SITE_URL, TIMEZONE, ALLOW_INDEXING,
                     CONTACT_EMAIL, SHOW_HIDDEN)
    url.ts           withBase()/albumUrl() — every internal link goes through these
    slug.ts          slugify, numeric-prefix stripping, title-from-slug, photo/photographer slugs
    dates.ts         EXIF date parsing in TIMEZONE, display formatting, ranges
    content/
      types.ts       domain types (AlbumNode, Photo, Photographer, Issue)
      schemas.ts     zod schemas for index.md frontmatter, photos.yaml, photographers.yaml
      scan.ts        filesystem walk → SourceTree (fs IO lives only in scan.ts, exif.ts,
                     build-checks/files.ts and authoring/prep-files.ts, init-node.ts)
      exif.ts        EXIF date / orientation / upright dimensions (build time only)
      resolve.ts     PURE: per-photo metadata precedence (TRD §4.6), photos.yaml key matching
      model.ts       PURE: SourceTree → ContentModel (every node and photo, drafts/hidden included)
      tree.ts        PURE: ContentModel → published AlbumNode tree: ordering, counts, covers,
                     drafts, hidden nodes
      validate.ts    PURE: ContentModel → TRD §4.8 errors and warnings (Issue[])
      index.ts       loadAlbums() / loadAlbumsOrThrow(): scan → exif → model → tree + validate;
                     siteLoadOptions(dev) = what the site publishes (pages and verify:dist)
    image-sizes.ts   PURE: derivative widths, crops, `sizes` strings, eager/lazy policy (TRD §7)
    presentation.ts  PURE: counts, date labels, meta descriptions, JSON-for-<script> escaping
    viewer-data.ts   PURE: per-photo data embedded for the post viewer (TRD §6.5); GridPhoto
                     (a photo with its slug and context on one page)
    all-photos.ts    PURE: the "All photos" page of an album with sections (TRD §6.3 item 7):
                     which nodes get one, date order, section-path slugs (`day-1/<slug>`)
    photographer-filter.ts  PURE: the filter chips of a grid (TRD §6.3 item 8)
    images.ts        ASTRO-ONLY: photos → getImage() derivatives (thumb, viewer srcset, covers,
                     the 1200×630 JPEG link preview)
    image-service.ts ASTRO-ONLY: the site's image service (astro.config `image.service`):
                     Astro's sharp service + the photographer credit on viewer images
    credit/          the credit saved viewer images carry: PURE credit.ts (`© Name`, watermark
                     size/position), webp-exif.ts (EXIF chunk into WebP); watermark.ts (sharp:
                     draws the text with the font in src/fonts, writes EXIF Artist/Copyright)
    build-checks/    checks of the built site: image-metadata.ts, links.ts, image-claims.ts,
                     published.ts, page-rules.ts (robots, takedown line, JS budget) (all
                     PURE), files.ts (fs). Not named dist/: that name is the build output
    authoring/       the maintainer tools behind photos:prep and photos:init:
                     PURE jpeg.ts (JPEG segments), exif-block.ts (the kept EXIF tags, read and
                     written byte-exact; also the credit's Artist/Copyright block), prep-rules.ts (what prep does), prep-report.ts,
                     photos-yaml.ts (appends photos.yaml entries); prep.ts (sharp, bytes in/out,
                     no fs); prep-files.ts, init-node.ts and target.ts (fs; target.ts decides
                     which paths the tools may touch)
  content.config.ts  `stories` collection: renders index.md stories with Astro's Markdown
  integrations/      remove-source-copies.ts — deletes copies of original photos from dist/
  fonts/             Inter-SemiBold.ttf (+ OFL.txt): the watermark font, read at build time only
  styles/global.css  design tokens (see DESIGN.md) and base styles, imported once by the layout
  components/        .astro components (one responsibility each)
  layouts/           BaseLayout.astro (head, skip link, header › main › footer)
  pages/             index.astro, albums/[...path].astro, albums/[...path]/all.astro (All
                     photos), 404.astro — thin; data comes from lib
  scripts/viewer/    the post viewer and the photographer filter (client TS, bundled by Astro,
                     shipped only with PhotoGrid):
                     PURE navigation.ts, hash.ts, history.ts (history rules), rows.ts (which
                     rows a photo fills), swipe.ts, focus-order.ts, data.ts, filter.ts
                     (unit-tested); DOM dom.ts, view.ts, image.ts, gestures.ts, scroll-lock.ts,
                     chips.ts (filter chips); controller.ts (state, history, focus; moves
                     through the photos the filter left); index.ts (entry, used by PostViewer.astro)
scripts/             maintainer CLIs (photos:check, photos:prep, photos:init, demo:images,
                     verify:dist) — thin wrappers over src/lib, run with Node type stripping;
                     cli.ts holds the shared colours and runCli() (readable crash message)
tests/               Vitest; helpers under tests/helpers/ (fs fixtures are generated at test time)
e2e/                 Playwright specs (viewer, navigation, site-wide rules) + fixtures.ts;
                     config in playwright.config.ts
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
- **Viewer JS budget:** ≤ 60 KB gzipped (TRD §11); it is about 5.1 KB (viewer and filter chips). No viewer library.
  Decisions the viewer makes (history, which rows show) go in its pure modules, not in
  `controller.ts`/`view.ts`, so they are unit-tested. `VIEWER_LAYOUT` in `image-sizes.ts`
  mirrors the viewer's CSS widths (a test reads the CSS to keep them in step).
- **Links:** never hard-code a leading `/`; use `withBase()` / `albumUrl()`. Link preview tags
  (BaseLayout) are the one place with absolute URLs, built from `Astro.site` (= `SITE_URL`).
  A section may not have the slug `all` (`ALL_PHOTOS_SLUG`): that is its parent's All photos page.
- **Privacy:** published images must carry no EXIF/GPS, and original source files must not be
  copied into `dist/` (they still contain EXIF). Never read a property of an imported image
  (`.src`, `.width`, …): Astro then keeps the original in `dist/`. Pass it only to
  `getImage()` in `images.ts`; sizes come from the content engine. `verify:dist` enforces it.
  The one exception to "no metadata": viewer images of credited photos carry a `© Name`
  watermark and EXIF Artist/Copyright (nothing else), written by `image-service.ts`;
  thumbnails and covers carry neither.
  The masters in the (public) repository should carry no GPS either: `photos:prep` removes it
  and `photos:check` warns (`location-in-photo`). Hiding a photo must never fail the build
  (a takedown cannot be blocked), so a hidden `cover:` is a warning, not an error.
- **Design:** visual decisions and colour roles live in `DESIGN.md`; use the tokens in
  `src/styles/global.css`, never raw colours in components. Page titles use `.page-title`.
- **Content errors fail the build** via `loadAlbumsOrThrow()`; pages pass
  `siteLoadOptions(import.meta.env.DEV)` (drafts in dev, hidden albums only with SHOW_HIDDEN),
  never their own options. Validation messages are written for non-developers:
  say what is wrong and how to fix it.
- **Tests:** pure modules get in-memory trees (`tests/helpers/content.ts`); `scan`/`exif` get a
  fixture tree generated with sharp in a temp folder at test time (no binaries committed).
- **Tests must survive real content.** CI runs `npm test` before every deploy, so no unit test
  may depend on what else is in `src/albums/`. Tests of the committed demo content look only
  at the `DEMO_EVENTS` folders and skip when they are deleted (`demo-content.test.ts`); the E2E suite
  skips itself the same way (`e2e/fixtures.ts`). Real content is `photos:check`'s job.
- Record any assumption or deviation from the TRD in `docs/DECISIONS.md`.
- Every milestone ends green: `npm test`, `npm run typecheck`, `npm run photos:check`,
  `npm run build` + `npm run verify:dist`, the same build + verify with `BASE_PATH=/`, and
  `npm run test:e2e` (stop any server on port 4460 first).
