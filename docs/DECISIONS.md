# Decisions and assumptions

Assumptions made while building the POC from [TRD.md](TRD.md). Defaults from TRD §14 are
used unless noted. Each entry: what was decided, and why. Newest entries at the bottom of
each section.

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
