# Design reference: "Lumina Community Archive"

What the reference page (`code.html`, `screen.png`) is made of, written down so its design
language can be reused without copying the page. All values are the ones the page **actually
renders**: its Tailwind config and classes, checked against the screenshot. The Stitch export
that used to sit in this file described a different palette (`#E63946`, `#1D3557`, `#F59E0B`,
`#0F172A`), radii and gutters that the page never uses, so it was replaced.

How the project adopts this language is in the root [DESIGN.md](../DESIGN.md) ("Night theme").

## Mood

**A night festival hung in a gallery.** The page is a deep cobalt-dusk void, and warm,
lantern-lit photographs glow out of it. The chrome is quiet and dark. Colour comes from the
photos and from three small accents: coral red, periwinkle blue and amber. The accents recur as a
**row of three dots**, which is the page's signature (logo lockup, eyebrow pills, the
category chips, the tile corners).

- **Editorial:** event names are set in a high-contrast serif (Playfair Display), like a
  magazine or a museum catalogue. Everything else is a clean geometric sans.
- **Archival:** small uppercase labels with wide tracking ("CHAPTER 01 • 8:00 PM – 11:30 PM"),
  monospace EXIF values and "Plate No. 14" badges make the photos read as catalogued records.
- **Atmospheric, not boxy:** there are **no borders anywhere**. Surfaces are separated by
  small steps in tone, frosted glass (backdrop blur) and soft colour glows behind panels.
- **Warm against cool:** cool blue-grey surfaces and text with warm accents (coral, amber)
  that echo the lantern light in the photos.

## Colour

A Material 3 dark scheme generated from a coral seed. Hue of every surface ≈ 222° (navy).

### Surfaces (dark to light)

| Token | Hex | Used for |
|---|---|---|
| `surface-container-lowest` | `#060e20` | Footer, photo canvas in the inspector, bottom of photo scrims, glass controls (at 70–80%) |
| `background` / `surface` | `#0b1326` | Page, header (at 90% + blur), sticky toolbar (at 95% + blur) |
| `surface-container-low` | `#131b2e` | Cards, panels, inactive chips, inputs, segmented-control track |
| `surface-container` | `#171f33` | Cells inside a panel (quote box, EXIF cells, profile row), chip hover |
| `surface-container-high` | `#222a3d` | Active chip / segment / nav item, small tonal buttons, counter pill |
| `surface-container-highest` | `#2d3449` | Glass buttons on photos (at 80%), "•" separators, avatar ring |
| `surface-bright` | `#31394d` | Hover state of tonal and glass buttons |

### Text

| Token | Hex | Used for | On `#0b1326` |
|---|---|---|---|
| `on-surface` | `#dae2fd` | Headings, titles, primary text | 14.34:1 |
| `on-surface-variant` | `#e4bebc` | Descriptions, meta, inactive nav, credits | 10.91:1 |

The "muted" text is a warm pinkish beige, barely dimmer than the main text. Hierarchy comes
from size, weight and the serif/sans split more than from text colour.

### Accents

| Role | Text/icon tone | Fill (container) | Text on fill | Used for |
|---|---|---|---|---|
| Primary (coral red) | `#ffb3b1` | `#ff535b` | `#5b000e` (4.58:1) | Main buttons, "Curator's Choice" and "Plate" badges, live dot, likes, chapter 1 label |
| Secondary (periwinkle) | `#b0c7f1` | `#334a6d` | `#a2b9e2` (4.52:1) | Venue/taxonomy tag, "Live Sound" badge, chapter 3 label and link, ambient glow |
| Tertiary (amber) | `#ffb95f` | `#ca8100` | `#3e2400` (4.56:1) | Dates, "Golden Hour", "Community Mentor" badge, chapter 2 label |

All three tones measure ≈ 10.9:1 on the page. Each section ("chapter") takes one accent and uses
it for its dot, eyebrow label and "View all" link, rotating red → amber → blue down the page.
Text selection is the red fill with its dark text.

Unused in the page but generated: `outline #ab8987`, `outline-variant #5b403f`, the error set.

## Typography

Two Google families: **Playfair Display** (serif, 400–900) and **Plus Jakarta Sans** (sans,
200–800). Icons are Material Symbols Outlined (filled variant for active hearts and play).
EXIF values and archive codes use the browser's monospace font.

| Style | Family | Size / line | Weight | Tracking | Used for |
|---|---|---|---|---|---|
| display-lg | Playfair | 56 / 64 (36 / 44 mobile) | 700 | −0.02em | Defined, not used on this page |
| hero h1 | Playfair | 40 → 48 (`md:text-5xl`), leading 1 | 600 | −0.025em | Featured album title |
| headline-lg | Playfair | 40 / 48 (28 / 36 mobile) | 600 | −0.015em | (base of the hero title) |
| headline-md | Playfair | 28 / 36 | 500 | — | Chapter (section) titles, CTA heading |
| headline-sm | Playfair | 22 / 28 | 500 | — | Wordmark, inspector photo title, footer name |
| title-lg | Jakarta | 18 / 26 | 600–700 | — | Panel headings |
| title-md | Jakarta | 16 / 22 | 500–600 | — | Photo titles on tiles, photographer name, metric numbers (bold) |
| body-lg | Jakarta | 16 / 26 | 400 | — | Hero and CTA paragraphs |
| body-md | Jakarta | 14 / 20 | 400 | — | Section descriptions, page default, italic curator quote |
| body-sm | Jakarta | 12 / 18 | 400 | — | Photo credits ("Maya Lin • Sony A7IV • 35mm f/1.4"), metric labels |
| label-md | Jakarta | 13 / 16 | 600 | 0.04em | Buttons, nav, chips, date and place rows |
| label-sm | Jakarta | 11 / 14 | 700 | 0.06em | Badges, counters, EXIF labels; **uppercase** + `tracking-wider/widest` (0.05–0.1em) for eyebrows |

Patterns: a coloured **eyebrow** (8 px dot, uppercase label-sm, wide tracking) above every
serif section title. Items in meta lines are joined with " • ". Numbers are bold and the unit
is in small muted text after them ("**428** Archived Photos").

## Spacing

| Token | Value | Notes |
|---|---|---|
| `space-xs` | 4 px | Gaps inside chips and nav |
| `space-sm` | 8 px | Icon–label gaps, button rows |
| `space-md` | 16 px | **Photo grid gap**, header gaps, below section headers |
| `space-lg` | 24 px | Between sections, split-view gap |
| `space-xl` | 40 px | Section top padding, hero bottom, footer padding |
| `gutter-mobile` | 12 px | Page side padding on phones |
| `margin` | 48 px | Page side padding from 768 px ("gallery matte") |

The page runs full width (no max-width container) inside the 48 px margins. Header height 80 px.

## Shape

The page's Tailwind config **remaps** the radius names, so class names mislead:

| Class | Renders | Used for |
|---|---|---|
| `rounded` | 2 px | Taxonomy tag, "Plate" badge |
| `rounded-lg` | 4 px | Metric pills, EXIF cells, segment buttons, tonal small buttons |
| `rounded-xl` | 8 px | Photo tiles, hero, primary and glass buttons, inputs, quote box |
| `rounded-2xl` | 16 px | Large panels (inspector, CTA banner) |
| `rounded-full` | 12 px | Chips, nav pills, badges (on 24–32 px tall items this reads as a pill); dots and avatars are circles |

So the radius scale is architectural and small: crisp 8 px photos, 16 px panels.

## Depth

- **Tone first:** each nested surface is one step lighter (`#0b1326` → `#131b2e` → `#171f33`
  → `#222a3d`). That is what actually separates things on screen.
- **Glass:** header `surface/90` + 24 px blur; sticky toolbar `background/95` + 24 px blur;
  controls over photos `#060e20` at 70–80% + 12 px blur.
- **Photo scrims:** bottom-up gradient `#060e20` → 30% → transparent at 85% opacity (95% on
  hover); the hero adds a left-to-right `#0b1326` 90% → transparent scrim for its text.
- **Ambient glows:** 320–384 px circles of the accent colours at 10–15% opacity with a 64 px
  blur, half outside the corners of big panels. That is the "festival light" behind the chrome.
- **Shadows** are Tailwind defaults (`shadow-sm` … `shadow-2xl`, `shadow-inner`, header
  `0 1px 8px rgb(0 0 0 / 0.04)`). On this dark page they are nearly invisible; they add weight
  under photos and panels rather than visible edges.

## Components

**Header (nav).** Fixed, 80 px, glass. Left: logo + serif wordmark with an uppercase
"ARCHIVE" label below, then a tri-dot pill ("● ● ● COMMUNITY FOLIO"). Centre: the nav as a
**segmented pill group** (track `#131b2e` at 70%, 4 px padding; links label-md, muted, hover to
`#222a3d` and full text colour; the active item is `#222a3d`). Right: search field (`#131b2e`,
8 px radius, ⌘K hint), a **gradient-outline button** (1 px ring red → amber → blue around a
`#131b2e` fill) and the avatar.

**Buttons.**

| Kind | Fill | Text | Radius | Padding | Hover / press |
|---|---|---|---|---|---|
| Primary | `#ff535b` | `#5b000e`, label-md | 8 px | 12 × 24 | Fill to `#ffb3b1`; `scale(0.95)` on press; shadow-lg |
| Glass (on photos) | `#2d3449` 80% + 12 px blur | `#dae2fd` | 8 px | 12 × 16 | Fill to `#31394d` |
| Tonal small | `#222a3d` | `#dae2fd`, label-sm | 4 px | 4 × 12 | Fill to `#31394d` |
| Icon (circle) | `#171f33` or glass | accent or text | full | 8–12 | One tone lighter |
| Text link | none | accent tone, label-sm + → | — | — | Underline |

**Chips (filters).** Pill (12 px radius), 6 × 16 padding, label-md. Inactive: `#131b2e` with
muted text; hover `#171f33` with full text. Active: `#222a3d` with full text and shadow-sm.
A category chip leads with a 6 px dot in its accent. Next to the chips: a **segmented control**
(track `#131b2e`, 8 px radius, 4 px padding; active segment `#222a3d`, 4 px radius).

**Badges.** On photos: small pill, accent fill at 90%, dark text, label-sm bold ("Curator's
Choice", "Live Sound", "Community Mentor"). Or just a 8–10 px accent dot in the corner. On
meta lines: `#334a6d` tag with `#a2b9e2` uppercase text and a 2 px radius.

**Photo tiles (cards).** No padding and no border; the photo is the card. 8 px radius,
`#131b2e` behind the image while loading, shadow-md (shadow-xl for the large ones). The bottom
scrim carries the title (Jakarta 16/600) and a credit line (12 px, muted, "Name • Camera •
Lens", with a small camera icon in the chapter accent). On hover the photo zooms to 1.02 over
500 ms, the scrim darkens and round icon buttons (fullscreen, like, info) fade in.

**Section header ("chapter").** Eyebrow (dot + uppercase label in the accent), serif title,
one-line muted description. On the right, at the baseline: "Showing 6 of 124 photos • View
Chapter Reel →".

**Hero.** One featured album as a full-bleed 540–620 px photo in an 8 px rounded frame, two
scrims, glass tags in the top-left, and the text block in the bottom-left: taxonomy tag, date
and place (icon in an accent), serif title, two-line description, three glass **metric pills**
(icon, bold number, small unit). Actions sit bottom-right.

**Inspector (photo detail).** A 16 px panel with ambient glows, split 8 : 4. Left: the photo on
`#060e20` with glass prev/next and zoom controls. Right: badges, serif title, an italic quote in
a sunken box (`#171f33` + inset shadow), the photographer row (48 px avatar, name, role,
"Follow"), a two-column **EXIF grid** (cells `#171f33`, 4 px radius, label-sm label above a
monospace value) and an action row.

**CTA banner.** A 16 px panel with three glows (red 15%, blue 15%, amber 10%), a tri-dot
eyebrow pill, a serif heading, body text, checklist items with an icon in each accent, and
two large buttons.

**Footer.** `#060e20`, serif name with a small year pill, one muted line of text, and a
right-aligned label line.

## Layout patterns

- **Full-bleed editorial flow:** hero → sticky filter toolbar → chapters → feature panel →
  more chapters → CTA → footer. Each chapter is one event section with its own accent.
- **Asymmetric 12-column grids**, 16 px gaps: a 7 + 5 pair of tall (460 px) tiles, then
  4 + 4 + 4; or 4 + 5 + 3 staggered; or three equal. Photos are cropped to the cell (cover).
  One column on phones, two from 640 px.
- **Sticky chrome:** the header and the filter toolbar both stay on screen while scrolling.
- **Bottom-anchored text over photos** with scrims everywhere: the page shows almost no text on
  a plain background apart from section headers.

## Motion

- Colour transitions 150 ms (Tailwind default) on every hover.
- Photo zoom 1.02 over 500 ms on tile hover; buttons press to 0.95.
- A pulsing red "live" dot on the featured badge; a spinner while the slideshow starts.

## Accessibility notes

- Body text pairs are strong (10–15:1). The coloured fills with dark text sit just at
  4.5:1 (`#5b000e` on `#ff535b` 4.58:1, `#a2b9e2` on `#334a6d` 4.52:1, `#3e2400` on `#ca8100`
  4.56:1): the minimum for 11–13 px labels.
- The "•" separators in `#2d3449` measure 1.50:1, which is decorative only.
- Text over photos depends entirely on the scrim. Photo-only tiles with titles in the bottom
  20% are safe; bright photos with text higher up are not.
- The reference has no visible focus styles (`focus:outline-none` on inputs).
