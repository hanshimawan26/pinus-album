# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Astro (latest stable) + TypeScript, plain CSS with CSS variables, `astro:assets` (sharp) for images, PhotoSwipe v5 or a custom `<dialog>` viewer, Vitest. Static output deployed to GitHub Pages via GitHub Actions. No UI framework. Source of truth: [docs/TRD.md](docs/TRD.md) §3.

## Users

- **Primary: current members** of Pinus Community. They are students who open the album on their phones after an event, usually from a link in a group chat. They want to find photos of themselves and their friends, read who took each one and when, and send a single photo on to someone else.
- **Equal secondary audiences:** alumni looking back across years, friends and family, and sponsors seeing what the association does. When their needs conflict with what members need, members win. These audiences still get full care.
- **Maintainers:** committee members, possibly non-technical, who change every year. They add events by creating folders and editing YAML/Markdown, either locally or in the GitHub web UI.

## Product Purpose

A public digital photo album for Pinus Community's events. Visitors browse events as a tree (event → section such as Day 1–4 → optional sub-section). They open any photo in a post-style viewer that credits the photographer and shows the date and an optional caption. Success means three things. Members reach and share the photo they want within seconds on a phone. Every photographer is visibly credited. A committee member with no coding background can publish a new event without changing any code.

## Positioning

This is the association's own record of its events, not a feed or a social network. Every photo carries its photographer's credit, the content is organised by event, and each photo has a stable deep link that keeps working as albums grow. The committee maintains it with folders and text files and hosts it for free, so it outlasts any one committee year.

## Operating Context

- Visitors are mostly on phones, often arriving from WhatsApp or Telegram links. Many photos also arrive through those apps, which strip EXIF data, so dates often fall back to the event date.
- Event photos usually come from several volunteer photographers per event. Multi-day events have 3–5 sections.
- Scale today is 4 events with 10–50 photos each. The design target is 30 events and 1,500 photos.
- Maintainers work in the GitHub web UI or a local checkout, guided by the README. Admin rights must survive the yearly committee handover.

## Capabilities and Constraints

- P0 scope, acceptance checklist and milestones are defined in [docs/TRD.md](docs/TRD.md). That document is authoritative for the content model, routes, metadata precedence and validation.
- Post viewer (core): Instagram-post layout on mobile and a photo plus details panel on desktop (≥ 900 px), with keyboard, swipe and Back navigation, deep links via `#<photo-slug>`, and focus trapping.
- The UI omits absent metadata entirely: no "Unknown" labels and no empty rows.
- Static only. Not in the POC: accounts, uploads, comments, likes, search, CMS, member-only access, video and downloads.
- Mobile-first from 360 px to 1440 px. Mobile Lighthouse targets: Performance ≥ 90, Accessibility ≥ 95. Viewer JS ≤ 60 KB gzipped, loaded only on pages with photos.
- The site UI is English only. Indonesian or bilingual support is P2.
- Privacy: no EXIF or GPS data in published images, `noindex` by default, no analytics or cookies, a takedown line in the footer.
- Size: the repo and the Pages site are each limited to about 1 GB, and Git LFS is not allowed.
- **Open:** takedown contact email and response time, custom domain, whether to allow search indexing.

## Brand Commitments

- **Name:** "Pinus Community" is the primary name. Use "Indonesian Students Association at NUS" as the subheading or descriptor.
- **Official colours:** blue `#334E97`, red `#EF4C2B`, yellow `#F1B244`. These are binding brand colours, but they are **not** the website's primary colours. They work as accents on top of the neutral base. How each one is used in the UI is a design decision and is not decided here.
- **Neutral base (user-set constraint):** the site's base colours are neutral, such as white, black or beige, and the brand colours sit on top of them. White or beige pairs well with the brand colours.
- **Photo viewer is black (user-set constraint).** The post viewer's photo area uses a black background.
- **Blue for interactive accents (user preference).** Blue `#334E97` is the preferred colour for links and buttons. The page base colour (white or beige) is still undecided.
- **Logo:** the official logo is `public/logo.svg` (a ring in navy, red and yellow around three figures). It is used in the header. The browser-tab icon is `public/favicon.svg`, the same logo on a white disc.
- **Voice:** warm and plain-spoken, written by students for students. Not established beyond the TRD's copy, such as the takedown line.

## Evidence on Hand

- No real event photos are in the repo. Real photos exist but stay out of the repo until launch. Placeholder demo content comes from `npm run demo:images` (TRD §12).
- There are no testimonials, press or usage data. Future work must not invent any of these, or any event names, photographers or captions presented as real.

## Product Principles

1. **Members first, on a phone.** Every decision is tested against a student on mobile opening a link from a group chat.
2. **The photograph leads.** The interface stays out of the way of the photos and the people in them.
3. **Credit is non-negotiable.** Photographers are always named when known, and absent data disappears without leaving gaps.
4. **Maintainable by next year's committee.** Folders and text files beat features. Nothing should require a developer to publish an event.
5. **Respect the people pictured.** The site is public and shows identifiable students, so privacy defaults and easy takedown come before reach.

## Accessibility & Inclusion

WCAG AA text contrast, semantic landmarks, real alt text (TRD §4.6), visible focus rings, an accessible modal dialog for the viewer, and `prefers-reduced-motion` respected (TRD §6.6).
