# TRD — Digital Photo Album

**Pinus Community** — Indonesian Students Association at NUS · Proof of Concept

> **Naming:** "Pinus Community" is the primary name (site title, header, footer, page titles). "Indonesian Students Association at NUS" is the subheading/descriptor.
Version 0.2 · 13 Oct 2026 (0.1: 12 Oct 2026)

> **Where things are decided.** This TRD says *what the site does*: routes, content model,
> behaviour, validation, privacy. [PRODUCT.md](../PRODUCT.md) says *who it is for and why*,
> and holds the binding brand commitments. [DESIGN.md](../DESIGN.md) says *how it looks*:
> every visual decision (colours, type, spacing, components) lives there, not here.
> [DECISIONS.md](DECISIONS.md) records how and why things were built the way they were.
> When two documents disagree, the owner of the topic wins, and the other is fixed.

---

## 0. Instructions for Claude Code

Read this whole document before writing code.

- Build the **P0** scope milestone by milestone (§13). Commit after each milestone and leave the project in a runnable state.
- Where this document gives a **default**, use it and keep going. Do not stop to ask about anything listed in §14. Record the assumption in `docs/DECISIONS.md` instead.
- Do **not** ask for or commit real photos. Generate placeholder demo content (§12).
- Prefer fewer dependencies. No UI framework (React, Vue, etc.) unless a milestone cannot be met without one.
- The acceptance checklist in §12.3 is the definition of done.

Priority tags: **P0** = must have for the POC, **P1** = should have, **P2** = later.

---

## 1. Overview

A static website that works as a digital photo album for the association's events. Visitors browse events, open an event to see its photos, and view each photo in an Instagram-style viewer that shows who took it, when, and an optional caption. Events can be split into sub-sections (for example Event A → Day 1, Day 2, Day 3, Day 4), so content is organised as a **tree**.

### Goals

| ID | Goal |
|----|------|
| G1 | Browse events as a tree: event → section → (optional) sub-section |
| G2 | Every photo can show **caption** (optional), **photographer**, and **date**, presented like an Instagram post |
| G3 | Adding an event means adding a folder of photos plus a small text file. No code changes |
| G4 | Free, static hosting on GitHub Pages |
| G5 | Mobile-first and fast. Most visitors will be on phones |
| G6 | Maintainable by a non-developer committee, with clear handover docs |

### Non-goals (POC)

User accounts, upload through the website, comments or likes, search, a CMS, member-only access, video.

### Users

- **Visitors**: members, alumni, friends, sponsors. Mostly mobile.
- **Maintainers**: committee members, possibly non-technical. They add folders and edit YAML/Markdown, locally or in the GitHub web UI.

---

## 2. Scale assumptions

- Today: 4 events, 10–50 photos each. Growing by a few events per year.
- Design target: 30 events / 1,500 photos without structural changes.
- Sub-sections are common (about 3–5 per multi-day event).

---

## 3. Tech stack (decisions)

| Concern | Decision | Notes |
|---|---|---|
| Framework | **Astro** (latest stable), TypeScript | Static output, content-focused, ships almost no JS by default |
| Styling | Plain CSS with CSS variables (Astro scoped styles) | No Tailwind or UI kit needed |
| Images | `astro:assets` (sharp) | Build-time resize, WebP, responsive `srcset` |
| EXIF reading | `exifr` (build time only) | For `DateTimeOriginal` (P0) and IPTC/XMP (P1) |
| YAML / validation | `yaml` + `zod` | Clear error messages with file paths |
| Photo viewer | **PhotoSwipe v5** with a custom caption/info UI element, or a custom `<dialog>` viewer if that is simpler to get the IG-style layout right | JS loaded only on pages that have photos |
| Unit tests | Vitest | |
| E2E tests | Playwright (P1) | |
| Hosting | GitHub Pages via GitHub Actions | Repo lives under a GitHub **organization** (§8) |

Not Next.js or React: the site is fully static content, and Next's image optimisation does not work on GitHub Pages.

---

## 4. Content model

### 4.1 Directory layout

All content lives in `src/albums/`. Example:

```
src/albums/
├─ photographers.yaml                 # optional: display names, links
├─ pergelaran-2026/                   # EVENT (top-level node)
│  ├─ index.md                        # title, dates, cover, short story
│  ├─ day-1/                          # SECTION (child node)
│  │  ├─ index.md
│  │  ├─ photos.yaml                  # captions + per-photo overrides
│  │  ├─ @andi-pratama/               # photographer folder (NOT a node)
│  │  │  ├─ IMG_0012.jpg
│  │  │  └─ IMG_0013.jpg
│  │  └─ @sari-wijaya/
│  │     └─ DSC_0441.jpg
│  ├─ day-2/
│  ├─ day-3/
│  └─ day-4/
└─ welcome-picnic-2026/               # event with no sections
   ├─ index.md
   ├─ photos.yaml
   └─ @andi-pratama/
      └─ IMG_0201.jpg
```

### 4.2 Rules

1. A **node** is any folder under `src/albums/` that does not start with `@` or `.`. Nodes form the tree. Depth is unlimited; the UI is designed for three levels.
2. A node may contain photos, child nodes, or both.
3. A folder named `@<slug>` is a **photographer folder**. It is metadata only: it never appears in URLs or navigation. Everything after the `@` is the photographer slug. Photographer folders sit directly inside a node.
4. Photos placed directly in a node folder (no `@` folder) are allowed. Their photographer then comes from `photos.yaml` or `index.md`.
5. Supported image formats: `.jpg`, `.jpeg`, `.png`, `.webp` (case-insensitive). HEIC is flagged by `photos:check` with a message to convert it.
6. Folder names are slugs. An optional numeric prefix (`01-day-1`) controls ordering and is stripped from the URL slug.
7. If a node has no `index.md`, derive the title from the folder name ("day-1" becomes "Day 1") and the date from its earliest photo.

### 4.3 `index.md` (per node)

```markdown
---
title: "Pergelaran 2026"
date: 2026-09-20                  # single date, or start of a range
endDate: 2026-09-23               # optional
venue: "UTown Green"               # optional; shown on the album page and the home page
cover: day-1/@andi-pratama/IMG_0012.jpg   # optional; path relative to this folder; default = first photo
highlights:                       # optional; photos for the home page, best first (paths like cover)
  - day-1/@andi-pratama/IMG_0012.jpg
featured: true                    # optional, events only; pins this event to the home page hero
photographer: andi-pratama        # optional default credit for photos in this node with no other credit
order: 1                          # optional; see ordering below
sort: filename                    # optional; photo order by file name instead of date
draft: false                      # true = shown in dev, excluded from production build
hidden: false                     # true = not published (kept for reference); see README
---

A few short paragraphs of Markdown telling the story of the event or section.
```

Ordering defaults:
- Top-level events: newest `date` first.
- Sections and sub-sections: `order`, else numeric folder prefix, else `date`, else name (all ascending).
- Photos within a node: by resolved date/time ascending, then by path. A node can set `sort: filename` to override.

### 4.4 `photos.yaml` (per node, optional)

Holds captions and per-photo overrides. Only photos that need something are listed.

```yaml
# Keys are paths relative to THIS folder, e.g. "@andi-pratama/IMG_0012.jpg".
# A bare filename is accepted only if it is unambiguous within this node.
"@andi-pratama/IMG_0012.jpg":
  caption: "Opening dance by the committee 💃"
"@sari-wijaya/DSC_0441.jpg":
  caption: "Group photo with the ambassador"
  date: 2026-09-20                # optional: overrides EXIF date
  photographer: sari-wijaya       # optional: overrides folder credit
  alt: "Group of students in batik"   # optional: overrides generated alt text
  hidden: false                   # true = excluded from the site without deleting the file
```

Why paths and not bare filenames: two photographers' cameras will both produce `IMG_0001.jpg`.

Caption format: plain text (emoji and line breaks allowed), HTML-escaped on output.

### 4.5 `photographers.yaml` (optional)

```yaml
andi-pratama:
  name: "Andi Pratama"
  instagram: "andi.pratama"       # optional; links to the profile
sari-wijaya:
  name: "Sari Wijaya"
```

If a slug is missing, fall back to the slug title-cased ("andi-pratama" becomes "Andi Pratama").

### 4.6 Metadata resolution (per photo)

Highest priority first. The first source that has a value wins.

| Field | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| Caption | `photos.yaml` `caption` | **P1:** embedded IPTC/XMP description | none | none |
| Photographer | `photos.yaml` `photographer` | `@folder` name | nearest ancestor `index.md` `photographer` | **P1:** embedded Artist / By-line, else none |
| Date | `photos.yaml` `date` | EXIF `DateTimeOriginal` | nearest ancestor `index.md` `date` | none |
| Alt text | `photos.yaml` `alt` | caption | generated: "Photo from {node title} by {photographer}" | |
| Hidden | `photos.yaml` `hidden` | | | |

Details:
- EXIF dates have no time zone. Interpret them as `Asia/Singapore` (configurable via `TIMEZONE`). Display the date only, for example "20 Sep 2026".
- If a field resolves to nothing, the UI omits it entirely (no "Unknown", no empty boxes).
- Many photos arrive via WhatsApp or Telegram, which strips EXIF. That is why the date falls back to the node's `date`, and why `photos.yaml` can override it.

### 4.7 Photo identity

Each photo gets a stable slug for deep links: the path relative to its node, without extension, with `@` removed and `/` replaced by `-`, then slugified (for example `andi-pratama-img-0012`). It must be unique within a node and must not depend on the photo's position, so adding photos never breaks existing links.

### 4.8 Validation

Implemented as a build-time loader plus the `photos:check` script (§9).

- **Errors (fail the build):** invalid YAML or frontmatter; `photos.yaml` key that matches no file; ambiguous bare filename in `photos.yaml`; duplicate photo slug in a node; duplicate sibling node slugs; unsupported image format; `cover` or a `highlights` entry that does not exist.
- **Warnings (printed, do not fail):** photo with no photographer; photo with no date; EXIF date outside the node's own `date`/`endDate` range (usually a wrong camera clock); image over 2 MB; node with no cover; a `cover` or `highlights` photo that is not shown (hidden, or in a draft or hidden section: a takedown must never fail the build); `featured: true` on a section or on more than one event; GPS position in a master file; total content size over 700 MB.

---

## 5. Site map and routes

| Route | Page | Priority |
|---|---|---|
| `/` | Home: landing blocks, then every top-level event (§6.2) | P0 (landing: after the POC) |
| `/albums/<...path>/` | Album page for any node at any depth (`[...path]` static route) | P0 |
| `/albums/<...path>/#<photo-slug>` | Same page, viewer open on that photo | P0 |
| `/photographers/` and `/photographers/<slug>/` | All photos by one photographer, across events | P2 |
| `/404.html` | Not found | P0 |

URLs are lowercase slugs with a trailing slash. All internal links must go through a helper that uses `import.meta.env.BASE_URL` so the site works under a sub-path (§8).

---

## 6. UI / UX requirements

### 6.1 Global (P0)

- Header: logo placeholder, site title "Pinus Community" (descriptor "Indonesian Students Association at NUS"), link home. Footer: org name, contact/takedown line (§10).
- Mobile-first. Must work from 360 px to 1440 px wide with no horizontal scroll.
- Visual design: specified in [DESIGN.md](../DESIGN.md), which owns every visual decision. The binding constraints it must respect come from [PRODUCT.md](../PRODUCT.md): the default (light) theme has a neutral base (white, black or beige) with the official brand colours (blue `#334E97`, red `#EF4C2B`, yellow `#F1B244`) as accents, exposed as CSS variables; the viewer's photo area is black; all text meets WCAG AA.
- Dark theme via `prefers-color-scheme` (built after the POC, see DESIGN.md "Night theme"). Fonts are self-hosted (no request to a font service, §10).

### 6.2 Home (P0; landing blocks after the POC)

Top to bottom (visual design: DESIGN.md "Landing"; the rules are in `src/lib/landing.ts`):

1. **Hero:** the featured event — the event with `featured: true`, else the newest event with photos — with its cover, title, date, venue, the start of its story, counts (photos, photographers, sections), and links to its album and its "All photos" page. The cover's photographer is named.
2. **Chapters:** one per section of the featured event (an event without sections gets one "highlights" chapter), each with up to five photos.
3. **Photo spotlight:** one photo of the featured event (its first `highlights` photo; else its first captioned photo; else a photo from the middle), with its caption, photographer and date.
4. **More events:** the next three events, one chapter each.
5. **All events (P0):** grid of event cards, newest first. Each card: cover image, title, date (or date range), and photo count (including all descendant sections). Cards for events with sections also show the section count.
6. **Share banner:** invites members to send their photos to the committee (the contact email, §10).

Chapter photos are the album's `highlights` (§4.3), else picked automatically: the cover, then photos spread evenly over the album in date order. No photo appears twice on the page. Every landing photo links to itself in its album (`/albums/<path>/#<photo-slug>`), so the home page needs no JavaScript. With no photos at all, the page shows "Photo albums" and an empty state.

### 6.3 Album page (P0)

For any node, top to bottom:

1. **Breadcrumbs:** Home › Pergelaran 2026 › Day 2.
2. **Title and date(s).**
3. **Story:** rendered Markdown from `index.md`.
4. **Child section cards** (if any): cover, title, date, photo count. Example: Day 1–Day 4 cards on the Pergelaran page.
5. **Photo grid** (if the node has its own photos).
6. **Sibling navigation** at the bottom: "‹ Day 1 · Day 3 ›".
7. **P1:** "View all N photos" on a node with children, showing every descendant photo in one grid, in date order.
8. **P1:** photographer filter chips above the grid.

A node with both photos and children shows the section cards first, then its own photos.

### 6.4 Photo grid (P0)

- Instagram-profile style: square-cropped thumbnails, 3 columns on mobile, 4–5 on desktop, 2–4 px gaps.
- Lazy-loaded below the fold. Square tiles reserve space, so no layout shift.
- Each tile is a button that opens the viewer.

### 6.5 Post viewer (P0, core feature)

Opens as an overlay when a tile is clicked. The design mimics an Instagram post.

Mobile (portrait):

```
┌──────────────────────┐
│ 📷 Andi Pratama    ✕ │   camera outline = "photo by"
│    20 Sep 2026       │
├──────────────────────┤
│                      │   black area fills the screen height
│      [ photo ]       │   photo centred, original aspect ratio
│                      │   (no arrows on touch phones: swipe)
├──────────────────────┤
│ Opening dance by the │   caption: 3-line clamp + "more"
│ committee 💃         │
│              3 / 24  │
└──────────────────────┘
```

Desktop (≥ 900 px): photo on the left on a black background, details panel (about 340 px) on the right with the same header and caption, plus prev/next arrows over the photo.

```
┌────────────────────────────────────────┬─────────────────┐
│                                        │ 📷 Andi Pratama  │
│              [ photo ]                 │    20 Sep 2026   │
│   ‹                                ›   │ ──────────────── │
│                                        │ Opening dance... │
│                                 3 / 24 │ Day 1 · Pergel.. │
└────────────────────────────────────────┴─────────────────┘
```

Behaviour:
- Navigates through the photos of the current grid, in displayed order.
- Prev/next via buttons, **← / →** keys, and touch swipe. Close via ✕, **Esc**, backdrop click, or browser Back.
- Counter "n / total".
- Preloads the next and previous images.
- Photographer line: a camera outline icon plus the name (read as "Photo by Name"), so the name is not mistaken for someone pictured. If the photographer has an `instagram` handle, the name links to it (opens in a new tab with `rel="noopener noreferrer"`).
- On touch phones the prev/next buttons are hidden visually (swipe instead) but remain available to screen readers and keyboards.
- Caption area is **not rendered** when there is no caption. Photographer or date rows are not rendered when absent.
- **Deep links:** opening a photo updates the URL hash to `#<photo-slug>` (replace state while navigating). Loading a URL with a valid hash opens the viewer on that photo. An invalid hash is ignored.
- Focus is trapped inside the viewer while open, and returns to the originating tile on close.
- **P2:** share button (Web Share API / copy link). Download is deliberately not offered in the POC.

### 6.6 Accessibility (P0)

Semantic landmarks, real `alt` text (§4.6), visible focus rings, `role="dialog"` with `aria-modal` and labelled title for the viewer, `prefers-reduced-motion` respected, text contrast at WCAG AA or better.

---

## 7. Image pipeline

- **Source images:** committed to the repo as web-ready masters: long edge ≤ 2400 px, JPEG quality about 85, ideally under 1 MB each. Raw phone or camera originals must not be committed (`photos:prep`, §9, does the downscaling and keeps the EXIF date and orientation).
- **Build outputs:**
  - Grid thumbnail: square crop, about 480 px, WebP.
  - Viewer image: responsive `srcset` at 800 / 1200 / 1600 / 2000 px, WebP.
- **Orientation:** honour EXIF orientation. Portrait phone photos must display upright in the grid and the viewer.
- **Privacy:** published derivatives must contain **no EXIF or GPS data**. EXIF is read at build time only. Add a test that verifies this.
- **P1:** low-quality placeholder (dominant colour or tiny blur) behind each image while it loads.
- **Build time:** cache Astro's image cache in CI (`node_modules/.astro`) so rebuilds stay fast. Target ≤ 5 minutes cold for 500 photos.
- **Git LFS: not allowed.** GitHub Pages does not serve LFS objects.
- **Size limits to document in the README:** GitHub recommends repos under about 1 GB, and a Pages site is limited to 1 GB. At about 0.7 MB per photo, 1,500 photos is roughly 1 GB, so this design has headroom for the POC but not unlimited growth. The README should note Cloudflare Pages or R2 as the escape hatch.

---

## 8. Build and deploy

- **Config:** `site` and `base` come from environment variables (`SITE_URL`, `BASE_PATH`), defaulting to a project site at `/<repo-name>/`. A custom domain (`public/CNAME`) is optional and simply sets `BASE_PATH=/`.
- **CI:** GitHub Actions workflow, triggered on push to `main` and manually:
  1. Checkout, set up Node LTS, `npm ci`
  2. Restore image cache
  3. `npm run photos:check` (errors fail the workflow)
  4. `npm run build`
  5. Upload and deploy with `actions/upload-pages-artifact` and `actions/deploy-pages` (or `withastro/action`)
- The README states the one-time repo setting: Settings → Pages → Source: **GitHub Actions**.
- **Ownership:** create the repo under a GitHub organization for the association, not a personal account. At least two admins. Committees change every year.

---

## 9. Authoring workflow and tooling

### Scripts (`package.json`)

| Script | What it does | Priority |
|---|---|---|
| `dev` / `build` / `preview` | Standard Astro commands | P0 |
| `photos:check` | Runs all §4.8 validations. Exit code 1 on errors, prints warnings | P0 |
| `photos:prep -- <folder>` | Resizes JPEGs in the folder to the §7 limits in place, keeping orientation and the EXIF date. Idempotent | P0 |
| `photos:init -- <node-folder>` | Adds a `photos.yaml` entry (empty caption) for every photo that does not have one yet. Never overwrites existing entries | P1 |
| `demo:images` | Generates the placeholder demo images (§12) | P0 |

### README: "Add a new event" (P0)

The README must walk a non-developer through, with screenshots or exact commands:

1. Create a folder in `src/albums/` named after the event (lowercase, dashes).
2. Add `index.md` with title, date and story.
3. For sections (Day 1, Day 2…), make a sub-folder per section with its own `index.md`.
4. Put photos in `@photographer-name` folders (create one folder per photographer).
5. Run `npm run photos:prep -- <folder>` to shrink photos.
6. Add captions in `photos.yaml` (run `photos:init` to generate the skeleton).
7. Add new photographers to `photographers.yaml` (optional).
8. Commit and push to `main`. The site updates in a few minutes.

It must also cover: how to hide a photo, how to fix a wrong date, how to take a photo down (including the git-history caveat in §10), and the handover checklist (org ownership, Pages setting, who has admin).

---

## 10. Privacy and safety

- The site is public and shows identifiable people. Footer line (P0): "Not comfortable with a photo? Contact [email] and we'll remove it." The org sets the contact address and response time.
- `hidden: true` or deleting the file removes a photo from the live site. **Git history still contains the original**, and a public repo exposes it. The README must say this plainly. If a full purge is needed, it requires rewriting history (documented as a manual step).
- Strip EXIF/GPS from published images (§7).
- `<meta name="robots">` is controlled by `ALLOW_INDEXING`. **Default: `noindex`** until the committee decides otherwise.
- No analytics or cookies in the POC. Privacy-friendly analytics (Plausible, Umami) are P2.
- Instagram links are only rendered when a photographer has listed a handle.

---

## 11. Non-functional requirements

- **Performance (demo album page, mobile Lighthouse):** Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90. CLS < 0.1.
- **JS budget:** viewer JavaScript loaded only on pages with photos, ≤ 60 KB gzipped.
- **Browsers:** last 2 versions of Safari (iOS and macOS), Chrome, Firefox, Edge.
- **Maintainability:** the metadata-resolution and tree-building code lives in plain, unit-tested TypeScript modules under `src/lib/`, separate from the page templates.

---

## 12. Demo content and testing

### 12.1 Demo content (P0)

So the POC runs without real photos, generate placeholders with `npm run demo:images`:

- `demo-event-a/` with three sections (`day-1`, `day-2`, `day-3`), two photographer folders (`@alice-demo`, `@budi-demo`), 10–20 images per section.
- `demo-event-b/` flat (no sections), 12 images.
- Placeholder images: coloured gradients with the filename drawn on them. Include portrait and landscape shapes, some with an EXIF `DateTimeOriginal` and some without, plus one image with a rotated EXIF orientation.
- Cover every metadata case: caption present and absent, photographer from folder, from `photos.yaml`, from `index.md`, and missing; date from `photos.yaml`, from EXIF, from node fallback, and missing; one hidden photo.
- The README says the `demo-*` folders can be deleted once real content exists.

### 12.2 Tests

- **Unit (Vitest, P0):** slug generation, tree building and ordering, `photos.yaml` key resolution (including the ambiguous bare-filename error), the full precedence table in §4.6, and each validation rule in §4.8.
- **E2E (Playwright, P1):** open an album, click a photo, confirm photographer, date and caption show; navigate with arrow keys; close with Esc and check focus returns; open a deep link; check a section page via breadcrumbs.

### 12.3 Acceptance checklist (P0)

- [ ] `npm ci && npm run build` succeeds from a clean checkout. `npm run dev` serves the demo content.
- [ ] Home lists every top-level event with cover, title, date and photo count.
- [ ] An event with three sections shows section cards. Each section page shows its grid. Breadcrumbs work at every level.
- [ ] Adding a new folder with `index.md` and photos adds a new event after a rebuild, with no code changes.
- [ ] Clicking a tile opens the viewer showing photographer, date and caption. No empty caption, photographer or date rows when the data is absent.
- [ ] Next/prev work via buttons, arrow keys and swipe. Esc, ✕ and Back close the viewer, and focus returns to the tile.
- [ ] A deep link `…/#<photo-slug>` opens that photo. An invalid hash is ignored.
- [ ] Metadata precedence matches §4.6, proven by unit tests.
- [ ] Portrait phone photos display upright in the grid and the viewer.
- [ ] Published images contain no EXIF or GPS data (automated check).
- [ ] The site works under a sub-path `base` with no broken links or images.
- [ ] The GitHub Actions workflow deploys to Pages on push to `main`, and `photos:check` errors fail the build.
- [ ] Layout is correct at 360, 768 and 1280 px with no horizontal scroll.
- [ ] Lighthouse targets in §11 are met on the demo album page.
- [ ] The README lets a non-developer add an event, add a caption, and credit a photographer.

---

## 13. Milestones

Work in this order. Each milestone ends with a commit and a short note on how to verify it.

1. **Scaffold and deploy.** Astro + TypeScript project, base-path config, GitHub Actions workflow, a "hello" page live on Pages.
2. **Content engine.** Folder walker, tree building, metadata resolution (§4.6), validation (§4.8), `photos:check`, demo-image generator and demo content, unit tests.
3. **Pages.** Home, album page at any depth, breadcrumbs, section cards, sibling nav, photo grid, image pipeline (thumbnails and responsive sizes, orientation, EXIF stripping).
4. **Post viewer.** Overlay with the mobile and desktop layouts, keyboard/swipe/focus handling, deep links.
5. **Authoring tools.** `photos:prep`, `photos:init`, empty-state and edge-case handling (no caption, no photographer, no date, hidden photos, draft nodes).
6. **Polish and handover.** Accessibility and performance pass, `noindex` handling, footer takedown line, README and `docs/DECISIONS.md`, final deploy.

**P1 backlog (after the above):** "view all photos" aggregate grid, photographer filter chips, IPTC/XMP caption and photographer fallback, low-quality image placeholders, dark mode, Open Graph tags (cover image per album), Playwright E2E.

**Status (13 Oct 2026):** P0 milestones 1–6 are done. Done from P1: "view all photos", photographer filter chips, dark mode, Open Graph tags, Playwright E2E, and the IPTC/XMP caption and photographer fallback (`embedded` sources). Added after the POC: the home page landing blocks (§6.2) and the photographer credit on saved viewer images. Open: low-quality image placeholders.

---

## 14. Assumptions and open questions

Claude Code: use the default and keep going. Record anything you assume in `docs/DECISIONS.md`.

| # | Question | Default assumed |
|---|---|---|
| 1 | What do the existing photo folders look like today (names, nesting)? | Per-event folders containing one folder per photographer. Adapt the `@` convention if the real structure differs |
| 2 | Language of the site UI | English only. Indonesian or bilingual support is P2 |
| 3 | Viewer style | Instagram-profile grid plus post-style overlay viewer (§6.4–6.5). A scrolling feed view is not built |
| 4 | Branding: org name, logo, colours | **Resolved:** name "Pinus Community" (descriptor "Indonesian Students Association at NUS"); official colours blue `#334E97`, red `#EF4C2B`, yellow `#F1B244`; official logo `public/logo.svg` |
| 5 | Public repo and search indexing | Public repo, `noindex` site |
| 6 | Custom domain | None. Use `github.io` |
| 7 | Contact and response time for photo takedown | **Resolved:** `kontakpinus@gmail.com` (repository variable `CONTACT_EMAIL` overrides it). Response time still open |
| 8 | Photographer credit style: full name or handle, link to Instagram? | Name from `photographers.yaml`, Instagram link optional |
| 9 | Who writes captions, and are they comfortable editing YAML? | Yes, via the README steps. A CMS such as Decap is P2 |
| 10 | Exact event dates and whether a section's date should override a photo's EXIF date | EXIF wins, and `photos:check` warns on out-of-range dates |

---

## 15. Future work (out of scope)

Photographer pages and cross-event search; member-only access (for example Cloudflare Access); a CMS for captions (Decap, TinaCMS); moving image storage to Cloudflare R2 if the repo outgrows GitHub limits; video; slideshow mode; Indonesian/English toggle; RSS feed; download-album-as-zip.