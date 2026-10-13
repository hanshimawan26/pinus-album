# Design

Visual system of the Pinus Community photo album. Product context lives in
[PRODUCT.md](PRODUCT.md) and the spec in [docs/TRD.md](docs/TRD.md). The tokens are defined
once, as CSS custom properties, in [src/styles/global.css](src/styles/global.css); components
use only those tokens.

## Direction

- **Surface mode: Experience.** This is a gallery. The photograph leads and the interface
  recedes. The look is Instagram-like clean minimalism: a quiet warm off-white page,
  near-black type in the platform's own UI face, square photo grids with hairline gaps, and
  no boxes, shadows or ornament around content.
- **Colour strategy: restrained.** Neutrals carry the page. Brand blue does the interactive
  work (links, buttons, focus). Red and yellow are rare accents. The only large field of
  colour is the photos themselves.
- **The scene:** a student on a phone, often outdoors or in a lit hall, opening a link from a
  group chat. A light page reads well in daylight and lets colourful event photos stand out.
  The post viewer (milestone 4) switches to black, so each photo gets a cinema-like focus.

## Colour

### Tokens

| Token | Value | Role |
|---|---|---|
| `--brand-blue` | `#334E97` | Official brand blue. Links, buttons, focus ring |
| `--brand-red` | `#EF4C2B` | Official brand red. Accent only (see rules below) |
| `--brand-yellow` | `#F1B244` | Official brand yellow. Accent only: "Draft" badge fill |
| `--color-bg` | `#FAF8F4` | Page background (warm off-white) |
| `--color-surface-sunken` | `#F1EDE5` | Image placeholders while loading, empty states, inline code |
| `--color-text` | `#1C1B19` | Body text, headings, card titles |
| `--color-text-muted` | `#5F5A52` | Meta lines (dates, counts), descriptor, footer, current breadcrumb |
| `--color-border` | `#E4DFD5` | Hairlines (footer, sibling nav). Decorative only |
| `--color-link` | `#334E97` | Links and interactive text (= brand blue) |
| `--color-link-hover` | `#263B75` | Link hover |
| `--color-on-accent` | `#FAF8F4` | Text and icons on brand blue |
| `--color-focus` | `#334E97` | Focus ring on the light page |
| `--color-selection` | `#DCE2F2` | Text selection background (blue tint) |
| `--color-tile-veil` | `rgb(0 0 0 / 0.14)` | Hover veil over a grid tile. Decorative, never behind text |
| `--color-viewer-bg` | `#000000` | Post viewer photo area (milestone 4) |
| `--color-viewer-text` | `#FFFFFF` | Text on the viewer's black |
| `--color-viewer-focus` | `#A9B9E6` | Focus ring on black (brand blue is too dark there) |
| `--color-viewer-scrim` | `rgb(0 0 0 / 0.82)` | Viewer backdrop over the page |
| `--color-viewer-control` | `rgb(0 0 0 / 0.55)` | Arrow buttons and counter pill over the photo (hover: `-hover`, 78%) |
| `--color-viewer-control-edge` | `rgb(255 255 255 / 0.3)` | Edge of those controls; spinner track |

### Measured contrast (WCAG 2.x)

Every text/background pair the site uses, measured with the WCAG relative-luminance formula:

| Foreground | Background | Ratio | Use | Result |
|---|---|---|---|---|
| `#1C1B19` text | `#FAF8F4` bg | 16.23:1 | Body, headings | AAA |
| `#1C1B19` text | `#F1EDE5` sunken | 14.74:1 | Empty-state headings, inline code in stories, "Hidden" badge (preview only) | AAA |
| `#5F5A52` muted | `#FAF8F4` bg | 6.45:1 | Meta lines, footer | AA (AAA for large) |
| `#5F5A52` muted | `#F1EDE5` sunken | 5.86:1 | Empty-state text, placeholder icons | AA |
| `#334E97` link | `#FAF8F4` bg | 7.39:1 | Links, breadcrumbs, sibling nav | AAA |
| `#334E97` link | `#F1EDE5` sunken | 6.72:1 | Link inside an empty state | AA |
| `#263B75` hover | `#FAF8F4` bg | 10.08:1 | Link hover | AAA |
| `#FAF8F4` on-accent | `#334E97` blue | 7.39:1 | Skip link, logo letter, future buttons | AAA |
| `#1C1B19` text | `#F1B244` yellow | 9.17:1 | "Draft" badge (dev only) | AAA |
| `#1C1B19` text | `#DCE2F2` selection | 13.28:1 | Selected text | AAA |
| `#FFFFFF` | `#000000` viewer | 21.00:1 | Viewer error text on the photo area | AAA |
| `#FFFFFF` | 55% black over white (≈`#737373`) | 4.74:1 | Viewer counter pill and arrows, worst case | AA |
| `#334E97` focus ring | `#FAF8F4` bg | 7.39:1 | Focus indicator (non-text, needs 3:1) | Pass |
| `#A9B9E6` focus ring | `#000000` viewer | 10.77:1 | Focus indicator on black (M4) | Pass |
| `#8F897E` scrollbar thumb | `#FAF8F4` bg | 3.27:1 | Scrollbar (non-text, needs 3:1) | Pass |

### Rules for the brand accents

- **Blue** is the only interactive colour. Anything blue can be clicked or is focused.
  Icon-only buttons that are recognised by their shape (the viewer's ✕ and the arrows over the
  photo) use the text colour, or white on black, instead. Blue is too dark on black (2.68:1).
- **Red `#EF4C2B`** measures 3.45:1 on the page background. That passes only for large text
  (24 px, or 18.66 px bold) and for graphics. It must **never** be used for small text on the
  light base. On near-black it reaches 4.70:1 and on black 5.74:1. Its one use is the
  header stripe (a graphic). Reserve it otherwise for rare emphasis such as a future "new"
  marker, at large size or as a graphic.
- **Yellow `#F1B244`** measures 1.77:1 on the page background, so it is **never** text or a
  thin line on the light base. It is used as a fill behind near-black text (9.17:1). On black
  it reaches 11.19:1. The exception is the header stripe, where it sits beside red and blue as
  one decorative band (3 px) and carries no meaning on its own.
- The photos carry the colour. The interface does not compete with them by tinting
  surfaces.

## Typography

System font stack (TRD §6.1): `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue",
"Noto Sans", Arial, sans-serif`, followed by the platform emoji fonts, because captions use
emoji. Each phone shows its own native face, which keeps the UI familiar and costs no font
download.

| Token | Size | Use |
|---|---|---|
| `--text-display` | `clamp(1.75rem, 1.3rem + 1.9vw, 2.75rem)` (28 → 44 px) | Page titles (h1), weight 700, tracking −0.025em, line-height 1.15 |
| `--text-lg` | 1.1875rem (19 px) | Event card titles, block headings ("Sections"), weight 650 |
| `--text-base` | 1rem (16 px) | Body, story, section-card titles, sibling nav (600) |
| `--text-md` | 0.9375rem (15 px) | Breadcrumbs, event card meta |
| `--text-sm` | 0.8125rem (13 px) | Descriptor, footer, section-card meta, badge |

The body line-height is 1.6, headings use 1.3, and the story is capped at `65ch`. Every
page title uses the shared `.page-title` class in `global.css`, the 404 page included.
Headings use `text-wrap: balance` and paragraphs use `pretty`.

## Spacing, layout, shape

- **Spacing scale (4 px base):** `--space-1` 4 · `-2` 8 · `-3` 12 · `-4` 16 · `-5` 24 ·
  `-6` 32 · `-7` 48 · `-8` 64 · `-9` 96 px. Items within a group sit close together, groups
  are separated generously, and there is more space above a heading than below it.
- **Content width:** `--content-max` 70rem (1120 px) plus `--gutter` on each side. The gutter
  is 16 px on phones, 24 px from 600 px and 32 px from 1100 px.
- **Breakpoints:** 600 px, 900 px and 1100 px. They are mirrored in
  `src/lib/image-sizes.ts`, so the `sizes` attributes match the CSS.
- **Radii:** `--radius-sm` 6 px (skip link, small controls), `--radius-md` 10 px (card covers,
  empty states), `--radius-full` (badges). Photo grid tiles are square with no rounding, like
  a profile grid.
- **Grid gap:** `--grid-gap` 3 px (TRD §6.4: 2–4 px).
- **Depth:** none. There are no shadows. Separation comes from whitespace and 1 px hairlines.

## Motion

- `--ease-out` is `cubic-bezier(0.16, 1, 0.3, 1)` (exponential ease-out). `--duration-fast` is
  160 ms, `--duration-slow` is 480 ms, and `--duration-settle` (220 ms) is a swiped viewer
  photo springing back.
- The one authored moment: on hover, a card's cover zooms in by 3% while its title turns blue
  and underlined on hover. Grid tiles get a 14% dark veil on hover.
- Everything starts from a visible state, and nothing animates in on load.
- The post viewer's overlay fades in over 160 ms; nothing else in it animates on its own (see
  "Post viewer").
- `prefers-reduced-motion: reduce` sets all transitions and animations to near zero, including
  on `::backdrop`, which `*` does not match (TRD §6.6).

## Browser surfaces

- Text selection uses a blue tint (`--color-selection`). `accent-color` is brand blue.
- Links have a 1 px underline at a 0.2em offset, which becomes 2 px on hover.
- `:focus-visible` shows a 2 px brand-blue outline at a 3 px offset. On photo tiles, the ring
  is drawn inside the tile as 3 px blue with a 2 px off-white inner line, so it shows on dark
  and on light photos alike.
- `theme-color` is the page background (`THEME_COLOR` in `src/lib/config.ts`; a unit test keeps it equal to `--color-bg`). The scrollbar uses a warm grey thumb.

## Components

| Component | File | Notes |
|---|---|---|
| Logo mark | `src/components/LogoMark.astro`, `public/logo.svg` | The association's logo (a ring in navy, red and yellow around three figures), shown at 34 px as an `<img>` with fixed width and height. The browser-tab icon is `public/favicon.svg`: the same logo on a white disc, so it stays visible on dark tab bars. Decorative (`alt=""`), since the site title names the link. The logo's own colours are used as supplied, not the brand tokens |
| Site header | `SiteHeader.astro` | Mark, "Pinus Community" (700) and the descriptor (muted, 13 px) form a single home link. Below it, a 3 px stripe in the three brand colours, a third each (red, blue, yellow; `border-image` with hard stops). Not sticky |
| Site footer | `SiteFooter.astro` | Takedown line with a mailto link (TRD §10), then the organisation name and descriptor. Stacked on phones; a single row from 900 px. The takedown line has no width cap and uses `text-wrap: balance`, so it reads as one sentence on desktop and never leaves a short tail |
| Skip link | `BaseLayout.astro` | "Skip to content": hidden above the viewport until focused, then shown in blue |
| Breadcrumbs | `Breadcrumbs.astro` | `nav[aria-label=Breadcrumb] > ol`. Blue links separated by muted chevrons. The current page is muted text with `aria-current="page"` |
| Node meta | `NodeMeta.astro`, `.meta` in `global.css` | The "date · N photos · N sections" line shared by album page headers, cards and the home intro; the album page also shows the `venue` after the date ("18–20 Sep 2026 · UTown Green · 35 photos"), cards never do. `<time datetime>` only for single days. Each item carries its own muted "·" (1.25em wide, centred); the strip left of the line is clipped, so a line that wraps on a narrow card never starts with a dot. Each item is a flex row (dot, then text), so an item that wraps on its own (a long venue) continues after its dot, not inside the clipped strip. The dot is decorative (empty alternative text), so screen readers skip it |
| Album card | `AlbumCard.astro`, `AlbumCardList.astro` | 4:3 cover (radius 10), title, then meta "date · N photos · N sections". The title link is stretched over the whole card (its overlay sits at `z-index: 1` inside an isolated card, above the clipped meta line), and the cover has `alt=""` because the title already names the link. Event cards use 1/2/3 columns; section cards use 2/3/4 |
| Photo grid | `PhotoGrid.astro` | Square tiles in 3/4/5 columns with 3 px gaps, edge to edge on phones. Each tile is a `<button>` named by the photo's alt text, with `data-index` and `aria-haspopup="dialog"`. The viewer data is embedded as JSON (`#viewer-data`), and the grid renders the post viewer |
| Post viewer | `PostViewer.astro`, `src/scripts/viewer/` | See "Post viewer" below |
| Sibling nav | `SiblingNav.astro` | "‹ Day 1 · Day 3 ›", centred below a hairline. Screen readers hear "Previous section: Day 1". A side without a sibling is left out |
| Empty state | `EmptyState.astro` | Sunken panel with an outline photo pictogram, a heading and one plain sentence. Used for "No albums yet", "No photos here yet" and the 404 page. When it carries the page's h1 (404), the heading uses the shared `.page-title` style so it matches every other page title |
| Status badge | `StatusBadge.astro` | Pills after a title. "Draft": yellow with near-black text, only in `npm run dev` (drafts are not published). "Hidden": sunken fill with a hairline border and near-black text, only in `npm run dev:hidden` (SHOW_HIDDEN; hidden albums are never published). A real space before the badge keeps the heading's accessible name readable: "Demo Event A Hidden" |
| Icons | `ChevronIcon.astro`, `CloseIcon.astro`, `ImageIcon.astro` | Drawn SVG with a 1.5–1.75 px round stroke in `currentColor`. Decorative |

### Post viewer (milestone 4)

`PostViewer.astro` (markup and styles) with its behaviour in `src/scripts/viewer/`. It follows the
Instagram post layout (TRD §6.5). It is a native `<dialog>` opened with `showModal()`.

- **Photo area is black** (`--color-viewer-bg`, a binding product constraint). The details
  (header, caption, counter) sit on the page's own off-white `--color-bg`, like an Instagram
  post. That keeps the name link brand blue (7.39:1). On black, blue would measure only
  2.68:1.
- **Below 600 px (phones):** full screen. The header shows the avatar circle (initials, sunken
  fill, hairline ring), the name (650 weight; a blue underlined link only with an Instagram
  handle), the date below it in muted 13 px, and ✕ on the right (44 px target). The photo
  spans the full width at its own aspect ratio, capped at `100dvh − 12rem` so the caption
  stays in view. A taller photo is letterboxed on black. The caption is 15 px, keeps its line
  breaks (`white-space: pre-line`) and is clamped to 3 lines, with a blue "more"/"less"
  button that appears only when the caption really overflows. The counter is muted and right
  aligned below.
- **600–899 px:** the same column, 36 rem wide, centred on the backdrop with `--radius-md`
  corners. The visible backdrop can be clicked to close the viewer.
- **900 px and up:** the photo on black on the left, the 340 px details panel
  (`--viewer-panel`) on the right. The panel has a hairline under its header, the **whole**
  caption (no clamp; the panel scrolls) and the context line ("Day 1 · Demo Event A", muted
  13 px). The counter sits in the photo's bottom-right corner on a dark pill. The frame is
  inset `clamp(16px, 3vw, 48px)` from the window edges, so the backdrop shows around it.
- **Controls over the photo** (prev/next arrows, the counter pill) are white on
  `--color-viewer-control` (55% black) with a 30% white edge. Over a pure-white photo that
  backdrop is at worst #737373, which gives white **4.74:1**. They are not blue, because blue
  fails on black. Arrows are 40 px (44 px from 900 px) and hidden at either end (no wrap).
  The ✕ is a near-black icon button on the light header. Icons are drawn SVG (`CloseIcon`,
  `ChevronIcon`), never glyphs.
- **A single photo** (an album with one photo) reads like a single Instagram post: no arrows
  (both ends), no counter ("1 / 1" says nothing), and the dialog is named "Photo by …"
  instead of "Photo 1 of 1 by …" (milestone 5).
- **Focus:** on the light header, the normal blue ring (drawn inside the ✕ so the frame never
  clips it). On the photo, a `--color-viewer-focus` ring with a black halo on both sides, so
  it shows over dark and light photos alike.
- **Backdrop:** `--color-viewer-scrim` (82% black) over the page.
- **States:** a photo that is not yet loaded keeps its reserved shape on black. After 300 ms
  a quiet 2 px ring appears, so a fast photo never shows it, and the photo fades in over
  160 ms when it arrives. A photo that fails shows "This photo didn't load. Check your
  connection and try again." with a **Try again** button.
- **Motion:** the overlay fades in over 160 ms (`@starting-style`). Closing is instant.
  Moving between photos never animates, because it is frequent and often keyboard driven.
  During a swipe the photo follows the finger, resists past either end, and settles back over
  `--duration-settle` (220 ms) when the swipe is not taken. Under `prefers-reduced-motion` all
  of this, the backdrop fade included, is effectively instant (global rule, which also
  matches `::backdrop`).

| Foreground | Background | Ratio | Use |
|---|---|---|---|
| `#FFFFFF` | control over white photo (≈`#737373`) | 4.74:1 | Counter pill, arrows (worst case) |
| `#FFFFFF` | `#000000` | 21.00:1 | Error message, "Try again" (outlined, on the black stage: the photo is hidden in the error state), spinner |
| `#1C1B19` | `#F1EDE5` avatar | 14.74:1 | Initials |
| `#334E97` | `#FAF8F4` | 7.39:1 | Name link, "more" |

## Images

- Grid thumbnails are 240 and 480 px square WebP crops.
- Card covers are 4:3 WebP crops at 400, 600, 800 and 1200 px.
- Viewer images are WebP at 800, 1200, 1600 and 2000 px, never upscaled.
- All derivatives are generated by `src/lib/images.ts` (the sizes come from
  `src/lib/image-sizes.ts`), with EXIF stripped and orientation applied.
- While an image loads, its placeholder is the sunken surface colour. It reserves the final
  aspect ratio, so the layout does not shift.

## Edge cases (milestone 5, checked at 360, 768 and 1280 px)

- **Long titles and links wrap** everywhere (page title, breadcrumbs, cards, sibling
  navigation, viewer name and caption), including unbroken words of 60+ characters, through
  the body's `overflow-wrap: break-word` and the viewer's `overflow-wrap: anywhere`. No
  component needed its own rule.
- **An album with no photos** has a card with the sunken placeholder and image icon and no
  meta line (no date, no "0 photos"), and its page shows the "No photos here yet" panel.
- **An album with photos and sections** shows the section cards first, then its own photos
  under a visible "Photos" heading.
- **Draft sections** carry the yellow "Draft" badge in `npm run dev` and do not exist in the
  published site. **Hidden albums** (`hidden: true`) exist in neither, except in
  `npm run dev:hidden`, where they carry the grey "Hidden" badge.

## Polish and handover (milestone 6)

- **Checked at 320, 360, 768, 1280 and 1440 px**, and with a 200% root font size: no
  horizontal scroll and no clipped content on any page or in the viewer. The committed
  Playwright suite (`npm run test:e2e`) repeats the 360/768/1280 px check on every kind of
  page.
- **One defect fixed:** a meta line that wrapped started its second line with "·" (see Node
  meta above).
- **Lighthouse (mobile):** Accessibility 100 on the home page, an event and a section page;
  every text pair in the contrast tables above is unchanged.
- **Design detector:** `cream-palette` on the page background is an intentional exception.
  The warm off-white `#FAF8F4` was chosen deliberately (docs/DECISIONS.md, "Design"), over
  white (too clinical next to the brand colours) and a stronger beige (tints the photos).
- **Red `#EF4C2B` still has no UI role.** The rules above still apply: if a future "new" marker
  or similar uses it, it must be large text (≥ 24 px, or 18.66 px bold) or a graphic.
