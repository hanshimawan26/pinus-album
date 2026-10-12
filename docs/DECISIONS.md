# Decisions and assumptions

Assumptions made while building the POC from [TRD.md](TRD.md). Defaults from TRD §14 are
used unless noted. Each entry: what was decided, and why. Newest entries at the bottom of
each section.

## Open conflicts with the TRD (need the committee's confirmation)

- **Lighthouse SEO ≥ 90 (TRD §11, acceptance item in §12.3) vs. `noindex` by default (TRD §10,
  §14 #5).** With the default `noindex`, Lighthouse SEO scores 63, and the only failing audit
  is `is-crawlable`. With `ALLOW_INDEXING=true` it scores 100. The privacy default wins until
  the committee decides to allow indexing. The §12.3 item "Lighthouse targets in §11 are met"
  is therefore ticked with this caveat: Performance, Accessibility and Best Practices meet
  their targets as built, and SEO meets its target when indexing is allowed. To be confirmed
  by the committee, and repeated in the milestone 6 handover.

## Project and repository

- **Branch:** the default branch is `main` (renamed from `master`); CI deploys on push to `main`.
- **Default base path:** `/pinus-album/` (repo name). Override with `BASE_PATH`. In CI the base
  path and site URL are read from `actions/configure-pages`, so a custom domain or an
  organisation site (`<org>.github.io`) works without code changes. Repository variables
  `SITE_URL` / `BASE_PATH` override the detected values.
- **AI-tooling folders** (`.claude/`, `.agents/`, `.cursor/`, …) are committed so the shared
  skills travel with the repo; personal config files (`*.local.json`) are gitignored.
- **Node:** `>=22.18`. Maintenance scripts in `scripts/` are TypeScript run directly by Node's
  built-in type stripping (no `tsx`/`ts-node` dependency). This is why relative imports use the
  `.ts` extension and `tsconfig.json` sets `erasableSyntaxOnly` (no enums or namespaces).
- **TypeScript 5.9** is pinned because `@astrojs/check` does not support TypeScript 7 yet.
- **Settings via env vars:** `SITE_URL`, `BASE_PATH`, `TIMEZONE` (default `Asia/Singapore`),
  `ALLOW_INDEXING` (default off → `noindex`), `CONTACT_EMAIL` (placeholder until the committee
  sets one). All are read in `src/lib/config.ts` or `astro.config.mjs`.
- **CI** also runs the unit tests before building, so a broken content engine never deploys.

## Design

- **Base colour:** warm off-white page background (about `#FAF8F4`) with near-black text.
  Chosen over pure white (too clinical next to the brand colours) and beige (tints the photos).
- **Blue `#334E97`** is the interactive colour (links, buttons, focus), per PRODUCT.md.
- **The viewer's photo area is black** (PRODUCT.md constraint).

## Milestone 2 — Content engine

### Dependencies

- **`yaml`** parses `index.md` frontmatter, `photos.yaml` and `photographers.yaml`. It gives
  line numbers for syntax errors and rejects duplicate keys. Frontmatter is split by our own
  ~20-line function, so `gray-matter` is not needed.
- **`zod`** validates the parsed values and gives per-field messages (TRD §3).
- **`exifr`** decodes EXIF `DateTimeOriginal` / `OffsetTimeOriginal` at build time (TRD §3).
  `sharp`, which is already installed, supplies the raw EXIF block, pixel size and orientation
  for JPEG, PNG and WebP. No other dependencies were added.

### Pipeline and modules

- **One extra module, `src/lib/content/model.ts`**, sits between `scan` and `tree`. It turns
  the source tree into a *content model* that holds every node and photo (drafts and hidden
  photos included), with metadata resolved and parse problems recorded. `tree.ts` derives the
  published tree from it, and `validate.ts` reports on all of it. This keeps `tree.ts` and
  `validate.ts` small, pure and independent of each other (neither imports the other).
  Values both need, such as the file an `index.md` `cover:` points to, are resolved once in
  `model.ts`. CLAUDE.md lists the module.
- **Only `scan.ts` and `exif.ts` touch the filesystem.** `index.ts` orchestrates them and
  imports `node:path` for path resolution only.
- **`loadAlbums()` is memoised per options (root, includeDrafts, timezone),** and every call
  re-scans the folder. The directory walk is cheap. It rebuilds only when a file, its size
  or its modification time changes, so `astro dev` sees new photos without a restart. Image
  facts are cached per file by size and mtime.
- **sharp reads images from a buffer, not from a path.** With a path, sharp's cache keeps the
  file open, and on Windows that stops maintainers from deleting or renaming photos while
  `astro dev` runs. A test caught this.
- **Errors fail the build through `loadAlbumsOrThrow()`.** It throws one `AlbumContentError`
  listing every error with its file. `photos:check` prints errors and warnings, grouped by
  file, and exits with code 1 on errors.

### Content rules

- **Unknown fields are errors** in `index.md`, `photos.yaml` and `photographers.yaml`, with a
  "Did you mean …?" suggestion. Non-developers make typos (`titel:`, `captoin:`), and an
  ignored typo is worse than a failed check.
- **Invalid entries do not discard valid ones.** If one `photos.yaml` or `photographers.yaml`
  entry is invalid, it is reported, and the other entries still apply and are still checked.
  One typo must never quietly un-hide a photo listed further down.
- **Numeric ordering prefixes are 1–3 digits** (`01-day-1`). A four-digit year
  (`2026-retreat`) stays part of the URL instead of becoming "order 2026".
- **Blank values mean "not set".** For example, `caption: ""` is not a caption, which makes
  the future `photos:init` skeleton harmless. Unquoted numbers are accepted as text
  (`title: 2026`). Photographer values are normalised to slugs (`@Andi Pratama` →
  `andi-pratama`) by one function, `photographerSlug()` in `slug.ts`, used for `@folder`
  names, `photographer:` values and `photographers.yaml` keys alike, so they always match.
- **Unquoted `@` in YAML gets a specific hint.** Most `photos.yaml` keys start with `@`, which
  YAML only accepts in quotes. Instead of the parser's generic message, the error says to put
  the text in double quotes, with an example for that kind of file.
- **`photos.yaml` keys:** a key containing `/` is a path relative to the node. A bare file
  name matches by name and only if it is unique in the node. `./IMG_1.jpg` explicitly means
  the photo directly in the node, which is the way out of an ambiguity. Matching is
  case-sensitive (GitHub Pages builds on Linux), and near misses get a suggestion. The same
  photo listed twice (bare name plus full path) is an error. A key for a sub-folder's photo
  says to use that sub-folder's own `photos.yaml`.
- **`photos.yaml` `date` may include a time** (`2026-09-20 18:30`, in TIMEZONE) for exact
  ordering. `index.md` `date`/`endDate` are calendar dates only. `endDate` needs `date` and
  must not be earlier.
- **Instagram handles** are normalised (leading `@`, profile URLs and capitals removed) and
  must match Instagram's character set (letters, digits, `.`, `_`, at most 30 characters).
  `name` is optional in `photographers.yaml`; without it the slug is title-cased.
- **Avatar initials** come from the first letter of the first and last word of the name
  ("Alice (Demo)" → "AD").
- **Generated alt text** follows TRD §4.6: "Photo from {node title} by {photographer}", or
  "Photo from {node title}" when nobody is credited. Alt text taken from a multi-line caption
  is collapsed to one line.

### Dates

- **One calendar for the whole site.** EXIF `DateTimeOriginal` has no zone and is read in
  TIMEZONE. If `OffsetTimeOriginal` is present, it sets the true instant (it is more precise
  than assuming TIMEZONE), but the displayed day is still the day in TIMEZONE. All dates on the
  site and in range checks then use the same calendar.
- **Representation:** an `AlbumDate` holds an instant (epoch ms) for sorting and a `YYYY-MM-DD`
  day in TIMEZONE for display. YAML calendar dates keep their day exactly; their instant is
  midnight in TIMEZONE, so they sort before timed photos of the same day. Zone maths uses
  `Intl` only. Month names are fixed English abbreviations ("Sep", not ICU's "Sept").
- **Both YAML date shapes are accepted.** The `yaml` package returns strings with its default
  schema and `Date` objects with the YAML 1.1 schema; tests cover both.
- **Photo date fallback uses `index.md` dates only** (TRD §4.6: "nearest ancestor index.md
  date"). A date derived from photos (TRD §4.2 rule 7) is never used as a photo's date.
- **Derived node dates** (a node whose `index.md` has no `date`, or that has no `index.md`)
  extend TRD rule 7 ("the date from its earliest photo") to an `index.md` without a date.
  The derived date is the earliest of the node's own visible photos' `photos.yaml`/EXIF dates
  and its published children's dates (their `index.md` date, or derived the same way).
  A photo date that only fell back to an *ancestor's* `index.md` is not used: it says nothing
  about this node. Without this rule, one WhatsApp photo (no EXIF) in "Day 3" would get the
  event's start date, make Day 3 show "18 Sep" and sort it before Day 1. A node whose photos
  only have inherited dates gets **no** date (absent data disappears; it sorts by name after
  dated siblings). The photos themselves still show the fallback date (TRD §4.6).
- **EXIF date range check:** only EXIF-sourced dates are checked, in calendar days in
  TIMEZONE, inclusive. The range is the node's own `index.md` `date`…`endDate` (just `date`
  when there is no `endDate`). If the node sets no date, the nearest ancestor's range is used.
  If no ancestor sets one, nothing is checked. Dates from `photos.yaml` are deliberate and
  never checked. EXIF still wins over the node date (TRD §14 #10).

### Ordering, counts, covers, drafts

- **Events:** newest date first, then `order`, then name. Undated events go last.
  **Sections:** `order` → numeric prefix → date → name, all ascending, with missing values
  last. Names compare naturally ("day-2" before "day-10"). **Photos:** by date/time, then
  path. Undated photos go last.
- **Hidden photos** are left out of grids, counts, covers and derived dates, but they are
  still validated.
- **Cover fallback:** a missing or hidden `cover:` is an error, and the tree falls back to the
  default so `astro dev` still renders. A cover inside a draft sub-section that is excluded
  from production also falls back to the default.
- **Drafts are validated in every mode** (build and `photos:check`), so problems surface
  before publishing. `includeDrafts` only decides what is published. Pages pass
  `includeDrafts: import.meta.env.DEV`.

### Validation details (beyond the TRD §4.8 list)

- **Extra errors**, so that nothing is silently dropped: an image whose content is not
  JPEG/PNG/WebP (for example a HEIC renamed to `.jpg`); an unreadable image; a folder name
  with no plain letters (a–z) or digits (for example a non-Latin name, which `slugify` cannot
  turn into a URL); a photo file name with no plain letters or digits (`invalid-file-name`:
  it would get an empty deep-link slug); a sub-folder inside an `@photographer` folder;
  photos or `@` folders directly in `src/albums`; a folder named just `@`.
- **Metadata files that are not read are errors, not warnings** (`misnamed-file`,
  `misplaced-file`). They can carry `hidden: true` or `draft: true`, and since warnings do not
  fail the build, ignoring them would publish a photo or draft the maintainer meant to keep
  off the site. This covers near-miss names (`photos.yml`, `Photos.yaml`, `photo.yaml`,
  `Index.md`, `index.markdown`, and `photos.yaml.txt` / `index.md.txt`, which Windows Notepad
  produces when file extensions are hidden); `index.md` or `photos.yaml` inside an
  `@photographer` folder (the most natural place to try to hide a photo: the message says to
  move it up one level and prefix keys with `@name/`); `index.md` or `photos.yaml` directly in
  `src/albums`; and `photographers.yaml` inside an event or section.
- **Extra warnings** (`ignored-file`): video files, anywhere (not shown; video is a non-goal).
- **"Node with no cover"** means a node with no visible photos in itself or below it. Any such
  node falls back to a child's cover when it has one.
- **Size thresholds** use binary units (1 MB = 1024 × 1024 bytes), matching what Windows and
  macOS file browsers show. "Image over 2 MB" and "total over 700 MB" count every file under
  `src/albums`, hidden photos included, because they all take up space in the repository.

### Demo content

- `npm run demo:images` (`scripts/demo-images.ts`) generates all 47 demo images from a fixed
  manifest. It is deterministic, and it only writes a file when the bytes differ, so a re-run
  causes no git churn. It refuses to write outside `src/albums/demo-*`. The images are
  committed (about 1.5 MB in total, each under 50 KB). Note: they draw text with the system
  font, so regenerating them on another OS can change the bytes, though not the meaning.
- **Demo names are clearly labelled:** "Demo Event A/B", "Alice (Demo)", "Budi (Demo)" and
  "citra-demo" (deliberately not in `photographers.yaml`). Alice's Instagram handle is the
  made-up placeholder `alice.demo.placeholder`. Every story starts with "Demo content".
- **Which case lives where** (each `photos.yaml` has comments too): Day 1 has no `index.md`
  (title and date are derived) and contains the sideways `EXIF Orientation 6` image and an
  OffsetTimeOriginal image. Day 2 has the node-date fallback, a `photos.yaml` date with a
  time, a bare-file-name key and the hidden photo. Day 3 has `index.md` photographer credit
  for loose photos (the unlisted `citra-demo`) and a wrong camera clock (an intentional
  warning). Event B is flat, has no `index.md` date (derived from photos) and uses
  `sort: filename`. It holds WhatsApp-style files without EXIF: photographer and date from
  `photos.yaml`, a missing date, a missing photographer (intentional warnings), and the image
  with GPS tags. Formats: `.jpg`, `.JPG`, `.jpeg`, `.png`, `.webp`.
- `photos:check` on the demo content reports **0 errors and 4 intentional warnings**: one
  out-of-range camera date, two missing dates and one missing photographer.
- `.gitattributes` marks image extensions as binary in any letter case (cameras write `.JPG`).

### Open items for later milestones

- Validation messages do not yet mention `npm run photos:prep` (milestone 5) or the README's
  "Size limits" section (milestone 6), because neither exists yet; a maintainer following
  such a hint today would hit "Missing script". When those land, add them to the
  `large-image` and `content-too-large` messages in `src/lib/content/validate.ts`.

## Milestone 3 — Pages

### Design

- **Visual system:** documented in [DESIGN.md](../DESIGN.md) (TRD §6.1 requires the colour
  roles to be recorded there). It is an "Experience" surface in the impeccable skill's terms:
  the photograph leads and the interface recedes. The look is Instagram-like minimalism on
  the decided warm off-white base `#FAF8F4`, with near-black text `#1C1B19`, brand blue for
  everything interactive, and no shadows, boxes or ornament. The brief pins this look, so no
  concept/variant round was run, and the build path was code-led.
- **Muted text `#5F5A52`** (6.45:1 on the page, 5.86:1 on the sunken surface) is the only
  secondary text colour. Every text pair passes WCAG AA, most pass AAA. The measured
  contrast table is in DESIGN.md.
- **Red and yellow:** red is not used in milestone 3, because it fails AA for small text on
  the light base (3.45:1). Yellow appears only as a fill behind near-black text (the
  dev-only "Draft" badge, 9.17:1) and as the logo's dot.
- **Logo placeholder:** a "P" monogram in off-white on a blue rounded square, with a yellow
  dot. It is drawn as SVG paths, so it does not depend on fonts. The milestone 1 favicon (a
  pine tree) was replaced with the same mark, so the tab icon matches the header. Both are
  placeholders until the association supplies a logo (PRODUCT.md).
- **Home heading** is "Photo albums" with "2 events · 46 photos" below it. The site name is
  already in the header, so the page needs its own h1.
- **Card covers are decorative (`alt=""`).** The title link already names the card, so a
  screen reader would otherwise hear the photo's alt text and then the title on every card.
- **Section and photo headings:** an album page labels its blocks "Sections" and "Photos"
  (h2). When a node only has photos, the "Photos" heading is visually hidden but kept for
  screen-reader navigation.
- **Sibling navigation** is centred: "‹ Day 1 · Day 3 ›" (TRD §6.3). For events, the siblings
  are the other events (newest first). Screen readers hear "Previous section: Day 1" or
  "Next event: …". Draft siblings appear only in dev.
- **Empty states:** "No albums yet" on the home page, and "No photos here yet" on an album
  with neither sections nor photos. The 404 page uses the same component.
- **Dates use `<time datetime>`** only for single days. A range has no single
  machine-readable value, so it is plain text.
- **Meta description:** the first 160 characters of the story as plain text. Without a
  story it falls back to a summary ("11 photos from Day 2, 19 Sep 2026. Pinus Community, …").
- **Header is not sticky.** The pages are short, and a sticky bar takes space from photos on
  phones.

### Markdown stories

- **Astro's own Markdown pipeline renders `index.md` stories, with no new dependency.** A
  content collection (`src/content.config.ts`) uses a small custom loader. It takes the story
  text that the content engine already extracted and passes it to the loader context's
  `renderMarkdown()`, and pages render it with `render()`. The `glob()` loader was not used:
  it would parse the same frontmatter a second time with a different YAML parser and
  different error messages, and it would not know about drafts, numeric prefixes or slug
  paths. This way `schemas.ts` stays the only parser of `index.md`.
- In `astro dev` the loader re-renders when any `index.md` changes (checked by hand: an
  edited story appeared without a restart).
- Raw HTML in a story is rendered as written, which is Astro's Markdown default. Stories
  come from committee members with write access to the repository, so they are trusted.

### Image pipeline

- **`src/lib/images.ts` is the one Astro-dependent module in `src/lib`** (the task placed it
  there). It maps the content engine's photos to Astro images with an eager
  `import.meta.glob`. The extension pattern uses bracket classes (`*.[jJ][pP][gG]`, …), so
  `.JPG` and other letter cases match, just as they do in the content engine. All sizes and
  loading rules live in the pure, unit-tested `src/lib/image-sizes.ts`.
- **Derivatives (all WebP, generated by sharp at Astro's default quality):**
  - Grid thumbnails are square centre crops at **240 and 480 px**. TRD §7 asks for "about
    480 px". The extra 240 px size was added after Lighthouse flagged 480 px files on
    ~120 CSS-px phone tiles. A source smaller than 480 px uses its short side.
  - Viewer images use **800/1200/1600/2000 px**. Widths larger than the source are dropped,
    and the source width itself is added (for example `[800, 1200, 1500]` for a 1500 px
    source), so nothing is upscaled. The plain `src` is the 1200 px image, or the largest
    one below it. They use `fit: 'cover'`: Astro derives each srcset entry's height from
    the rounded aspect ratio of the `src` size, and `cover` outputs exactly that box (at
    most 1 px of rounding is cropped). `contain` (sharp `inside`) produced files 1 px
    narrower than their `w` descriptor for every 3:2 landscape photo (26 files).
  - Card covers are **4:3 crops at 400/600/800/1200 px**, limited to the largest 4:3 crop
    the source holds.
  - The `sizes` attributes are derived from the same breakpoints as the CSS.
- **Width and height come from the content engine** (EXIF-upright sizes), never from Astro's
  image object. See "Privacy" below for why.
- **Orientation is verified.** The demo image stored sideways (`IMG_0004.jpg`, stored
  1600×1067, EXIF Orientation 6) produces 480×480 and 240×240 thumbnails, an 800×1200 and a
  1067×1600 viewer image, and viewer data with width 1067 and height 1600. All of them were
  checked visually: the "UP" arrow points up. Astro's sharp service calls `rotate()` before
  resizing. Since the review, `verify:dist` checks this on every build (check (d) below), so
  a regression in auto-rotation fails CI instead of relying on a visual check.
- **Loading (TRD §6.4: lazy below the fold).** Images are eager only when they start in the
  first viewport of a phone:
  - A photo grid loads its first **5 tiles** (the first row at 5 columns) eagerly with
    `fetchpriority="high"`. Every tile is the same size, so any of them can be the LCP
    element; Lighthouse flagged the 5th tile when only the first 3 were high priority. On
    phones this covers the first row and two tiles of the second.
  - Section cards: the first two covers are high priority and the first four (two rows on a
    phone) are eager.
  - Event cards on the home page: the first cover is high priority and the first **two** are
    eager. That is what a 360×640 phone shows (the second card starts at about 530 px). On
    wider screens, the rest of the first row is lazy but in view, so it still loads at once.
  - **Story length decides "near the top".** A grid or card list counts as near the top only
    when the story above it has at most **400 plain-text characters**
    (`SHORT_STORY_MAX_CHARS` in `image-sizes.ts`). Measured on the demo pages at 360×640:
    without a story the first row starts near 300 px, and a story adds about 0.65 px per
    character. A story of "a few short paragraphs" (TRD §4.3) goes past this, and everything
    below it is then lazy. A grid below section cards is always lazy.
- **The stylesheet is inlined** (`build.inlineStylesheets: 'always'`). The whole stylesheet
  is about 6 KB (2.3 KB gzipped), and Lighthouse reported it as the only render-blocking
  request.

### Privacy: no originals or metadata in `dist/`

- **Finding:** Astro 7 **does** emit the original file of every eagerly imported image into
  `dist/_astro/`. After generating derivatives, it deletes only the originals that a page
  transformed and that nothing else referenced. Images that no page transforms are left in
  place, and these include **hidden photos and draft photos in a production build**. The
  first build published `DSC_0106.jpg`, the hidden demo photo, byte-for-byte with its EXIF.
  Astro also keeps an original whenever code reads any property of the imported image
  object (its proxy tracks property reads).
- **Mechanism:**
  1. `images.ts` passes imported images **only** to `getImage()` and never reads their
     properties.
  2. A small local integration, `src/integrations/remove-source-copies.ts`, runs at
     `astro:build:done`. It deletes every file in `dist/` that is byte-identical to an image
     under `src/albums` (files are compared by size first, then SHA-256), and it logs what it
     removed. This is the cleanest supported option. The `astro:build:done` hook is public
     API, and the deletion has to happen after Astro's image generation, which reads the
     emitted originals from `dist/`. Leaving hidden or draft photos out of the import would
     need a custom virtual module and dev-mode invalidation. The integration also covers any
     future case where Astro's sharp service passes an image through unchanged (for example
     a format sharp cannot decode). If a page linked to a deleted file, the link check in
     `verify:dist` would report the broken link.
- **`npm run verify:dist`** (`scripts/verify-dist.ts`, run after the build, and in CI after
  the Build step with the same `BASE_PATH`) fails when any of these is true:
  - (a) An image in `dist/` has EXIF, XMP or IPTC metadata or a GPS position. This is
    checked with a structural scan of JPEG segments and PNG/WebP chunks
    (`src/lib/build-checks/image-metadata.ts`), plus `exifr` for the formats exifr can read. exifr
    cannot read WebP, which is the format of every derivative, so the structural scan is the
    main check.
  - (b) A file in `dist/` is byte-identical to a source image.
  - (c) An internal `href`, `src`, `srcset`, `poster`, a CSS `url()`, or a `src`/`srcset`
    inside the inline viewer JSON does not resolve to a file in `dist/`, or does not start
    with the configured base path. Because every stylesheet is inlined, `url()`s are read
    from inline `<style>` blocks and `style` attributes as well as from any `.css` file.
  - (d) A published image does not have the size the page claims for it. An `<img>`'s `src`
    must be exactly `width`×`height`, and every `Nw` srcset entry (in `<img>` tags and in
    the viewer JSON) must be N px wide with the declared aspect ratio (±1 px of height
    rounding). A file whose sides are swapped is reported as sideways. This turns TRD §12.3
    "portrait phone photos display upright" into an automated check. The claims are
    extracted by the pure `src/lib/build-checks/image-claims.ts`, and the files are measured
    with sharp, which is already a dependency. Restoring the old `contain` fit made this
    check report the 26 one-pixel-narrow viewer files.
  - Each check was proven by hand to fail: a copied original, a WebP with EXIF, a link
    without the base, and a missing JSON image all made it exit 1. It passes for the default
    base and for `BASE_PATH=/`.
- **`BASE_PATH` parsing moved to `src/lib/config.ts`** (`normaliseBasePath`, `BASE_PATH`), so
  `astro.config.mjs` and `verify:dist` always agree on the base.

### Code structure (after review)

- **`src/lib/build-checks/` and `tests/build-checks/`** hold the dist checks. They were first
  named `dist/`, which the unanchored `dist/` rule in `.gitignore` silently ignored. They
  would never have been committed, and CI would have failed. The folders were renamed, and
  the ignore rule is now anchored to the build output (`/dist/`).
- **`NodeMeta.astro`** renders the "date · N photos · N sections" line for the album page
  header and both card sizes, so it is no longer copied between them.
- **`.page-title`** in `global.css` is the one h1 style for every page. The 404 page's h1
  (inside its empty-state panel) uses it too, so it matches the other page titles.
- **`THEME_COLOR`** in `src/lib/config.ts` feeds `<meta name="theme-color">`. A unit test
  checks that it equals `--color-bg`, so the two cannot drift apart. The tile hover veil is
  now the token `--color-tile-veil`, so no component uses a raw colour.
- **`scripts/cli.ts`** holds the terminal colours and a `runCli()` wrapper shared by
  `photos:check` and `verify:dist`. An unexpected failure prints one readable line and
  exits 1 instead of a stack trace.
- **Footer:** the takedown line no longer has a 65ch cap and uses `text-wrap: balance`. On
  desktop it now reads as one sentence instead of leaving "and we'll remove it." alone on a
  line.
- **Design-hook ignore:** `.impeccable/config.json` ignores the `broken-image` rule in
  `src/lib/build-checks/image-claims.ts` only. The flagged line is the regex `/<img\b[^>]*>/`
  in a build checker, not markup.

### Viewer preparation (milestone 4)

- Each tile is a `<button type="button">` holding the thumbnail. Its accessible name is the
  image's alt text, and it carries `data-photo-slug` and `data-index`. The buttons do nothing
  yet.
- The album page embeds `<script type="application/json" id="viewer-data">` with
  `{ context, photos[] }`. `context` is "Day 1 · Demo Event A". Each photo has `slug`,
  `image {src, srcset, sizes, width, height}`, `alt`, and, only when present, `caption`,
  `photographer {name, initials, instagram?, instagramUrl?}` and `date {label, iso}`. Absent
  values are left out, never stored as empty strings. The JSON is escaped (`<`, `>`, `&`,
  U+2028 and U+2029), so a caption cannot break out of the script element. The builder is
  `src/lib/viewer-data.ts`, which is pure and tested.
- The viewer images are generated now, so the image pipeline, the privacy check and the link
  check already cover them.

### Pages

- **Album routes:** `getStaticPaths` produces every published node at any depth. Pages look
  the node up again by its slug path, instead of receiving it as a prop, so `astro dev` shows
  fresh content after a file changes.
- **Drafts in dev:** pages pass `includeDrafts: import.meta.env.DEV`. This was checked by
  hand: a temporary draft event appeared in `astro dev` with a yellow "Draft" badge and its
  rendered story, and the temporary folder was then deleted.

### Verification results (this milestone)

- No horizontal scroll at 360, 768 and 1280 px on the home page, Demo Event A, Day 1, Demo
  Event B and the 404 page (Playwright, Chrome). Screenshots were reviewed and kept outside
  the repository.
- Keyboard order: skip link → home link → breadcrumbs → photo tiles. Focus rings are visible
  on tiles, cards and the skip link.
- Lighthouse (mobile) on Day 1, Demo Event A and the home page: Performance 100,
  Accessibility 100, Best Practices 100, CLS 0. SEO scores 63 **only** because of the
  deliberate default `noindex` (`is-crawlable`). With `ALLOW_INDEXING=true`, SEO is 100.
  TRD §11 asks for SEO ≥ 90. That conflicts with the `noindex` default (TRD §10, §14 #5), and
  the default wins until the committee decides to allow indexing. This is listed under "Open
  conflicts with the TRD" at the top of this file. A re-run after the review fixes (home and
  Demo Event A) was unchanged: Performance, Accessibility and Best Practices 100, CLS 0, LCP
  0.9 s.
