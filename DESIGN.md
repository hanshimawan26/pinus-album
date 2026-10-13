# Design

The visual system of the Pinus Community photo album: **how it looks**. Who it is for and the
binding brand commitments are in [PRODUCT.md](PRODUCT.md); what the site does (routes,
content, behaviour) is in [docs/TRD.md](docs/TRD.md); why things were built as they are is in
[docs/DECISIONS.md](docs/DECISIONS.md). The design reference this system grew from is
captured in [design-reference/DESIGN.md](design-reference/DESIGN.md).

The tokens are defined once, as CSS custom properties, in
[src/styles/global.css](src/styles/global.css). Components use only those tokens.

## How to use this design system

Rules for any new or changed UI. They are what keep the two themes, the contrast tables and
the photo-first look true.

1. **Tokens only.** Colours, type sizes, spacing, radii and motion come from `global.css`
   tokens. No raw colour in a component. A new colour needs a token, a Night value, and a
   measured contrast row for both themes (tables below).
2. **Never test the theme in a component.** Day and Night differ only in token values
   (`@media (prefers-color-scheme: dark)` in `global.css`). If a component needs a different
   colour on Night, it needs a token that changes.
3. **Type roles.** Headings (`h1`–`h4`) are Playfair Display automatically (`--font-display`);
   page titles use `.page-title`. Everything else is Plus Jakarta Sans. A small label above a
   heading is an **Eyebrow** (`Eyebrow.astro`), never hand-made uppercase text.
4. **Interactive = blue.** Links, buttons and focus use `--color-link` / `--color-accent` /
   `--color-focus`. Button-shaped links use the `.button` classes. Red and yellow are never
   small text on Day (rules below).
5. **Photos lead.** No shadows, no boxes around photos. Text sits on a photo only on a photo
   scrim (`--color-photo-scrim*`, the hero and landing tiles) and only in the solid part of
   it; captions and credits otherwise sit below photos.
6. **Absent data disappears** (TRD §4.6): no "Unknown", no empty rows. User text goes in with
   `textContent` / Astro expressions, never as HTML.
7. **Phones first.** Check 360 px, 768 px and 1280 px, both themes, no horizontal scroll.
   Images get `width`/`height` and a `sizes` from `src/lib/image-sizes.ts` that matches the
   CSS (a test keeps the viewer's in step).
8. **Measure, then document.** New text/background pairs get a row in the contrast tables;
   new components get a row in "Components"; a deliberate exception gets its reason here.

## Direction

- **Surface mode: Experience.** This is a gallery. The photograph leads and the interface
  recedes: a quiet page, square photo grids with hairline gaps, no shadows or ornament around
  content.
- **Editorial.** Event names and headings are set in a serif (Playfair Display), with small
  uppercase eyebrow labels above them, so each event reads like a catalogue entry. Text and
  controls are a geometric sans (Plus Jakarta Sans), so the UI stays plain.
- **Colour strategy: restrained.** Neutrals carry the page. Blue does the interactive work.
  Red and yellow are rare accents and the three brand colours appear together as a motif
  (the header stripe, the brand dots of an eyebrow). The large fields of colour are photos.
- **Day (default):** a student on a phone, often outdoors or in a lit hall, opening a link from
  a group chat. A warm off-white page reads well in daylight and lets colourful event photos
  stand out.
- **Night:** the same student in bed, phone in dark mode. The page becomes the reference's
  deep cobalt-dusk slate and the photos glow out of it, "a night festival hung in a gallery".
  Only colours change; layout, sizes and behaviour are identical.
- **The home page opens like an exhibition** (see "Home page"): one event large, its parts as
  chapters, then the archive. Album pages stay quiet and grid-first.
- **The post viewer is black** in both themes, so each photo gets a cinema-like focus.

## Colour

### Day tokens

| Token | Value | Role |
|---|---|---|
| `--brand-blue` | `#334E97` | Official brand blue. Links, buttons, focus ring (Day) |
| `--brand-red` | `#EF4C2B` | Official brand red. Accent only (rules below) |
| `--brand-yellow` | `#F1B244` | Official brand yellow. Accent only: "Draft" badge fill, eyebrow dot |
| `--color-bg` | `#FAF8F4` | Page background (warm off-white) |
| `--color-surface-sunken` | `#F1EDE5` | Image placeholders, empty states, chips, quiet buttons, share banner, inline code |
| `--color-text` | `#1C1B19` | Body text, headings, card titles |
| `--color-text-muted` | `#5F5A52` | Meta lines, eyebrows, descriptor, footer, current breadcrumb |
| `--color-border` | `#E4DFD5` | Hairlines (footer, sibling nav), chip hover fill. Decorative only |
| `--color-link` | `#334E97` | Links and interactive text (= brand blue) |
| `--color-link-hover` | `#263B75` | Link hover, primary button hover |
| `--color-accent` | `#334E97` | Fill of a pressed or primary control (primary button, pressed chip, skip link), the blue eyebrow dot |
| `--color-on-accent` | `#FAF8F4` | Text and icons on `--color-accent` |
| `--color-on-brand-yellow` | `#1C1B19` | Text on a yellow fill ("Draft" badge), in both themes |
| `--color-focus` | `#334E97` | Focus ring on the page |
| `--color-selection` | `#DCE2F2` | Text selection background (blue tint) |
| `--color-tile-veil` | `rgb(0 0 0 / 0.14)` | Hover veil over a grid tile. Decorative, never behind text |
| `--color-logo-plate`, `--logo-plate-inset` | `transparent`, `0px` | The header logo's plate: none on Day (see Night) |

### On a photo (both themes)

The home page hero and the landing tiles put text on a photo. These tokens do not change with
the theme, because the text sits on a dark scrim over the photo, not on the page.

| Token | Value | Role |
|---|---|---|
| `--color-on-photo` | `#FFFFFF` | Titles, numbers and credits on a photo scrim |
| `--color-on-photo-muted` | `rgb(255 255 255 / 0.85)` | Secondary text on a photo scrim |
| `--color-on-photo-credit` | `rgb(255 255 255 / 0.7)` | Photographer credits on a photo scrim: quieter than any other text there |
| `--color-photo-scrim` | `rgb(6 14 32 / 0.9)` | Bottom of a scrim (the reference's darkest navy) |
| `--color-photo-scrim-soft` | `rgb(6 14 32 / 0.78)` | The lightest a scrim gets **behind text** |
| `--color-photo-scrim-clear` | `rgb(6 14 32 / 0)` | Where a scrim fades out (above the text only) |
| `--color-photo-glass` | `rgb(255 255 255 / 0.14)` | Glass buttons and stat pills on a scrim (`-hover` 24%) |
| `--color-photo-glass-edge` | `rgb(255 255 255 / 0.3)` | Their 1 px inner edge |

Every scrim fades **only over empty padding above the text**; the text itself always sits on
at least `--color-photo-scrim-soft`. Measured over a pure-white photo (the worst case):

| Foreground | Background | Ratio | Use |
|---|---|---|---|
| `#FFFFFF` | soft scrim over white (≈`#3D4351`) | 9.91:1 | Hero title, tile credits |
| 85% white | soft scrim over white | 7.70:1 | Hero eyebrow, venue, story |
| 70% white | soft scrim over white | 5.83:1 | Photographer credits (hero cover, landing tiles) |
| `#FFFFFF` | glass pill on soft scrim (≈`#585D69`) | 6.57:1 | Stat numbers, glass button text |
| 85% white | glass pill on soft scrim | 5.30:1 | Stat labels |
| `#A9B9E6` focus ring | soft scrim over white | 5.08:1 | Focus inside the hero (non-text, needs 3:1) |

### Viewer tokens (both themes)

| Token | Value | Role |
|---|---|---|
| `--color-viewer-bg` | `#000000` | Post viewer photo area; spotlight and hero stage behind a photo |
| `--color-viewer-text` | `#FFFFFF` | Text on the viewer's black |
| `--color-viewer-focus` | `#A9B9E6` | Focus ring on black and on photo scrims (brand blue is too dark there) |
| `--color-viewer-scrim` | `rgb(0 0 0 / 0.82)` | Viewer backdrop over the page |
| `--color-viewer-control` | `rgb(0 0 0 / 0.55)` | Arrow buttons and counter pill over the photo (hover: `-hover`, 78%) |
| `--color-viewer-control-edge` | `rgb(255 255 255 / 0.3)` | Edge of those controls; spinner track |

### Day contrast (WCAG 2.x)

| Foreground | Background | Ratio | Use | Result |
|---|---|---|---|---|
| `#1C1B19` text | `#FAF8F4` bg | 16.23:1 | Body, headings | AAA |
| `#1C1B19` text | `#F1EDE5` sunken | 14.74:1 | Empty-state headings, inline code, "Hidden" badge, banner heading | AAA |
| `#5F5A52` muted | `#FAF8F4` bg | 6.45:1 | Meta lines, eyebrows, footer | AA |
| `#5F5A52` muted | `#F1EDE5` sunken | 5.86:1 | Empty-state text, placeholder icons | AA |
| `#5F5A52` muted | banner's blue corner (≈`#D6D7DA`) | 4.75:1 | Share banner text, worst corner | AA |
| `#334E97` link | `#FAF8F4` bg | 7.39:1 | Links, breadcrumbs, sibling nav, "View all" | AAA |
| `#334E97` link | `#F1EDE5` sunken | 6.72:1 | Link inside an empty state | AA |
| `#263B75` hover | `#FAF8F4` bg | 10.08:1 | Link hover | AAA |
| `#FAF8F4` on-accent | `#334E97` accent | 7.39:1 | Primary button, pressed chip, skip link | AAA |
| `#FAF8F4` on-accent | `#263B75` hover | 10.08:1 | Primary button hover | AAA |
| `#1C1B19` text | `#E4DFD5` border | 12.96:1 | Chip name / quiet button on hover | AAA |
| `#5F5A52` muted | `#E4DFD5` border | 5.15:1 | Chip count on hover | AA |
| `#1C1B19` text | `#F1B244` yellow | 9.17:1 | "Draft" badge (dev only) | AAA |
| `#1C1B19` text | `#DCE2F2` selection | 13.28:1 | Selected text | AAA |
| `#FFFFFF` | `#000000` viewer | 21.00:1 | Viewer error text on the photo area | AAA |
| `#FFFFFF` | 55% black over white (≈`#737373`) | 4.74:1 | Viewer counter pill and arrows, worst case | AA |
| `#334E97` focus ring | `#FAF8F4` bg | 7.39:1 | Focus indicator (non-text, needs 3:1) | Pass |
| `#A9B9E6` focus ring | `#000000` viewer | 10.77:1 | Focus indicator on black | Pass |
| `#EF4C2B` red dot | `#FAF8F4` bg | 3.45:1 | Eyebrow dot, header stripe (graphics, need 3:1) | Pass |
| `#8F897E` scrollbar thumb | `#FAF8F4` bg | 3.27:1 | Scrollbar (non-text, needs 3:1) | Pass |

### Rules for the brand accents

- **Blue** is the only interactive colour. Anything blue can be clicked or is focused, with
  one decorative exception: the blue eyebrow dot. Icon-only buttons recognised by their shape
  (the viewer's ✕ and the arrows over the photo) use the text colour, or white on black.
  Brand blue is too dark on black (2.68:1) and on Night (2.36:1), where its tint `#A9B9E6`
  takes over.
- **Red `#EF4C2B`** measures 3.45:1 on the Day page: large text (24 px, or 18.66 px bold) and
  graphics only, **never** small text on Day. Its uses: the header stripe, eyebrow dots, the
  share banner's glow.
- **Yellow `#F1B244`** measures 1.77:1 on the Day page, so it is **never** text or a thin line
  there. It is a fill behind near-black text (9.17:1). The header stripe, eyebrow dots and
  banner glow are decorative and carry no meaning on their own.
- The interface does not compete with the photos by tinting large surfaces. The share banner's
  glows (12–14% brand colour, fading out) are the one tinted surface.

### Night theme

`@media (prefers-color-scheme: dark)` in `global.css` redefines these colour tokens and
nothing else. The values are the reference's exhibition-slate palette, re-tuned around the
brand:

| Token | Night value | From the reference | Note |
|---|---|---|---|
| `--color-bg` | `#0B1326` | `background` | = `THEME_COLOR_DARK` in `src/lib/config.ts` (a unit test checks) |
| `--color-surface-sunken` | `#131B2E` | `surface-container-low` | A step *lighter* than the page here; the role is the same |
| `--color-border` | `#222A3D` | `surface-container-high` | Hairlines and hover fills; the reference has no borders, so it is one tone step |
| `--color-text` | `#DAE2FD` | `on-surface` | |
| `--color-text-muted` | `#A3ADC8` | (re-tuned) | The reference's `#E4BEBC` is a pinkish beige barely dimmer than the body text; a cool slate keeps the hierarchy |
| `--color-link`, `--color-accent`, `--color-focus` | `#A9B9E6` | `secondary` `#B0C7F1` | A light tint of brand blue (also the viewer's focus colour) |
| `--color-link-hover` | `#C9D4F2` | | |
| `--color-on-accent` | `#0B1326` | | Dark text on the light-blue fill |
| `--color-selection` | `#334A6D` | `secondary-container` | |
| `--color-logo-plate`, `--logo-plate-inset` | `#FFFFFF`, `3px` | | A white rounded rectangle behind the header logo, whose navy ring disappears on the dark page |
| scrollbar thumb | `#6B7593` | | 4.04:1 (non-text, needs 3:1) |

The photo and viewer tokens do not change. `color-scheme` is `dark`, so the browser's own
controls follow, and `<meta name="theme-color">` has a `media` twin for each theme.

| Foreground | Background | Ratio | Use | Result |
|---|---|---|---|---|
| `#DAE2FD` text | `#0B1326` bg | 14.34:1 | Body, headings | AAA |
| `#DAE2FD` text | `#131B2E` sunken | 13.30:1 | Empty-state headings, chips, banner heading | AAA |
| `#DAE2FD` text | `#222A3D` border | 11.10:1 | Chip name / quiet button on hover | AAA |
| `#A3ADC8` muted | `#0B1326` bg | 8.25:1 | Meta lines, eyebrows, footer | AAA |
| `#A3ADC8` muted | `#131B2E` sunken | 7.65:1 | Empty-state text, chip count | AAA |
| `#A3ADC8` muted | `#222A3D` border | 6.39:1 | Chip count on hover | AA |
| `#A3ADC8` muted | banner's blue corner (≈`#283148`) | 5.77:1 | Share banner text, worst corner | AA |
| `#A9B9E6` link | `#0B1326` bg | 9.49:1 | Links, breadcrumbs, sibling nav, viewer name link | AAA |
| `#A9B9E6` link | `#131B2E` sunken | 8.80:1 | Link inside an empty state | AAA |
| `#C9D4F2` hover | `#0B1326` bg | 12.49:1 | Link hover | AAA |
| `#0B1326` on-accent | `#A9B9E6` accent | 9.49:1 | Primary button, pressed chip, skip link | AAA |
| `#0B1326` on-accent | `#C9D4F2` hover | 12.49:1 | Primary button hover | AAA |
| `#1C1B19` | `#F1B244` yellow | 9.17:1 | "Draft" badge (dev only) | AAA |
| `#DAE2FD` text | `#334A6D` selection | 6.95:1 | Selected text | AA |
| `#A9B9E6` focus ring | `#0B1326` bg | 9.49:1 | Focus indicator | Pass |
| `#EF4C2B` brand red | `#0B1326` bg | 5.05:1 | (dots and stripe; not used for text) | AA |
| `#F1B244` brand yellow | `#0B1326` bg | 9.86:1 | (dots and stripe; not used for text) | AAA |

On Night, brand red and yellow would pass as text, but the same markup must work on Day, so
the Day rules apply.

## Typography

Two self-hosted variable fonts under the SIL Open Font License (`src/fonts/`, with their
`OFL-*.txt`), declared in `astro.config.mjs` (`fonts`, Astro's local provider) and placed in
the page head by `<Font>` in `BaseLayout`:

- **Plus Jakarta Sans** (`--font-sans`): all text and UI. Weights 200–800 in one file (27 KB,
  Latin), plus its italic (30 KB), downloaded only by a page with italic text (a story with
  *emphasis*, a spotlight caption).
- **Playfair Display** (`--font-display`): every `h1`–`h4` (a rule in `global.css`) and the
  site name in the header. Weights 400–900 (38 KB, Latin).

The normal faces are preloaded. `font-display: swap` shows text at once in the fallback, and
Astro generates **metric-matched fallbacks** (`size-adjust` on Arial and Times New Roman), so
the swap does not move the layout. Behind them come the system faces, then the emoji fonts,
because captions use emoji. A character outside the Latin subset falls back to the system face
for that character only. The photographer watermark has its own font (Inter, see "Images").

| Token | Size | Use |
|---|---|---|
| `--text-display` | `clamp(1.75rem, 1.2rem + 2.4vw, 3rem)` (28 → 48 px) | Page titles and the hero title: Playfair 700, tracking −0.02em, line-height 1.15 |
| (home block headings) | `clamp(1.5rem, 1.1rem + 1.4vw, 2.25rem)` (24 → 36 px) | "More from our events", "All events": Playfair 600 |
| `--text-xl` | 1.375rem (22 px) | Event card titles, chapter titles, block headings ("Sections"), spotlight and banner headings, story and empty-state headings: Playfair 600 |
| `--text-lg` | 1.125rem (18 px) | Section card titles (Playfair 600), the site name (Playfair 700) |
| `--text-base` | 1rem (16 px) | Body, story, sibling nav (600) |
| `--text-md` | 0.9375rem (15 px) | Breadcrumbs, card meta, filter chips, buttons, chapter stories |
| `--text-sm` | 0.8125rem (13 px) | Descriptor, footer, card meta, badges, tile credits, stat labels |
| `--text-label` | 0.75rem (12 px) | Eyebrows: 700, uppercase, tracking `--tracking-label` (0.08em); photo credits on the hero and on landing tiles from 600 px |
| `--text-xs` | 0.6875rem (11 px) | Photo credits on landing tiles on phones (kept small so they never compete with the photo) |

The body line-height is 1.6, headings use 1.3, and the story is capped at `65ch`. Every page
title uses the shared `.page-title` class, the 404 page included. Headings use
`text-wrap: balance` and paragraphs `pretty`.

### Eyebrow

`Eyebrow.astro`: a small uppercase line above a heading that says where the thing sits
("EVENT", "PINUS ORIENTATION", "SECTION 1 OF 4 · 3 AUG 2026 · NUS", "ALL PHOTOS"), led by a
brand-colour dot or the three brand dots. Muted text (white 85% on a photo). The text is
written in normal case and set in capitals by CSS, so screen readers read words, not letters;
the dots are decorative. Parts are joined with " · " and absent parts are left out.
Dot colours: red for events and the hero, blue for sections, yellow for "All photos" and the
spotlight; landing chapters take turns; the three dots mark the site-wide blocks.

## Spacing, layout, shape

- **Spacing scale (4 px base):** `--space-1` 4 · `-2` 8 · `-3` 12 · `-4` 16 · `-5` 24 ·
  `-6` 32 · `-7` 48 · `-8` 64 · `-9` 96 px. Items within a group sit close together, groups
  are separated generously, and there is more space above a heading than below it. Home page
  blocks are 96 px apart, chapters 64 px.
- **Content width:** `--content-max` 70rem (1120 px) plus `--gutter` on each side. The gutter
  is 16 px on phones, 24 px from 600 px and 32 px from 1100 px.
- **Breakpoints:** 600 px, 900 px and 1100 px, mirrored in `src/lib/image-sizes.ts`, so the
  `sizes` attributes match the CSS.
- **Radii:** `--radius-sm` 6 px (buttons, landing tiles, small controls), `--radius-md` 10 px
  (card covers, hero, spotlight stage, share banner, empty states), `--radius-full` (badges,
  chips, dots). Photo grid tiles are square with no rounding, like a profile grid.
- **Grid gap:** `--grid-gap` 3 px (TRD §6.4: 2–4 px). Landing mosaics use 8 px (12 px from
  900 px): fewer, larger photos.
- **Edge to edge on phones:** only the photo grid runs to the screen edges below 600 px.
  Every other block, the home page's hero and spotlight included, stays inside the page
  column at every width (an E2E test checks the landing blocks).
- **Depth:** none. No shadows. Separation comes from whitespace, 1 px hairlines and, on
  Night, tone steps.

## Motion

- `--ease-out` is `cubic-bezier(0.16, 1, 0.3, 1)` (exponential ease-out). `--duration-fast` is
  160 ms, `--duration-slow` is 480 ms, and `--duration-settle` (220 ms) is a swiped viewer
  photo springing back.
- Hover: a card's cover and a landing photo zoom in by 3% (480 ms); a card title turns blue
  and underlined; grid tiles get a 14% dark veil; buttons change fill over 160 ms.
- Everything starts from a visible state, and nothing animates in on load.
- The post viewer's overlay fades in over 160 ms; nothing else in it animates on its own.
- `prefers-reduced-motion: reduce` sets all transitions and animations to near zero, including
  on `::backdrop`, which `*` does not match (TRD §6.6).

## Browser surfaces

- Text selection uses a blue tint (`--color-selection`). `accent-color` is the theme's blue.
- Links have a 1 px underline at a 0.2em offset, which becomes 2 px on hover.
- `:focus-visible` shows a 2 px `--color-focus` outline at a 3 px offset. On photo tiles, the
  ring is drawn inside the tile as 3 px blue with a 2 px page-colour inner line, so it shows on
  dark and light photos alike. Inside the hero, rings use `--color-viewer-focus`.
- `theme-color` is the page background of each theme (`THEME_COLOR`, `THEME_COLOR_DARK` in
  `src/lib/config.ts`; a unit test keeps them equal to `--color-bg`).

## Components

| Component | File | Notes |
|---|---|---|
| Logo mark | `LogoMark.astro`, `public/logo.svg` | The association's logo (a ring in navy, red and yellow around three figures) at 34 px with fixed width and height. The browser-tab icon is `public/favicon.svg`: the same logo on a white disc. On Night the logo sits on a white rounded rectangle (`--radius-sm`, 3 px inset; the image's own padding and background, set by the logo-plate tokens), because the navy ring disappears on the dark page. Decorative (`alt=""`): the site title names the link. Its colours are used as supplied |
| Site header | `SiteHeader.astro` | Mark, "Pinus Community" (Playfair 700, 18 px) and the descriptor (muted, 13 px) form one home link. Below it, a 3 px stripe in the three brand colours, a third each. Not sticky |
| Site footer | `SiteFooter.astro` | Takedown line with a mailto link (TRD §10), then the organisation name and descriptor. Stacked on phones; one row from 900 px; `text-wrap: balance` |
| Skip link | `BaseLayout.astro` | "Skip to content": hidden above the viewport until focused, then shown on `--color-accent` |
| Eyebrow | `Eyebrow.astro` | See "Typography › Eyebrow". Above every page title and home block heading |
| Button | `.button` in `global.css` | 44 px tall, `--radius-sm`, 15 px 600. `--primary`: accent fill (one per block). `--quiet`: sunken fill with a hairline. `--glass`: on a photo scrim only. Links that look like buttons use these, never their own styles |
| Breadcrumbs | `Breadcrumbs.astro` | `nav[aria-label=Breadcrumb] > ol`. Blue links separated by muted chevrons; the current page is muted with `aria-current="page"` |
| Node meta | `NodeMeta.astro`, `.meta` in `global.css` | "date · N photos · N sections" on album headers and cards; the album page adds the `venue` after the date, cards never do. `<time datetime>` only for single days. Each item carries its own decorative "·"; the strip left of the line is clipped, so a wrapped line never starts with a dot |
| Album card | `AlbumCard.astro`, `AlbumCardList.astro` | 4:3 cover (radius 10), title (Playfair 600: 22 px events, 18 px sections), then meta. The title link is stretched over the whole card; the cover has `alt=""` because the title names the link. Event cards 1/2/3 columns; section cards 2/3/4 |
| Album page header | `albums/[...path].astro` | Eyebrow ("Event", red; or the parent album's title, blue), page title with status badge, node meta |
| Photo grid | `PhotoGrid.astro` | Square tiles in 3/4/5 columns with 3 px gaps, edge to edge on phones. Each tile is a `<button>` named by the photo's alt text, with `aria-haspopup="dialog"`. The viewer data is embedded as JSON and the grid renders the post viewer |
| Photographer filter | `PhotographerFilter.astro`, `src/scripts/viewer/chips.ts` | Pills above a grid with two or more photographers: "All 118", then each photographer with a count, most photos first. Unpressed: sunken fill, text-colour name (600), muted count; hover: border-colour fill. Pressed: `--color-accent` with `--color-on-accent`. 36 px tall, 15 px, 8 px apart. One sideways-scrolling row on phones, wrapping from 600 px. Hidden until the script runs. Toggles (`aria-pressed`) with a live region |
| "View all" link | `albums/[...path].astro` | "View all 118 photos ›" in blue, 15 px 600, beside the "Sections" heading. Only on albums with sections |
| All photos page | `albums/[...path]/all.astro` | Breadcrumbs ending in "All photos", eyebrow "All photos" (yellow), the album title, "date · All N photos", the filter and the grid |
| Post viewer | `PostViewer.astro`, `src/scripts/viewer/` | See "Post viewer" |
| Sibling nav | `SiblingNav.astro` | "‹ Day 1 · Day 3 ›", centred below a hairline. Screen readers hear "Previous section: Day 1" |
| Empty state | `EmptyState.astro` | Sunken panel with an outline photo pictogram, a heading and one plain sentence ("No albums yet", "No photos here yet", the 404 page). As the page's h1 it uses `.page-title` |
| Status badge | `StatusBadge.astro` | Pills after a title. "Draft": yellow with `--color-on-brand-yellow`, only in `npm run dev`. "Hidden": sunken fill, hairline, text colour, only in `npm run dev:hidden`. A real space before the badge keeps the accessible name readable ("Demo Event A Hidden") |
| Photo credit | `PhotoCredit.astro`, `CameraIcon.astro` | The photographer's name with a camera outline in front, so it reads as "taken by", not as the name of someone pictured. Weight 500 in muted text (on a photo scrim: `--color-on-photo-credit`, 70% white), quieter than the text around it. Screen readers hear "Photo by Name" (the lead-in is visually hidden; the hero says "Cover photo by"). A long name ends in "…". Small: 11 px on phone tiles, 12 px on tiles from 600 px and in the hero, 13 px in the spotlight. Used on landing tiles, the hero and the spotlight; the post viewer's header draws the same camera + name |
| Icons | `ChevronIcon.astro`, `CloseIcon.astro`, `ImageIcon.astro`, `CameraIcon.astro` | Drawn SVG, 1.5–1.75 px round stroke in `currentColor`. Decorative |
| Landing blocks | `LandingHero.astro`, `LandingChapter.astro`, `LandingSpotlight.astro`, `ShareBanner.astro` | See "Home page" |

### Home page

`src/pages/index.astro`; what is shown is decided in `src/lib/landing.ts` (TRD §6.2). Top to
bottom, with the visually hidden h1 "Photo albums":

- **Hero** (`LandingHero.astro`): the featured event's cover filling a frame inside the page
  column (radius 10) shaped 4:5 on phones, 16:10 from 600 px and 21:9 from 900 px, and at
  least 32 rem tall. The shape is a *minimum* height, so a long title makes the hero taller
  instead of being cut off.
  At the bottom, on the photo scrim: eyebrow ("FEATURED EVENT" · date, red dot; whether the
  event was pinned with `featured: true` or is simply the newest), the title (h2, display size, white), venue (600), the start of the story (2 lines),
  glass stat pills ("**118** photos", "**4** sections"), a primary
  "Open album" button and a glass "All 118 photos" button, then the cover's photo credit. The
  image loads eagerly with high priority (it is the largest thing in the first viewport).
- **Chapters** (`LandingChapter.astro`): one per section of the featured event, or one
  "Highlights" chapter for an event without sections. Header: eyebrow ("SECTION 1 OF 4 · date
  · venue", dots taking turns red/blue/yellow), the album title as a link (h3, 22 px), the
  start of its story (muted, 15 px), and "View all N photos ›" on the right. Then a
  **mosaic** of up to five photos: on phones the first wide (4:3) and the rest square in two
  columns (an odd one out spans both); from 900 px a 7 + 5 pair on a tall row, then the rest
  sharing a row. Tiles have `--radius-sm`, zoom 3% on hover, and carry the photo credit
  on a bottom scrim. Each links to the photo in its album (`#slug` opens the viewer).
- **Photo spotlight** (`LandingSpotlight.astro`): one photo at its own shape on a black stage
  (radius 10, at most ~36 rem tall), with eyebrow "PHOTO SPOTLIGHT" (yellow), where it is from (h2), the
  caption in italic (line breaks kept), the photo credit and the date below it (no avatar:
  initials beside a name read as the person pictured), and a primary "Open photo" button. Two thirds / one third from 900 px; stacked below.
- **More from our events**: eyebrow "RECENT EVENTS" (brand dots), heading, then the next
  three events as chapters (eyebrow: date · venue).
- **All events**: eyebrow "N events · N photos", heading, then the event cards (the original
  home page, unchanged).
- **Share banner** (`ShareBanner.astro`): sunken panel with soft glows in the three brand
  colours, eyebrow "SHARE YOUR PHOTOS" (brand dots), heading "Took photos at one of our
  events?", one sentence, and a primary "Email <address>" button (`mailto:` with a subject).

No JavaScript ships with the home page. With no photos yet, the h1 "Photo albums" is shown
with the empty state.

### Post viewer

`PostViewer.astro` (markup and styles) with its behaviour in `src/scripts/viewer/`. It follows
the Instagram post layout (TRD §6.5): a native `<dialog>` opened with `showModal()`.

- **Photo area is black** (`--color-viewer-bg`, a binding product constraint). The details
  (header, caption, counter) sit on the page's own `--color-bg`: off-white on Day, slate on
  Night. That keeps the name link readable (brand blue 7.39:1 on Day, `#A9B9E6` 9.49:1 on
  Night). On black, brand blue would measure only 2.68:1.
- **Header credit (all sizes):** a muted camera outline, then the photographer's name (600
  weight; a blue underlined link only with an Instagram handle), so it reads as "taken by",
  not as someone pictured; screen readers hear "Photo by Name". The date sits below it in
  muted 13 px, lined up with the name. ✕ on the right (44 px target). No avatar.
- **Below 600 px (phones):** full screen. The black photo area takes all the height the
  header, caption and counter leave (at least 15 rem), and the photo is centred in it at its
  own shape, so it sits in the middle of the screen rather than under the header. The caption
  is 15 px, keeps its line breaks and is clamped to 3 lines, with a blue "more"/"less" button
  that appears only when the caption really overflows. The counter is muted and right
  aligned below. **On touch phones the arrows are hidden visually** (people swipe; the arrows
  covered much of the photo), but stay in the page: screen readers still offer "Next photo",
  and they reappear when focused from a keyboard.
- **600–899 px:** a column 36 rem wide, centred on the backdrop with `--radius-md` corners;
  the photo at its own shape, capped at `100dvh − 15rem` so the caption stays in view. The
  visible backdrop can be clicked to close the viewer.
- **900 px and up:** the photo on black on the left, the 340 px details panel
  (`--viewer-panel`) on the right, with a hairline under its header, the **whole** caption
  (the panel scrolls) and the context line ("Day 1 · Demo Event A", muted 13 px). The counter
  sits in the photo's bottom-right corner on a dark pill. The frame is inset
  `clamp(16px, 3vw, 48px)` from the window edges.
- **Controls over the photo** (arrows, counter pill) are white on `--color-viewer-control`
  (55% black) with a 30% white edge: at worst 4.74:1 over a white photo. Arrows are 40 px
  (44 px from 900 px), hidden at either end, and hidden visually on touch phones (above).
  Icons are drawn SVG, never glyphs.
- **A single photo** reads like a single post: no arrows, no counter, and the dialog is named
  "Photo by …".
- **Focus:** on the header, the normal ring (drawn inside the ✕). On the photo, a
  `--color-viewer-focus` ring with a black halo, so it shows over any photo.
- **Backdrop:** `--color-viewer-scrim` (82% black).
- **States:** a photo not yet loaded keeps its shape on black; after 300 ms a quiet 2 px ring
  appears, and the photo fades in over 160 ms. A photo that fails shows "This photo didn't
  load. Check your connection and try again." with a **Try again** button.
- **Motion:** the overlay fades in over 160 ms (`@starting-style`); closing is instant; moving
  between photos never animates. During a swipe the photo follows the finger, resists past
  either end, and settles back over `--duration-settle`. Reduced motion makes all of it
  instant.

| Foreground | Background | Ratio | Use |
|---|---|---|---|
| `#FFFFFF` | control over white photo (≈`#737373`) | 4.74:1 | Counter pill, arrows (worst case) |
| `#FFFFFF` | `#000000` | 21.00:1 | Error message, "Try again", spinner |
| `#334E97` / `#A9B9E6` | page (Day / Night) | 7.39:1 / 9.49:1 | Name link, "more" |

## Images

All derivatives are WebP (link previews: JPEG), generated by `src/lib/images.ts` with sizes
from `src/lib/image-sizes.ts`, EXIF stripped and orientation applied, never upscaled.

- **Grid thumbnails:** 240 and 480 px square crops.
- **Card covers and landing tiles:** the same 4:3 crops at 400, 600, 800 and 1200 px (the
  files are shared); each place has its own `sizes`. Landing tiles are drawn with
  `object-fit: cover`.
- **Hero:** the whole photo at 800–2000 px, drawn with `object-fit: cover`; `heroSizes()`
  accounts for a landscape photo being drawn wider than the portrait phone frame. No
  watermark: the hero names the photographer in its text.
- **Viewer and spotlight:** the same files, 800–2000 px, with the photographer watermark.
- **Photographer watermark (viewer images only):** `© Name` in the bottom-right corner, Inter
  SemiBold at 2.4 % of the image's short edge (at least 14 px), inset 0.8 × the font size,
  white at 85 % over a soft black shadow. It is burned into the pixels, so its values live in
  `src/lib/credit/`, not in the tokens. Thumbnails, covers, tiles and the hero have none.
- **Loading:** the placeholder is the sunken surface colour, and every image reserves its
  final shape, so the layout does not shift.

## Link previews

Every page but the 404 carries Open Graph and X card tags. The image is the album's cover
(the home page: the newest event's), cropped from the centre to 1200×630, JPEG quality 80
(chat apps do not all show WebP; WhatsApp skips images over ~300 KB). No credit is drawn on
it, like card covers.

## Checked behaviour

- **Widths:** 320, 360, 768, 1280 and 1440 px, and a 200% root font size, in both themes: no
  horizontal scroll and no clipped content. The Playwright suite repeats 360/768/1280 px on
  every kind of page.
- **Long titles and links wrap** everywhere, including unbroken 60+ character words
  (`overflow-wrap: break-word` on the body, `anywhere` in the viewer).
- **An album with no photos** has a card with the sunken placeholder and image icon and no
  meta line, and its page shows "No photos here yet".
- **An album with photos and sections** shows the section cards first, then its own photos
  under a visible "Photos" heading.
- **Drafts and hidden albums:** drafts carry the yellow "Draft" badge in `npm run dev` only;
  hidden albums the grey "Hidden" badge in `npm run dev:hidden` only. Neither is published.
- **Design detector:** `cream-palette` on the Day background is an intentional exception:
  `#FAF8F4` was chosen over white (too clinical next to the brand colours) and a stronger
  beige (tints the photos).

## From the reference

What [design-reference/DESIGN.md](design-reference/DESIGN.md) contributed, and what it did
not, with the reason:

| Reference | In this project |
|---|---|
| Exhibition-slate palette `#0B1326` … `#DAE2FD` | **Adopted** as the Night theme |
| Accent tones on dark (`#FFB3B1` / `#B0C7F1` / `#FFB95F`) | Blue adopted as `#A9B9E6` (the brand blue's tint); red and amber stay brand `#EF4C2B` / `#F1B244` |
| Coral primary button `#FF535B` | **Not adopted:** blue is the interactive colour (PRODUCT.md); buttons use `--color-accent` |
| Playfair Display for names and headings | **Adopted** (700 titles, 600 headings: 500 is too thin at 18–22 px on phones) |
| Plus Jakarta Sans for text and UI | **Adopted** |
| Type scale 56 / 40 / 28 / 22 / 18 / 16 / 14 / 12 | Titles 28 → 48, home block headings 24 → 36, 22 and 18 as `--text-xl` / `--text-lg`. Body stays 16 px (14 px is too small for captions on phones) |
| Uppercase eyebrow labels with a coloured dot | **Adopted** as `Eyebrow.astro` (12 px rather than 11 for phones; muted text, the colour is in the dot because red and yellow fail as small text on Day) |
| Three-dot motif | **Adopted** in brand colours: eyebrow brand dots, header stripe |
| Hero: featured album on a large photo with text on a scrim, stat pills, actions | **Adopted** for the home page, with the scrim made solid behind all text |
| Chapters with asymmetric 7 + 5 / 4 + 4 + 4 mosaics | **Adopted** for the home page only; album pages keep the square 3 px grid (TRD §6.4) |
| Photo inspector panel | **Adopted** as the photo spotlight, without the invented parts (EXIF telemetry, likes, prints, follow) |
| "Contribute your album" banner with colour glows | **Adopted** as the share banner (email the committee; the site has no uploads) |
| Photographer credit on tiles | **Adopted** on landing tiles; grid tiles stay clean (the viewer credits) |
| Glass (backdrop blur) | Only for buttons and pills on the hero's scrim |
| Shadows | **Not adopted:** no shadows; depth from tone steps |
| Sticky header and filter toolbar, nav pills, search, avatar, slideshow | **Not adopted:** no such features (TRD non-goals); the header stays a simple home link |
| Spacing 4 / 8 / 16 / 24 / 40, margins 12 → 48 px, full-bleed page | **Kept ours:** the 4 px scale and the 1120 px column |
| Radius 8 px photos, 16 px panels, 12 px pills | **Kept ours:** 6 / 10 px and full pills |
