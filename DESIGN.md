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
| `--brand-blue` | `#334E97` | Official brand blue. Links, buttons, focus ring, logo ground |
| `--brand-red` | `#EF4C2B` | Official brand red. Accent only (see rules below) |
| `--brand-yellow` | `#F1B244` | Official brand yellow. Accent only: logo dot, "Draft" badge fill |
| `--color-bg` | `#FAF8F4` | Page background (warm off-white) |
| `--color-surface-sunken` | `#F1EDE5` | Image placeholders while loading, empty states, inline code |
| `--color-text` | `#1C1B19` | Body text, headings, card titles |
| `--color-text-muted` | `#5F5A52` | Meta lines (dates, counts), descriptor, footer, current breadcrumb |
| `--color-border` | `#E4DFD5` | Hairlines (header, footer, sibling nav). Decorative only |
| `--color-link` | `#334E97` | Links and interactive text (= brand blue) |
| `--color-link-hover` | `#263B75` | Link hover |
| `--color-on-accent` | `#FAF8F4` | Text and icons on brand blue |
| `--color-focus` | `#334E97` | Focus ring on the light page |
| `--color-selection` | `#DCE2F2` | Text selection background (blue tint) |
| `--color-tile-veil` | `rgb(0 0 0 / 0.14)` | Hover veil over a grid tile. Decorative, never behind text |
| `--color-viewer-bg` | `#000000` | Post viewer photo area (milestone 4) |
| `--color-viewer-text` | `#FFFFFF` | Text on the viewer's black |
| `--color-viewer-text-muted` | `#B8B2A7` | Secondary text on black |
| `--color-viewer-focus` | `#A9B9E6` | Focus ring on black (brand blue is too dark there) |

### Measured contrast (WCAG 2.x)

Every text/background pair the site uses, measured with the WCAG relative-luminance formula:

| Foreground | Background | Ratio | Use | Result |
|---|---|---|---|---|
| `#1C1B19` text | `#FAF8F4` bg | 16.23:1 | Body, headings | AAA |
| `#1C1B19` text | `#F1EDE5` sunken | 14.74:1 | Empty-state headings, inline code in stories | AAA |
| `#5F5A52` muted | `#FAF8F4` bg | 6.45:1 | Meta lines, footer | AA (AAA for large) |
| `#5F5A52` muted | `#F1EDE5` sunken | 5.86:1 | Empty-state text, placeholder icons | AA |
| `#334E97` link | `#FAF8F4` bg | 7.39:1 | Links, breadcrumbs, sibling nav | AAA |
| `#334E97` link | `#F1EDE5` sunken | 6.72:1 | Link inside an empty state | AA |
| `#263B75` hover | `#FAF8F4` bg | 10.08:1 | Link hover | AAA |
| `#FAF8F4` on-accent | `#334E97` blue | 7.39:1 | Skip link, logo letter, future buttons | AAA |
| `#1C1B19` text | `#F1B244` yellow | 9.17:1 | "Draft" badge (dev only) | AAA |
| `#1C1B19` text | `#DCE2F2` selection | 13.28:1 | Selected text | AAA |
| `#FFFFFF` | `#000000` viewer | 21.00:1 | Viewer text (M4) | AAA |
| `#B8B2A7` | `#000000` viewer | 9.96:1 | Viewer secondary text (M4) | AAA |
| `#334E97` focus ring | `#FAF8F4` bg | 7.39:1 | Focus indicator (non-text, needs 3:1) | Pass |
| `#A9B9E6` focus ring | `#000000` viewer | 10.77:1 | Focus indicator on black (M4) | Pass |
| `#8F897E` scrollbar thumb | `#FAF8F4` bg | 3.27:1 | Scrollbar (non-text, needs 3:1) | Pass |

### Rules for the brand accents

- **Blue** is the only interactive colour. Anything blue can be clicked or is focused.
- **Red `#EF4C2B`** measures 3.45:1 on the page background. That passes only for large text
  (24 px, or 18.66 px bold) and for graphics. It must **never** be used for small text on the
  light base. On near-black it reaches 4.70:1 and on black 5.74:1. It has no role in
  milestone 3. Reserve it for rare emphasis such as a future "new" marker, at large size or
  as a graphic.
- **Yellow `#F1B244`** measures 1.77:1 on the page background, so it is **never** text or a
  thin line on the light base. It is used as a fill behind near-black text (9.17:1) and as
  the logo's dot. On black it reaches 11.19:1.
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
  160 ms and `--duration-slow` is 480 ms.
- The one authored moment: on hover, a card's cover zooms in by 3% while its title turns blue
  and underlined on hover. Grid tiles get a 14% dark veil on hover.
- Everything starts from a visible state, and nothing animates in on load.
- `prefers-reduced-motion: reduce` sets all transitions and animations to near zero (TRD §6.6).

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
| Logo mark | `src/components/LogoMark.astro`, `public/favicon.svg` | **Placeholder** until the association supplies a logo: a "P" monogram in off-white on a blue rounded square, with a yellow dot. Decorative (`aria-hidden`), since the site title names the link |
| Site header | `SiteHeader.astro` | Mark, "Pinus Community" (700) and the descriptor (muted, 13 px) form a single home link. A hairline sits below. Not sticky |
| Site footer | `SiteFooter.astro` | Takedown line with a mailto link (TRD §10), then the organisation name and descriptor. Stacked on phones; a single row from 900 px. The takedown line has no width cap and uses `text-wrap: balance`, so it reads as one sentence on desktop and never leaves a short tail |
| Skip link | `BaseLayout.astro` | "Skip to content": hidden above the viewport until focused, then shown in blue |
| Breadcrumbs | `Breadcrumbs.astro` | `nav[aria-label=Breadcrumb] > ol`. Blue links separated by muted chevrons. The current page is muted text with `aria-current="page"` |
| Node meta | `NodeMeta.astro` | The "date · N photos · N sections" line shared by album page headers and cards; `<time datetime>` only for single days |
| Album card | `AlbumCard.astro`, `AlbumCardList.astro` | 4:3 cover (radius 10), title, then meta "date · N photos · N sections". The title link is stretched over the whole card, and the cover has `alt=""` because the title already names the link. Event cards use 1/2/3 columns; section cards use 2/3/4 |
| Photo grid | `PhotoGrid.astro` | Square tiles in 3/4/5 columns with 3 px gaps, edge to edge on phones. Each tile is a `<button>` named by the photo's alt text, with `data-photo-slug` and `data-index`. The viewer data is embedded as JSON (`#viewer-data`) |
| Sibling nav | `SiblingNav.astro` | "‹ Day 1 · Day 3 ›", centred below a hairline. Screen readers hear "Previous section: Day 1". A side without a sibling is left out |
| Empty state | `EmptyState.astro` | Sunken panel with an outline photo pictogram, a heading and one plain sentence. Used for "No albums yet", "No photos here yet" and the 404 page. When it carries the page's h1 (404), the heading uses the shared `.page-title` style so it matches every other page title |
| Draft badge | `DraftBadge.astro` | Yellow pill with near-black text. It only appears in `npm run dev`, because drafts are not published |
| Icons | `ChevronIcon.astro`, `ImageIcon.astro` | Drawn SVG with a 1.5–1.75 px round stroke in `currentColor`. Decorative |

### Post viewer (milestone 4)

The photo area is black (`--color-viewer-bg`, a binding product constraint). Text uses
`--color-viewer-text` and `--color-viewer-text-muted`, and focus uses
`--color-viewer-focus`, because brand blue measures only 2.68:1 on black and fails as a focus
indicator there. The details panel follows the Instagram post layout (TRD §6.5): the avatar
circle with initials, then the name (a blue link only when an Instagram handle exists), the
date, the caption, and the counter.

## Images

- Grid thumbnails are 240 and 480 px square WebP crops.
- Card covers are 4:3 WebP crops at 400, 600, 800 and 1200 px.
- Viewer images are WebP at 800, 1200, 1600 and 2000 px, never upscaled.
- All derivatives are generated by `src/lib/images.ts` (the sizes come from
  `src/lib/image-sizes.ts`), with EXIF stripped and orientation applied.
- While an image loads, its placeholder is the sunken surface colour. It reserves the final
  aspect ratio, so the layout does not shift.
