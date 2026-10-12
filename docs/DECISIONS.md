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
