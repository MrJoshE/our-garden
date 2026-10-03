# Garden Journal: developer brief

You are building a small installable web app (PWA) called Garden Journal. Read this whole brief before writing any code. Where it does not cover something, choose the simplest option and say what you chose. If a choice would change the data model or add a dependency, ask first.

## 1. What it is and who it is for

Garden Journal lets someone keep a record of the plants in a garden and how they are doing. The first user is my partner, recording our own garden on her phone while standing in it. The design also has to suit a gardener who looks after other people's gardens, so everything is organised per garden.

The things a user does most, in order:

1. Opens a plant and adds a note, often with a photo.
2. Records that something was checked or that work was done (watered, fed, pruned, treated).
3. Flags a problem with a plant, follows it over time and marks it resolved.
4. Looks back at what happened to a plant and when.

The app should feel calm, quick and trustworthy. Nothing she writes should ever be lost, and nothing should make her wait.

## 2. Ground rules

- All data stays on the device in IndexedDB. There is no backend, no account and no network request of any kind after the app has loaded.
- The app must work fully offline once it has been opened once.
- Keep the code small and plain. Prefer the platform (native dialog, form validation, CSS) over libraries.
- Do not add features that are not in this brief. Section 17 lists things that are deliberately left out.
- Target browsers: Safari on iOS 17 and later (in the browser and installed to the home screen), Chrome on Android, and current desktop Chrome, Safari and Firefox.

## 3. Stack

- Svelte 5 with runes, Vite, plain JavaScript with JSDoc types on the database module. No SvelteKit and no router library.
- `vite-plugin-pwa` for the manifest and service worker.
- `dexie` for IndexedDB.
- `fflate` for the backup zip.
- `@fontsource-variable/albert-sans` and `@fontsource-variable/newsreader` for the two typefaces. Import them once in `main.js`, including the Newsreader italic. They are bundled and precached with the app shell, so the app still makes no network requests. Check that the family names in the `--font-sans` and `--font-serif` tokens match what the packages register.
- No UI kit, no CSS framework, no state library, no date library. Use `Intl` for dates.
- Styling comes from the supplied `theme.css` (see section 12).
- Vitest with `fake-indexeddb` for tests.

## 4. Project layout

```
src/
  main.js
  App.svelte
  styles/theme.css          supplied, import once in main.js
  lib/
    db/
      schema.js             Dexie setup and version upgrades
      write.js              the single write path and change log
      plants.js entries.js issues.js gardens.js photos.js people.js
      backup.js             export and import
      seed.js               sample garden for development
    state/
      router.svelte.js      hash routing, history and view transitions
      live.svelte.js        live query helper
      app.svelte.js         toasts, update notice, storage warning
      drafts.js             unsaved form drafts
    images.js               resize, thumbnail, hash
    dates.js                local date helpers and formatting
    ids.js                  UUID with fallback
    constants.js            kinds, statuses, severities with labels
    strings.js              every piece of user-facing text
  pages/
    Garden.svelte
    Plant.svelte
  components/               Sheet, Toasts, PhotoPicker, PhotoGrid,
                            Lightbox, Timeline, IssueCard, and so on
```

Pages and components never import Dexie directly. They only call functions from `lib/db` and `lib/state`.

## 5. Data model

### Rules for every table

- `id` is a UUID string. Use `crypto.randomUUID()` and fall back to one built from `crypto.getRandomValues()`, because `randomUUID` is missing on plain http, which is how the app is reached on a phone during development.
- Every record has `gardenId`, `createdAt`, `updatedAt` and `deletedAt`, plus an `extra` object that defaults to `{}`. (For the gardens table, `gardenId` equals `id`. The people and meta tables have no `gardenId`.)
- Deleting sets `deletedAt`. All read functions leave out deleted records.
- Timestamps are ISO strings in UTC. Dates the user chooses are `YYYY-MM-DD` strings built from the device's local date. Never use `toISOString().slice(0, 10)` for these, because it gives the wrong day late in the evening during British Summer Time.
- Fixed lists are stored as short lowercase strings and defined once in `constants.js` with their display labels.
- An unknown value in a fixed list (from a newer backup, for example) is shown as "Other" and never crashes the page.

### Tables

| Table | Fields |
|---|---|
| gardens | name, ownerName, contact, address, notes, soil, aspect, status (active, archived), latitude, longitude |
| areas | name, sun (full, part, shade), notes, x, y |
| plants | areaId, location (free text), commonName, botanicalName, variety, quantity, plantedOn, source, status (growing, dormant, removed, dead), careNotes, coverPhotoId, tags, x, y |
| issues | plantId, areaId, title, kind (pest, disease, deficiency, damage, weather, other), severity (low, medium, high), status (open, watching, resolved), firstSeenOn, resolvedOn, notes, tags |
| entries | plantId, areaId, issueId, visitId, taskId, occurredOn, kind (observation, checked, watered, fed, pruned, treated, planted, moved, harvested, other), note, product, doneBy (personId), editedAt, auto (boolean), tags |
| photos | entryId, plantId, issueId, takenAt, caption, blob, thumb, width, height, bytes, sha256 |
| tasks | plantId, areaId, issueId, title, dueOn, doneOn, repeat |
| visits | startedAt, endedAt, personId, summary |
| people | name, role |
| changes | table, recordId, action (create, update, delete), changedFields, at, by (personId), deviceId |
| drafts | key, data, updatedAt |
| meta | key, value |

Indexes: `gardenId` on every table that has it, each foreign key, `[plantId+occurredOn]` on entries, `status` on issues and plants, `dueOn` on tasks, `sha256` on photos, and `tags` as a multiEntry index.

The meta table holds `schemaVersion`, `deviceId`, `currentPersonId`, `lastGardenId`, `lastBackupAt` and `installHintDismissed`.

### Which tables have screens

Version one has screens for gardens, plants, entries, issues and photos. Create the areas, tasks and visits tables and their read and write functions, but build no screens for them.

### Derived values

- A plant needs attention when it has an issue whose status is `open` or `watching`.
- A plant's "last checked" date is the `occurredOn` of its most recent entry of any kind.
- Work these out in the read functions. Do not store them on the plant.

## 6. Writing data

All writes go through one function in `write.js` that:

1. Runs inside a Dexie transaction covering every table it touches, including `changes`.
2. Sets `updatedAt`, and on create sets `id`, `createdAt`, `deletedAt: null` and `extra: {}`.
3. Adds a row to `changes` with the table, record id, action, the names of the fields that changed, the time, the current person and the device id.

Extra rules built on top of that:

- Changing an issue's status also creates an entry with `auto: true` and a note such as "Marked as resolved", linked by `issueId`, in the same transaction. Resolving sets `resolvedOn` to today and reopening clears it.
- Creating an issue also creates its first entry so that it appears in the plant's timeline.
- Entries can be edited. An edit keeps `createdAt` and sets `editedAt`. Automatic entries cannot be edited or deleted.
- Deleting a plant soft deletes its entries, issues and photos in one transaction. Undo restores exactly the records that delete changed, by matching the `deletedAt` value.
- "Checked today" creates an entry of kind `checked` dated today. If the same person has already checked the same plant today, do nothing and show "Already checked today".
- On start, permanently remove photo blobs (not the rows) whose records were deleted more than 30 days ago, so that storage is recovered.

Schema changes go through Dexie version upgrades only. Never change an existing version's definition. Each upgrade also updates `schemaVersion` in meta.

## 7. State management

There are three kinds of state. Keep them separate.

**Saved data lives in IndexedDB and nowhere else.** Components read it through live queries and never keep their own copy. After a write, the page updates because the live query runs again, not because the component changed a local list. This is what keeps the screen correct across tabs and after an import.

Provide one helper in `live.svelte.js`:

```js
// const plants = live(() => listPlants(gardenId));
// plants.value, plants.loading, plants.error
export function live(query) {
  let state = $state({ value: undefined, loading: true, error: null });
  $effect(() => {
    const sub = liveQuery(query).subscribe({
      next: (value) => { state.value = value; state.loading = false; state.error = null; },
      error: (error) => { state.error = error; state.loading = false; }
    });
    return () => sub.unsubscribe();
  });
  return state;
}
```

- `loading` and "empty" are different. Never show an empty state while loading.
- Show a skeleton only if loading takes longer than 150ms, so that fast loads do not flicker.
- A query error shows a short message with a "Try again" button, and is logged.

**Where the user is lives in the URL.** The router reads the hash and exposes the current garden id, plant id and the garden page's filter and search text (as query values in the hash). Routes:

- `#/` goes to the last used garden, or to first run setup if there are none
- `#/g/:gardenId` is the garden page
- `#/g/:gardenId/plant/:plantId` is the plant page

An id that does not exist, or that belongs to a deleted record, shows a "not found" message with a link back. It never shows a blank page.

**Everything else is local to a component**, using `$state`. The only shared in-memory state is in `app.svelte.js`: the toast list, the "update ready" flag and the storage warning.

### Sheets and the back button

Every sheet and the photo lightbox pushes a history entry when it opens and is closed by the back button. Closing it any other way (Cancel, Esc, tapping the backdrop, saving) calls `history.back()` so the history stays in step. On Android the back button must close an open sheet and must not leave the page.

### Drafts

A phone can discard the page while the camera is open, so nothing typed may be lost.

- The entry form saves its contents to the `drafts` table under a key such as `entry:<plantId>`, at most every 500ms and when the page is hidden.
- Photos that have been picked are saved with the draft as soon as they are processed.
- When the plant page opens and a draft exists, restore it silently.
- Clear the draft after a successful save or when the user discards it.
- The add plant and add issue sheets do the same.

### Several tabs and updates

- Listen for Dexie's `versionchange` event, close the database and show "Garden Journal was updated in another tab" with a reload button.
- Handle `blocked` during an upgrade by asking the user to close other tabs.
- Register the service worker in prompt mode. When a new version is ready, show a banner with "Update now". Never reload on your own while a form has unsaved content.

## 8. Screens

There are two pages. Everything else is a sheet over one of them.

### First run

If there are no gardens, show a single welcome sheet that asks for her name and the garden's name, then creates the person and the garden and opens it. Call `navigator.storage.persist()` after this first save.

### Garden page

- App bar with the garden name, which opens a menu to switch garden, add a garden, edit this garden's details, and open "Backup and settings".
- Heading showing the garden's `name` exactly as the user entered it, and a line such as "14 plants, 2 need attention". The name is never hard-coded. "Our garden" in the design is only sample content. The heading updates as soon as the garden is renamed or another garden is chosen. The app bar title and the back link on the plant page show the same name.
- A filter with "All" and "Needs attention", showing the count on the second. Use the `.segmented` class, which draws these as underlined tabs.
- A search box, shown only when there are more than eight plants. It matches common name, botanical name, variety, location and tags, and ignores case and accents.
- The plant grid. Each card shows the cover photo, name, location, and a "Needs attention" badge when it applies. A plant with no photo shows `.cover-empty` with a simple line drawing of a leafy sprig from `Icon.svelte` and a `data-tint` of rose, sage, rain, lavender or primrose. Pick the tint from the plant's id so that it never changes. Plants that are removed or dead are shown last and muted.
- "Add plant" as a floating button on phones and a normal button in the header on wide screens.
- Empty states: no plants yet, nothing needs attention, and no search results. Each says what to do next.
- Returning from a plant restores the scroll position.

### Plant page

- Back link, cover photo, name, botanical name and variety, location, status, planted date, care notes and tags, with an Edit button that opens the plant sheet. Location, status and planted date use `.facts-strip`. The botanical name uses `.botanical`.
- A "Checked today" button and the last checked date. The button is `btn btn-primary btn-lg btn-block check-button`.
- Open issues, each as a card with title, kind, severity, days since first seen, and buttons for "Watching" and "Resolved". Resolved issues sit in a collapsed "Resolved" group.
- "Flag a problem" opens the issue sheet (title, kind, severity, notes, photos).
- The entry form (section 9).
- The timeline, newest first and grouped by date, showing kind, note, product, photos and who did it. Automatic entries are shown small. Load 30 entries at a time with a "Show earlier" button.
- A menu with "Delete plant".
- On wide screens the details and issues sit in a left column beside the form and timeline.

### Sheets

Welcome, add and edit garden, add and edit plant, add and edit issue, edit entry, and "Backup and settings" (her name, export, import, storage used, app version).

## 9. Forms and feedback

- The entry form has a note, a kind picker (default "Observation"), a date (default today, cannot be in the future), a product field shown only for fed and treated, an optional link to one of the plant's open issues, and photos.
- An entry needs at least a note, a photo, or a kind other than "Observation". The Save button is disabled until then.
- Trim text. Limits: names 120 characters, notes 5,000. Show a counter only when within 10 percent of the limit.
- Validate on submit, show the message under the field, set `aria-invalid`, and move focus to the first field with a problem.
- While saving, set `aria-busy` on the button and ignore further taps. Saving twice must never create two records.
- If a save fails, keep everything the user typed and show what went wrong. For a storage quota error, say that the device is out of space and suggest making a backup and removing old photos.
- After saving, clear the form, keep the keyboard closed, and let the new entry animate into the timeline.
- Deleting never uses a confirmation dialog. It happens straight away with a toast offering "Undo" for six seconds. The only exception is deleting a whole garden, which asks the user to type the garden's name.
- Toasts are short ("Saved", "Checked today", "Entry deleted"), appear at the bottom, and are announced to screen readers. Only one undo toast shows at a time. A second delete replaces the first toast and the first delete stands.
- Use `navigator.vibrate(10)` on "Checked today" and on resolving an issue, where the browser supports it.

## 10. Photos

- Use `<input type="file" accept="image/*" multiple>` so the phone offers both the camera and the library. Do not set `capture`.
- Allow up to ten photos per entry. Process them one at a time to keep memory low, and show each thumbnail with a spinner until it is ready. The form stays usable meanwhile.
- For each photo: decode with `createImageBitmap(file, { imageOrientation: 'from-image' })`, and fall back to an `<img>` element if that fails. Resize to a longest side of 1600px and make a 400px thumbnail, both JPEG at quality 0.82. Use `OffscreenCanvas` when available.
- Re-encoding removes location data from the photo. Keep it that way.
- Record width, height, bytes, a SHA-256 of the resized blob (when `crypto.subtle` is available), and `takenAt` from the file's last modified time.
- If a file cannot be decoded, mark that thumbnail as failed with "This photo could not be read" and carry on with the others.
- Lists and grids use `thumb`. Only the lightbox and the plant page cover use the full image.
- Create object URLs in one small component and revoke them when it is destroyed. Use `loading="lazy"` and `decoding="async"`, and fade images in when they load.
- The first photo added to a plant becomes its cover. "Use as cover" in the lightbox changes it.
- The lightbox swipes between an entry's photos, shows the caption and date, closes with back, Esc or the close button, and returns focus to the photo that opened it.

## 11. Edge cases that must be handled

- **iOS storage is separate for Safari and the installed app.** In iOS Safari, when not installed, show a banner before any data exists: "Add Garden Journal to your Home Screen first, so your journal is kept safe", with the steps. It can be dismissed, and the choice is remembered.
- **Storage running out.** Check `navigator.storage.estimate()` on start and after saving photos. Above 80 percent show a warning banner. Show usage in settings.
- **The device date changes at midnight while the app is open.** Work out "today" when it is needed rather than once at start.
- **Long names and notes** wrap and never break the layout. Card titles clamp to two lines.
- **Many plants.** The grid must stay smooth with 300 plants. Use thumbnails, lazy images and the `content-visibility` already set in the theme.
- **Double taps, and navigating away during a save.** A save that has started always completes.
- **The page restored from the back/forward cache** must still have working live queries. Resubscribe on `pageshow` if needed.
- **Private browsing or IndexedDB unavailable.** Show a clear message that the journal cannot be saved in this mode, rather than a broken app.
- **A photo row whose blob has been purged** shows a neutral placeholder.
- **The keyboard covering the Save button on phones.** Sheet footers stay visible above the keyboard. Use `dvh` units and scroll the focused field into view.
- **Deleting the garden that is currently open** goes to another garden, or to first run setup if none are left.

## 12. Styling

`theme.css` is supplied and is the single source of visual decisions. It has tokens, a reset, layout helpers, every component listed in this brief, the animations and print styles. The theme is called "Morning border". It should feel quiet and garden-like: pale green ground, deep ivy text, deep green for actions, and foxglove rose only for things that need attention. Plant names, page headings, journal dates and issue titles are set in Newsreader. Everything else is Albert Sans.

- Import it once. Read the notes at the top of the file before using it.
- Never write a literal colour, font size, radius, shadow or duration in a component. Use the tokens.
- Use the existing classes first. If something is missing, add it to `theme.css` in the right layer with a comment, and tell me what you added.
- State is shown with attributes where one exists (`aria-pressed`, `aria-busy`, `aria-invalid`, `data-kind`, `data-tone`, `data-status`) and `is-` classes otherwise.
- Issue cards have no coloured side stripe. The status sits in a `.status` line above the title.
- The timeline is one card with a rule between entries, not a rail with dots.
- Light theme only for now.
- Icons are small inline SVGs with a 1.75 stroke and `currentColor`. Keep them in one `Icon.svelte` component. No icon font and no icon library.

## 13. Motion

Motion should be quick and quiet. It is there to show where something came from or that an action worked.

- Use the durations and easings from the tokens. Nothing in the interface takes longer than 360ms.
- Page changes use the View Transitions API through the router. Set `data-nav="forward"` or `"back"` on `<html>` first. Give the tapped plant card's cover and the plant page's cover the name `plant-cover` for the length of the transition so that the photo grows into place. Where the API is missing, change page with no animation.
- Sheets slide up on phones and fade in on wide screens. To close one, add `.is-closing`, wait for `animationend`, then call `close()`.
- New timeline entries get `.is-new`. Removed ones get `.is-leaving` before they go.
- The plant grid uses `.stagger` on first load only, not on every filter change.
- Buttons press in on touch. "Checked today" draws its tick and pops once.
- Only animate `transform` and `opacity`, apart from the small cases already in the theme.
- `prefers-reduced-motion` is handled in the theme. Do not add animation in JavaScript that would get around it.

## 14. Responsive layout

- Design for a 360px wide phone first, held in one hand. The main actions sit within reach of the thumb.
- The theme uses container queries on `.page`, so components adapt to the space they have. Phone, tablet and desktop each get a sensible layout: two columns of plants on a phone and up to five on a desktop, and the plant page splits into two columns from about 860px.
- Respect safe areas on phones with a notch or home indicator. The theme tokens cover this.
- Hover effects apply only where hovering exists. Every touch target is at least 44px.
- Landscape on a phone must stay usable, including inside sheets.
- Test at 360, 390, 768, 1024 and 1440 wide.

## 15. Accessibility

- Everything works with a keyboard, with a visible focus ring.
- Use real `button`, `a`, `label`, `dialog` and form elements.
- Every input has a label. Icon-only buttons have an `aria-label`.
- Sheets trap focus (the native dialog does this), are labelled by their heading, and return focus to what opened them.
- Toasts sit in an `aria-live="polite"` region.
- Colour is never the only signal. Badges and kinds always have text.
- Text can be enlarged to 200 percent without anything being cut off.
- After a page change, move focus to the page's main heading.

## 16. Backup

- **Export** makes a zip holding `garden-journal.json` (with `schemaVersion`, the export date, the app version and every table except drafts) and a `photos/` folder with one file per photo and thumbnail, named by photo id. Build it in pieces so that a large journal does not use up memory, and show progress.
- Hand the file over with the Web Share API when it can share files (this is the reliable route in an installed iOS app), and with a download link otherwise. The file is named `garden-journal-YYYY-MM-DD.zip`.
- Record `lastBackupAt`. If there has been no backup for 30 days and there are new entries, show a gentle reminder banner once.
- **Import** reads the same format, in one transaction. It refuses a file with a newer `schemaVersion` and says the app needs updating. It upgrades older files. It merges by id and keeps whichever record has the newer `updatedAt`. Afterwards it shows what was added and updated. A damaged or unrelated file gives a clear message and changes nothing.

## 17. Out of scope

Do not build these, and do not add code "ready for" them beyond what the data model already holds: sending a form to a gardener, sync between devices, login, areas and tasks and visits screens, a garden map, reminders and notifications, weather, a plant species database, dark mode, and translations.

## 18. Quality and testing

- Tests for the database module: each write function, the change log, soft delete and undo, automatic entries, the "needs attention" rule, the Dexie version upgrades, and a backup export followed by an import into an empty database.
- Tests for `dates.js`, including the late evening case in British Summer Time.
- A global error handler that shows a friendly message with a reload button and keeps the last 50 errors in meta, visible in settings, so that I can help her if something goes wrong.
- `npm run seed` (or a button shown only in development) that loads a realistic garden with about 25 plants, several issues and a few months of entries with photos.
- No console errors or warnings in normal use.
- Lighthouse on the production build: installable, and at least 95 for performance and accessibility on mobile.

## 19. PWA details

- Manifest: name "Garden Journal", short name "Garden", `display: standalone`, background and theme colour `#f3f5f0`, icons at 192 and 512 plus a maskable 512, and an apple touch icon at 180.
- Precache the app shell. There is nothing to cache at runtime, because there are no network requests.
- Show the app version in settings.

## 20. What to deliver

1. The project, with a README covering how to run, test, build and deploy it as static files.
2. A short note listing any choices you made that this brief did not cover, and anything you added to `theme.css`.
3. Confirmation, with what you actually did, that you tested: first run, adding a plant, adding an entry with photos, checked today, flagging and resolving an issue, delete and undo, export and import, an offline reload, the back button closing a sheet, and restoring a draft after a reload.

Work in this order and stop for review after each step: (1) database module with tests, (2) router, live query helper and the garden page, (3) plant page, entries and photos, (4) issues, (5) backup, settings and PWA polish.
