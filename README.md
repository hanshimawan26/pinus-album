# Pinus Community — Photo Album

The photo album of **Pinus Community**, the Indonesian Students Association at NUS.

Visitors open an event, scroll through its photos and tap one to see it large, with who
took it, when, and a caption, much like an Instagram post. Every photo has its own link, so
members can send a single photo to a friend.

This guide is written for **committee members**, including those who have never written
code. You do not need to be a programmer to add an event. You will create folders, drop in
photos and fill in a few short text files. The website rebuilds itself a few minutes after
you save your changes on GitHub.

> **The short version.** Make a folder for the event in `src/albums/`, add an `index.md`
> with its name and date, put the photos in `@photographer-name` folders, save to GitHub.
> The rest of this guide explains each step and what to do when something goes wrong.

## Contents

1. [How the album works](#how-the-album-works)
2. [Two ways to work: in the browser or on your computer](#two-ways-to-work)
3. [Set up your computer (once)](#set-up-your-computer-once)
4. [Add a new event, step by step](#add-a-new-event-step-by-step)
5. [Everyday tasks](#everyday-tasks): [caption](#add-or-change-a-caption) ·
   [credit a photographer](#credit-a-photographer) · [hide a photo](#hide-a-photo) ·
   [fix a wrong date](#fix-a-wrong-date) · [cover photo](#choose-the-cover-photo) ·
   [order of sections](#change-the-order-of-sections) · [drafts](#prepare-an-event-before-publishing-it-drafts) ·
   [hide an album](#hide-an-album-without-deleting-it) · [change the logo](#change-the-logo)
6. [Take a photo down](#take-a-photo-down)
7. [When `photos:check` complains](#when-photoscheck-complains)
8. [Delete the demo content](#delete-the-demo-content)
9. [Size limits](#size-limits)
10. [Publishing: how the website goes live](#publishing-how-the-website-goes-live)
11. [Handover checklist](#handover-checklist)
12. [For developers](#for-developers)

---

## How the album works

Everything on the website comes from the folder **`src/albums/`**. Each folder in it is an
album page; there is no database and no admin panel.

```
src/albums/
├─ photographers.yaml              ← names and Instagram handles of photographers (optional)
├─ pergelaran-2026/                ← an EVENT  →  …/albums/pergelaran-2026/
│  ├─ index.md                     ← title, date and a short story
│  ├─ day-1/                       ← a SECTION →  …/albums/pergelaran-2026/day-1/
│  │  ├─ index.md
│  │  ├─ photos.yaml               ← captions and fixes for single photos (optional)
│  │  ├─ @andi-pratama/            ← photos taken by Andi Pratama
│  │  │  ├─ IMG_0012.jpg
│  │  │  └─ IMG_0013.jpg
│  │  └─ @sari-wijaya/             ← photos taken by Sari Wijaya
│  │     └─ DSC_0441.jpg
│  └─ day-2/
└─ welcome-picnic-2026/            ← an event without sections
   ├─ index.md
   └─ @andi-pratama/
      └─ IMG_0201.jpg
```

The rules in one breath:

- **A folder is an album page.** Folders inside an event become its sections (Day 1, Day 2…),
  and sections can have their own sub-sections.
- **A folder starting with `@` is a photographer, not a page.** `@andi-pratama` means
  "these photos were taken by andi-pratama". It never shows up in a web address.
- **Folder names become web addresses**, so use lowercase letters, numbers and dashes:
  `pergelaran-2026`, `day-1`. A number in front (`01-opening`, `02-gala`) sets the order and
  is left out of the address.
- **Photos** can be `.jpg`, `.jpeg`, `.png` or `.webp`. iPhone `.heic` photos must be
  converted first (see [step 5](#5-make-the-photos-web-ready)).
- **The home page** shows every event, newest first. Each event page shows its sections,
  then its own photos.

The two `demo-*` folders that come with the project are made-up examples with generated
pictures. They are [hidden](#hide-an-album-without-deleting-it) (`hidden: true`), so they
are not on the website, but they stay in the project as a reference for every option. To
see them, run `npm run dev:hidden`. You can also
[delete them](#delete-the-demo-content).

---

## Two ways to work

| | **In the browser** (github.com) | **On your computer** |
|---|---|---|
| Good for | Captions, hiding a photo, fixing a date, small events | Adding events with many photos |
| Needs | A GitHub account with access to the repository | Node.js, Git (or GitHub Desktop) and a one-time setup |
| Shrinks photos and removes their location (`photos:prep`) | No: remove the location yourself before uploading ([step 5](#5-make-the-photos-web-ready)) | Yes |
| Checks your work before publishing | Only after you save (see the **Actions** tab) | Yes: `npm run photos:check` and a preview |

Both are fine. If you only fix a caption now and then, the browser is all you need. For a
new event with 50 photos, the computer is much easier, because `photos:prep` shrinks phone
photos and removes their location data before you upload them.

### Working in the browser: the basics

- **Open a file:** go to the repository on github.com and click through the folders
  (`src` → `albums` → …).
- **Edit a file:** open it and click the pencil icon (**Edit this file**). When you are done,
  click **Commit changes…**, write a short note such as "Add captions for Day 1", keep
  **Commit directly to the `main` branch**, and confirm.
- **Create a file or folder:** open the folder where it belongs, click **Add file → Create
  new file**, and type the name. Typing a `/` creates a folder: `pergelaran-2026/index.md`
  creates the folder `pergelaran-2026` with the file `index.md` in it.
- **Upload photos:** open the folder, click **Add file → Upload files**, and drag the photos
  in. You can drag a whole folder such as `@andi-pratama` and GitHub keeps its name. The
  browser accepts at most 100 files and 25 MB per file at a time.
- **See whether it worked:** open the **Actions** tab. A green tick means the website is
  updated; a red cross means something needs fixing (see
  [When `photos:check` complains](#when-photoscheck-complains)). The previous version of the
  website stays online until the problem is fixed.

---

## Set up your computer (once)

1. Install **Node.js** version **22.18 or newer** from <https://nodejs.org> (the "LTS"
   version offered there, such as 24, is fine). To check which version you have, type
   `node --version` in a terminal: it must say `v22.18.0` or higher. Older versions cannot
   run the photo tools.
2. Install **Git** from <https://git-scm.com>, or **GitHub Desktop** from
   <https://desktop.github.com> if you prefer buttons to commands.
3. Download ("clone") the repository. In GitHub Desktop: **File → Clone repository**. With
   Git, in a terminal:
   ```sh
   git clone https://github.com/<your-org>/pinus-album.git
   cd pinus-album
   ```
4. Install the project's tools (takes a minute, needed again only after updates):
   ```sh
   npm ci
   ```
5. Start the preview:
   ```sh
   npm run dev
   ```
   Open <http://localhost:4321/pinus-album/> in your browser. Changes you make to
   `src/albums/` appear when you reload the page. Press `Ctrl + C` in the terminal to stop.

All `npm run …` commands in this guide are typed in a terminal **inside the `pinus-album`
folder**. On Windows, "Git Bash" (installed with Git) or PowerShell both work; in VS Code use
**Terminal → New Terminal**.

---

## Add a new event, step by step

The example adds "Pergelaran 2026", a two-day event photographed by Andi and Sari.

### 1. Create the event folder

Create a folder in `src/albums/` named after the event: lowercase, with dashes instead of
spaces. Include the year so next year's event gets its own name.

```
src/albums/pergelaran-2026/
```

### 2. Add `index.md` with the title, date and story

Create `src/albums/pergelaran-2026/index.md`. Copy this template and change the values:

```markdown
---
title: "Pergelaran 2026"
date: 2026-09-20
endDate: 2026-09-23
venue: "UTown Green"
---

A few short paragraphs telling the story of the event. You can use **bold**, *italics* and
[links](https://example.org).
```

The part between the two `---` lines is the album's settings. The text below them is the
story shown on the page.

| Setting | What it does | Needed? |
|---|---|---|
| `title` | The name shown on the website. Keep the quotes | Recommended (otherwise the folder name is used) |
| `date` | The day of the event, written `YYYY-MM-DD`. The home page lists events by this date, newest first | Recommended (otherwise the date of the earliest photo is used) |
| `endDate` | The last day, for events of several days | Optional |
| `venue` | Where it took place, e.g. `"UTown Green"`. Shown next to the date on the album page | Optional |
| `cover` | The photo shown on the album's card, e.g. `day-1/@andi-pratama/IMG_0012.jpg` (path from this folder) | Optional: the first photo is used |
| `photographer` | Credit for photos in this album that are not in an `@` folder, e.g. `andi-pratama` | Optional |
| `order` | A number that sets the position among sections (`1`, `2`, …) | Optional |
| `sort` | `filename` shows photos in file-name order instead of the time they were taken | Optional |
| `draft` | `true` keeps the album off the website, but shows it in your local preview | Optional |
| `hidden` | `true` hides the album everywhere, also in your local preview, without deleting it | Optional |

Write `true` and `false` (not `yes`/`no`), and dates as `2026-09-20`.

### 3. Make a folder per section (optional)

For a multi-day event, create one folder per day inside the event, each with its own short
`index.md`:

```
src/albums/pergelaran-2026/day-1/index.md
src/albums/pergelaran-2026/day-2/index.md
```

```markdown
---
title: "Day 1"
date: 2026-09-20
---

Opening night at the University Cultural Centre.
```

A section without `index.md` still works: "day-1" becomes "Day 1", and its date comes from
its photos. Sections are listed by `order`, then by a number in front of the folder name,
then by date.

### 4. Put the photos in `@photographer-name` folders

Inside the event (or inside each section), create one folder per photographer, starting with
`@`, and put that person's photos in it:

```
src/albums/pergelaran-2026/day-1/@andi-pratama/IMG_0012.jpg
src/albums/pergelaran-2026/day-1/@sari-wijaya/DSC_0441.jpg
```

Everyone whose photos are in `@andi-pratama` is credited as "Andi Pratama". To show a
different spelling or link their Instagram, see [step 7](#7-add-new-photographers-optional).
Photos of unknown origin can go straight into the album folder without an `@` folder; they
are shown without a credit (or with the `photographer` from `index.md`).

**Do not rename photos after the event is published.** Each photo's link is made from its
folder and file name, so renaming breaks links people have already shared.

### 5. Make the photos web-ready

Photos straight from a phone or camera are large (3–12 MB) and often contain the GPS
location where they were taken. The repository is public, so run this before saving:

```sh
npm run photos:prep -- src/albums/pergelaran-2026
```

It shrinks every JPEG in the folder (and its sub-folders) to at most 2400 pixels on the long
side, turns sideways photos upright, keeps the date the photo was taken, and removes the
GPS location and camera details. It changes the files **in place**, so run it on the copies
in `src/albums/`, not on your only copy of the originals. Running it twice changes nothing.
Add `--dry-run` to see what it would do without changing anything.

- **iPhone `.heic` photos** cannot be used directly. Export them as JPEG first (on iPhone:
  **Settings → Camera → Formats → Most Compatible** for future photos; on a Mac: open in
  Preview and **File → Export** as JPEG; on Windows: open in Photos and save a copy as JPEG,
  or use any HEIC-to-JPEG converter), then run `photos:prep`.
- **In the browser** you cannot run `photos:prep`, so **remove the location before you
  upload**. Once a photo with its location is committed, the location stays in the
  repository's history for good: running `photos:prep` later cleans the current file, but
  not the old version that anyone can still download. Only the history purge in
  [Take a photo down](#take-a-photo-down) removes it. Ways to remove the location first:
  - **iPhone:** select the photos, tap **Share → Options**, turn **Location** off, then
    **Save to Files** and upload those copies.
  - **Windows:** right-click the photos → **Properties → Details → Remove Properties and
    Personal Information** → **Create a copy with all possible properties removed**, and
    upload the copies. (This also removes the date the photo was taken; set `date:` in the
    album's `index.md`, see [Fix a wrong date](#fix-a-wrong-date).)
  - **Mac:** open each photo in Preview, **Tools → Show Inspector → ⓘ → GPS → Remove
    Location Info**.
  - Photos sent through WhatsApp or Telegram have already lost their location (and date).

  The easiest route for a whole new event is still the computer, or asking someone with the
  computer setup to add it. Large photos uploaded through the browser still work (you will
  get a "larger than 2 MB" warning); someone with the computer setup can shrink them later
  with `photos:prep`.

### 6. Add captions in `photos.yaml`

Captions live in a file called `photos.yaml` in the same folder as the photos' `@` folders.
Let the tool write the list for you:

```sh
npm run photos:init -- src/albums/pergelaran-2026/day-1
```

This adds an entry with an empty caption for every photo in that album that does not have
one yet (it never changes entries that are already there). Then fill in the captions you
want and leave the others empty:

```yaml
"@andi-pratama/IMG_0012.jpg":
  caption: "Opening dance by the committee 💃"
"@andi-pratama/IMG_0013.jpg":
  caption: ""
"@sari-wijaya/DSC_0441.jpg":
  caption: "Group photo with the ambassador"
```

Run `photos:init` once for each album folder that has photos (the event, or each section).
More options are under [Everyday tasks](#everyday-tasks).

### 7. Add new photographers (optional)

Open `src/albums/photographers.yaml` and add anyone new, using the same name as their `@`
folder (without the `@`):

```yaml
andi-pratama:
  name: "Andi Pratama"
  instagram: "andi.pratama"     # optional: their name links to this Instagram profile
sari-wijaya:
  name: "Sari Wijaya"
```

Only add an Instagram handle if the photographer is happy to be linked.

### 8. Check, preview and publish

On your computer:

```sh
npm run photos:check     # finds mistakes; must end with "0 errors"
npm run dev              # look at the event on http://localhost:4321/pinus-album/
```

Then save your work to GitHub ("commit and push"). In GitHub Desktop: tick the changed files,
write a summary such as "Add Pergelaran 2026", click **Commit to main**, then **Push
origin**. With Git:

```sh
git add src/albums
git commit -m "Add Pergelaran 2026"
git push
```

**The website updates a few minutes later.** Follow progress in the repository's **Actions**
tab. If it shows a red cross, open it, click the failed step and read the message (see
[When `photos:check` complains](#when-photoscheck-complains)).

---

## Everyday tasks

All of these work in the browser (edit the file on github.com and commit) or on your
computer.

`photos.yaml` entries are always written as the photo's path from that folder, **in double
quotes** because of the `@`: `"@andi-pratama/IMG_0012.jpg":`. A plain file name such as
`DSC_0441.jpg:` also works when no other photo in that folder has the same name. Each entry
can have these settings, all optional:

| Setting | Example | What it does |
|---|---|---|
| `caption` | `caption: "Opening dance 💃"` | Text under the photo. Emoji and line breaks are fine |
| `photographer` | `photographer: sari-wijaya` | Credits someone else than the `@` folder says |
| `date` | `date: 2026-09-20` or `date: 2026-09-20 18:30` | The date shown, instead of the camera's |
| `alt` | `alt: "Students in batik on stage"` | A description for blind visitors (screen readers) |
| `hidden` | `hidden: true` | Removes the photo from the website |

### Add or change a caption

Open the album's `photos.yaml` and set `caption`. For a caption over several lines:

```yaml
"@andi-pratama/IMG_0012.jpg":
  caption: |-
    Opening dance by the committee 💃
    Thank you to everyone who rehearsed for weeks!
```

No `photos.yaml` yet? Create it in the album folder (or run `photos:init`). A photo without
a caption simply shows no caption.

### Credit a photographer

- **Usual way:** put the photos in a folder named `@their-name`.
- **One photo by someone else:** in `photos.yaml`, add `photographer: their-name`.
- **A whole album from one person** (photos not in an `@` folder): add
  `photographer: their-name` to the album's `index.md`.
- **Their display name and Instagram:** add them to `src/albums/photographers.yaml` (see
  [step 7](#7-add-new-photographers-optional)). Without an entry, "their-name" is shown as
  "Their Name".

### Hide a photo

Add `hidden: true` to the photo's entry in `photos.yaml`:

```yaml
"@andi-pratama/IMG_0013.jpg":
  hidden: true
```

The photo disappears from the website, its counts and its covers at the next update. The file
stays in the repository, so you can undo it by deleting the line. If someone asked for the
photo to be removed, read [Take a photo down](#take-a-photo-down).

**Prefer hiding to deleting.** If you do delete a photo file, in the same commit also delete
its entry in `photos.yaml` and change any `cover:` line that names it. Otherwise
`photos:check` stops the update (`photos-yaml-no-match` or `missing-cover`) and the website
keeps showing the old version, photo included.

### Fix a wrong date

- **One photo:** set `date: 2026-09-20` for it in `photos.yaml`. This always wins over the
  camera's date.
- **A whole album whose photos have no camera date** (for example photos sent through
  WhatsApp or Telegram, which removes it): set `date:` in the album's `index.md`. Photos
  without their own date use it.
- **A camera with a wrong clock:** `photos:check` warns when a camera date is outside the
  album's dates. Fix those photos one by one in `photos.yaml`.

Dates are shown in Singapore time unless the `TIMEZONE` setting says otherwise.

### Choose the cover photo

Add `cover:` to the album's `index.md`, with the photo's path from that folder:

```yaml
cover: day-1/@andi-pratama/IMG_0012.jpg
```

If the path starts with `@` (a photo directly in this album's photographer folder), put it
in double quotes: `cover: "@andi-pratama/IMG_0012.jpg"`. Capital letters must match the
file name exactly (`.JPG` is not `.jpg`). Without `cover`, the first photo is used.

### Change the order of sections

Add `order: 1`, `order: 2`, … to each section's `index.md`, or start the folder names with
numbers (`01-opening`, `02-workshops`). Events on the home page are always newest first.

### Prepare an event before publishing it (drafts)

Add `draft: true` to the event's (or a section's) `index.md`. It then shows only in your
local preview (`npm run dev`, with a yellow "Draft" badge), not on the website. Change it to
`draft: false` or remove the line to publish.

### Change the logo

The logo in the header and on the browser tab is the file `public/logo.svg`. To change it,
replace that file with a new one of the same name (in the browser: open the file, then
**⋯ → Delete file**, commit, and upload the new one with **Add file → Upload files**). Use
an SVG if you can, so it stays sharp on every screen, and a roughly square logo, because the
header shows it at 34 × 34 pixels.

### Hide an album without deleting it

Add `hidden: true` to the event's (or a section's) `index.md`:

```markdown
---
title: "Pergelaran 2026"
date: 2026-09-20
hidden: true
---
```

The album and everything inside it then disappear from the website and from the local
preview, but the files stay in the project. Change it to `hidden: false` or remove the line
to show it again. `npm run photos:check` still checks hidden albums, so they are ready to
show at any time.

To look at hidden albums on your computer, start the preview with `npm run dev:hidden`
instead of `npm run dev` (they get a grey "Hidden" badge).

Draft or hidden? Use `draft` for an album you are still preparing and want to preview, and
`hidden` for one you want to keep out of sight, such as the demo albums. To take down a
single photo, see [Hide a photo](#hide-a-photo). Hiding is not a full takedown: see
[Take a photo down](#take-a-photo-down).

---

## Take a photo down

Someone pictured asked for a photo to be removed. Act quickly and kindly:

1. **Hide it.** Add `hidden: true` for it in `photos.yaml` (see
   [Hide a photo](#hide-a-photo)) and commit. This is the safest route: it cannot stop the
   update, and if the photo was an album's cover, the album picks another cover by itself.
   - If you would rather **delete the file**, do three things in the same commit: delete the
     file, delete its entry in `photos.yaml`, and remove or change any `cover:` line in an
     `index.md` that names it. If you forget one, `photos:check` stops the update and the
     website keeps showing the old version, **with the photo**.
2. **Check that it worked.** In the **Actions** tab, wait for the green tick (a few minutes),
   then open the photo's old link (the album address ending in `#…`): the album opens and
   the photo is no longer there. A red cross means the photo is **still online**: open it,
   read the message and fix it.
3. **Reply** to the person to confirm it is done.

**Important: hiding or deleting a photo does not erase it from the repository's history.**
Git keeps every version of every file, and because the repository is public, anyone who
knows where to look can still download the original from an older version. Usually hiding
is enough. If the person needs the photo **gone completely**, it must be removed from the
history as well. That is a technical job; ask the person with admin rights, and plan for
an hour:

1. Tell everyone with a copy of the repository to stop pushing until you are done.
2. Install [git filter-repo](https://github.com/newren/git-filter-repo) (`pip install
   git-filter-repo`, or see its install guide).
3. Make a fresh copy and remove the file from every version (use the real path):
   ```sh
   git clone https://github.com/<your-org>/pinus-album.git pinus-album-purge
   cd pinus-album-purge
   git filter-repo --invert-paths --path "src/albums/pergelaran-2026/day-1/@andi-pratama/IMG_0013.jpg"
   git remote add origin https://github.com/<your-org>/pinus-album.git
   git push origin --force --all
   git push origin --force --tags
   ```
   If the push is refused, allow force pushes on `main` for a moment (**Settings →
   Branches** or **Rules**) and turn the protection back on afterwards.
4. In the **Actions** tab, open **Caches** (left sidebar, under "Management") and delete the
   caches: they hold resized copies made during earlier builds. Files attached to old
   workflow runs can be deleted from each run's page.
5. **Ask GitHub Support to purge cached views and pull-request references** of the old
   versions: <https://support.github.com/request> ("Remove data from a repository"). GitHub
   explains the whole procedure in
   [Removing sensitive data from a repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).
6. Everyone deletes their old local copy and clones the repository again. An old copy
   still contains the photo and would put it back with the next push.

Copies that other people already made (forks, downloads) cannot be recalled.

---

## When `photos:check` complains

`npm run photos:check` reads everything in `src/albums/` and lists problems per file. The
same check runs on GitHub before every update.

- **Errors** (red `✗`) **stop the website from updating** until they are fixed. The website
  keeps showing the previous version meanwhile.
- **Warnings** (yellow `!`) do not stop anything. They point at something that is probably
  not what you want.

Each message says what is wrong and how to fix it, and ends with a short code in brackets.

| Code | Kind | What it means and what to do |
|---|---|---|
| `invalid-index-md` | Error | A mistake in an `index.md` settings block: a typo in a setting name (`titel:`), a date not written `YYYY-MM-DD`, missing quotes, or `yes` instead of `true`. The message gives the line |
| `invalid-photos-yaml` | Error | The same for a `photos.yaml`. Most common: a path starting with `@` without double quotes around it |
| `invalid-photographers-yaml` | Error | The same for `photographers.yaml` |
| `photos-yaml-no-match` | Error | An entry in `photos.yaml` matches no photo. Check the spelling, the upper/lower case (`IMG` vs `img`) and the `@folder/` part. If the photo was deleted, delete its entry too |
| `photos-yaml-ambiguous` | Error | A plain file name matches photos from two photographers. Write the full path: `"@andi-pratama/IMG_0001.jpg"` |
| `photos-yaml-duplicate` | Error | The same photo has two entries. Keep one |
| `duplicate-photo-slug` | Error | Two photos in one album would get the same link (e.g. `IMG_1.jpg` and `IMG_1.png`). Rename one |
| `duplicate-node-slug` | Error | Two folders would get the same web address (e.g. `day-1` and `01-day-1`). Rename one |
| `invalid-folder-name` | Error | A folder name has no plain letters or numbers. Use `a–z`, `0–9` and dashes |
| `invalid-file-name` | Error | A photo name has no plain letters or numbers. Rename it |
| `unsupported-format` | Error | A file the website cannot show, such as `.heic`. Convert it to JPEG ([step 5](#5-make-the-photos-web-ready)) |
| `unreadable-image` | Error | A photo file is damaged or not really an image. Export it again |
| `missing-cover` | Error | `cover:` in `index.md` points to a photo that does not exist (misspelt, or the photo was deleted). Fix the path or remove the line |
| `misplaced-file` / `misnamed-file` | Error | An `index.md`, `photos.yaml` or `photographers.yaml` in the wrong place, or with the wrong name (`Photos.yaml`, `photos.yml`, `index.md.txt`). It would be ignored, so a `hidden: true` in it would not work |
| `no-photographer` | Warning | Nobody is credited for this photo. Put it in an `@` folder or add `photographer:` |
| `no-date` | Warning | The photo has no date at all. Add `date:` to the album's `index.md` or to the photo in `photos.yaml` |
| `date-out-of-range` | Warning | The camera date is outside the album's dates; the camera clock was probably wrong. Set the right `date:` in `photos.yaml` |
| `large-image` | Warning | A photo is over 2 MB. Run the `photos:prep` command the message shows (on a computer) |
| `location-in-photo` | Warning | The photo file contains its GPS location (the website never shows it, but the file in the repository does). Run the `photos:prep` command the message shows. If the photo is already committed, the location also stays in the repository's history; only the purge in [Take a photo down](#take-a-photo-down) removes it from there. Remove the location before uploading ([step 5](#5-make-the-photos-web-ready)) |
| `no-cover` | Warning | An album has no photos yet, so its card is empty |
| `cover-not-shown` | Warning | `cover:` points to a hidden photo, or one in a draft or hidden section, so another photo is used |
| `content-too-large` | Warning | All photos together are over 700 MB. See [Size limits](#size-limits) |
| `ignored-file` | Warning | A video or other file the website does not show. Remove it to save space |

---

## Delete the demo content

The project ships with made-up example albums. They are already hidden from the website
(`hidden: true`), so you can keep them as a reference. If you no longer need them, delete:

1. the folders `src/albums/demo-event-a` and `src/albums/demo-event-b`;
2. the demo entries (`alice-demo`, `budi-demo`, `dewi-demo`) in
   `src/albums/photographers.yaml`.

In the browser: open each file or folder, click **⋯ → Delete file** (or **Delete
directory**), and commit. The automatic tests that use the demo albums switch themselves off
when the folders are gone.

---

## Size limits

Photos are stored in the GitHub repository itself, and the website is hosted on GitHub
Pages. Both have limits:

- GitHub recommends keeping a repository **under about 1 GB**.
- A GitHub Pages website can be **at most 1 GB**.
- Each file pushed to GitHub must be under 100 MB (25 MB through the browser).
- **Git LFS is not allowed** for the photos: GitHub Pages cannot serve LFS files.

After `photos:prep`, a photo is about **0.7 MB**, so roughly **1,500 photos fit in 1 GB**.
The website holds several resized WebP copies of each photo, which together can be about as
large as the photo itself, so both limits arrive around the same number of photos.
`photos:check` warns when `src/albums/` passes 700 MB.

What helps, in order:

1. Run `photos:prep` on every new event (it is the biggest saving).
2. Publish a selection of the best photos, not every shot.
3. Remember that **deleting photos does not shrink the repository**: their history stays
   (see [Take a photo down](#take-a-photo-down)).
4. When the album outgrows GitHub, a developer can move hosting to **Cloudflare Pages**
   (free, larger limits) or move the photos to **Cloudflare R2** storage. That is planned as
   future work, not needed for years at the current pace.

---

## Publishing: how the website goes live

Every push to the `main` branch starts the workflow in
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). It checks the photos
(`photos:check`), runs the automatic tests, builds the website, checks the result (no
location data in published images, no broken links, no drafts or hidden photos, the robots
and takedown rules) and publishes it. It takes a few minutes. You can also start it by hand:
**Actions → Deploy to GitHub Pages → Run workflow**.

### First-time setup

These steps are done once, by someone with admin rights. They cannot be done from this
project folder; they need the repository on GitHub.

1. **Create the repository under the association's GitHub organisation** (not a personal
   account): on github.com, **+ → New repository**, owner = the organisation, name
   `pinus-album`, **Public**, and no README (this project already has one). GitHub Pages
   on a free organisation needs a public repository.
2. **Upload this project** from the project folder:
   ```sh
   git remote add origin https://github.com/<your-org>/pinus-album.git
   git push -u origin main
   ```
3. **Turn on Pages:** **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. **Set the contact address:** **Settings → Secrets and variables → Actions → Variables →
   New repository variable**, name `CONTACT_EMAIL`, value the association's address. Until you
   do, the footer shows a placeholder address.
5. **Run the first deployment:** **Actions → Deploy to GitHub Pages → Run workflow** (the push
   in step 2 may have run before Pages was on). When it shows a green tick, the website is at
   `https://<your-org>.github.io/pinus-album/`.
6. Open the website on a phone and check the footer's email address.

### Settings (repository variables)

All are optional. Set them under **Settings → Secrets and variables → Actions → Variables**.
After changing one, run the workflow again (**Actions → Run workflow**).

| Variable | Default | What it does |
|---|---|---|
| `CONTACT_EMAIL` | a placeholder | The address in the footer's "Not comfortable with a photo?" line. **Set this before launch** |
| `ALLOW_INDEXING` | `false` | `true` lets Google and other search engines list the website. Off by default because the photos show identifiable students; the committee decides |
| `TIMEZONE` | `Asia/Singapore` | Time zone for camera dates |
| `SITE_URL` | detected | The website's address, e.g. `https://photos.example.org`. Only for unusual setups |
| `BASE_PATH` | detected | The path after the address: `/pinus-album/` on `github.io`, `/` on a custom domain. Only for unusual setups |

### Custom domain (optional)

To use an address such as `photos.example.org`:

1. Ask whoever manages the domain to add a DNS `CNAME` record pointing `photos` to
   `<your-org>.github.io`.
2. In **Settings → Pages → Custom domain**, enter `photos.example.org`, save, and tick
   **Enforce HTTPS** once it is offered.
3. For the record, add a file `public/CNAME` containing just `photos.example.org`.
4. Set the repository variable `BASE_PATH` to `/` and run the workflow again. (The workflow
   detects this by itself, but setting it makes the choice explicit.)

---

## Handover checklist

Committees change every year. Go through this list at every handover, together with the
outgoing committee.

- [ ] The repository belongs to the **association's GitHub organisation**, not to a
      person. (If not: **Settings → General → Danger Zone → Transfer**.)
- [ ] The organisation has **at least two owners/admins**, and at least one of them stays for
      the next year. Remove people who have left; add the new committee as members.
- [ ] Two-factor authentication is required for the organisation (**Organisation settings →
      Authentication security**).
- [ ] **Settings → Pages → Source** says **GitHub Actions**, and the website opens.
- [ ] `CONTACT_EMAIL` is set to an address someone **reads**, and the committee knows who
      answers takedown requests and how fast (for example within 3 days).
- [ ] The committee has decided whether search engines may list the site (`ALLOW_INDEXING`).
- [ ] The last run in the **Actions** tab is green.
- [ ] `npm run photos:check` shows no errors, and the total size is well under 700 MB.
- [ ] The new maintainers have read this README and added a test caption on their own.
- [ ] Fill in the table below.

| Year | Admins (GitHub usernames) | Contact email | Takedown contact person |
|---|---|---|---|
| 2026/27 | | | |

---

## For developers

The project is a static [Astro](https://astro.build) site in TypeScript with plain CSS and
no UI framework. Start with these documents:

- [`docs/TRD.md`](docs/TRD.md): the specification (authoritative).
- [`CLAUDE.md`](CLAUDE.md): the architecture, module map and coding conventions.
- [`DESIGN.md`](DESIGN.md): the visual system (tokens, colour roles, contrast, components).
- [`docs/DECISIONS.md`](docs/DECISIONS.md): every assumption and decision, with reasons.
- [`PRODUCT.md`](PRODUCT.md): users, purpose and brand constraints.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server with drafts, on <http://localhost:4321/pinus-album/> |
| `npm run dev:hidden` | The same, with hidden albums too (`SHOW_HIDDEN=true`; works in PowerShell and Git Bash) |
| `npm run build` | Production build into `dist/` (drafts, hidden albums and hidden photos left out) |
| `npm run preview` | Serves `dist/` locally |
| `npm run photos:check` | Validates `src/albums/`; exit code 1 on errors |
| `npm run photos:prep -- <folder> [--dry-run] [--force]` | Makes JPEGs web-ready in place (≤ 2400 px, quality 85, upright, GPS removed). Idempotent |
| `npm run photos:init -- <album-folder> [--dry-run]` | Appends empty `caption` entries to `photos.yaml` for photos without one |
| `npm run demo:images` | Regenerates the demo images (deterministic) |
| `npm run verify:dist` | Checks `dist/` after a build: no EXIF/GPS, no copies of originals, no broken links, image sizes and orientation, no drafts, hidden albums or hidden photos, robots meta, takedown line, JS only on photo pages and within 60 KB gzipped. Use the same `BASE_PATH`, `ALLOW_INDEXING`, `CONTACT_EMAIL` and `SHOW_HIDDEN` as the build |
| `npm test` | Unit tests (Vitest, `tests/`) |
| `npm run test:e2e` | Browser tests (Playwright, `e2e/`) against a fresh production build |
| `npm run typecheck` | `astro check` |

### Tests and quality gates

Before merging a change, all of these must pass:

```sh
npm test
npm run typecheck
npm run photos:check
npm run build && npm run verify:dist
BASE_PATH=/ npm run build && BASE_PATH=/ npm run verify:dist   # Git Bash: prefix MSYS_NO_PATHCONV=1
npm run test:e2e
```

- **Unit tests** cover the content engine (slugs, dates, the metadata precedence table, every
  validation rule, the tree), the image and link checks, the authoring tools and the
  viewer's pure logic.
- **Browser tests** (`npm run test:e2e`) build the site for `/pinus-album/`, serve it with
  `astro preview` on port 4460 (change with `E2E_PORT`) and drive Google Chrome at phone
  (360 px, touch) and desktop (1280 px) sizes. They cover the acceptance checklist: opening a
  photo, absent rows, keys, swipe, Esc/✕/Back/backdrop, focus return, deep links, invalid
  hashes, breadcrumbs, orientation, no horizontal scroll at 360/768/1280 px, robots and the
  takedown line. They use the demo albums and skip themselves when those are deleted. On CI
  (`CI` set) they use Playwright's bundled Chromium instead of Chrome. Without Chrome on your
  computer, run `npx playwright install chromium` once and choose that browser with
  `E2E_BROWSER`:

  ```sh
  E2E_BROWSER=chromium npm run test:e2e                     # Git Bash, macOS, Linux
  $env:E2E_BROWSER = 'chromium'; npm run test:e2e           # PowerShell
  ```
- The browser tests are **not** part of the deploy workflow, so publishing stays fast. They
  run on pull requests and on demand in [`.github/workflows/e2e.yml`](.github/workflows/e2e.yml).
