# Notes

What the brief (`developer-agent-prompt.md`) left open, how it was decided, and everything added to the supplied `theme.css`. The pull requests linked here explain each choice in full.

## Choices the brief didn't cover

### Journal
- **One add button per screen.** While a garden has no plants, the empty state's Add plant button is the only one. The floating button and the header button appear once there are plants.
- **Entry names** (who wrote an entry) show only when the journal has more than one person.
- **Editing an entry** changes its text, kind, date and problem, not its photos.
- **Photo captions** are stored but can't be written yet. There's no field for them.
- **The plant page's cover photo** doesn't open the lightbox; the photos in entries do.
- **The entry composer** has its date in its footer, to keep the form short on a phone.
- **A new problem** defaults to the kind "Other" and medium severity.
- **The status buttons on problem cards** are full size (44px), since she uses them outdoors.
- **At 200% text,** the date input's digits clip (#50). The rest of the page fits.

### Backup and settings (#63, #64, #65, #67)
- **The sheet** is rendered app-wide, so the garden menu and the banners can all open it.
  - It leads with the backup, then her name, storage, the app version and a folded problem log.
- **Her name** has its own Save button rather than saving on blur, which would save a half-typed name when the sheet closes.
- **Confirmations inside a sheet**, such as "Name saved", are a status line in the sheet. A toast would sit behind the modal and go unseen (#62).
- **The problem log** shows each record's operation, time, error and every wrapped cause, newest first.
- **Export:**
  - **Hand-over:** the file goes to the share sheet where the browser can share a zip, and downloads otherwise. If the export outlasted the tap the share sheet needs, a **Save backup** button asks for another tap. If a browser refuses to share even then, the file downloads.
  - **Unreadable photos:** a photo whose stored file can no longer be read is left out, as if purged. The sheet says how many, so one bad file can't stop every backup.
  - **Deleted photos** still inside their 30-day purge window are included, as the database holds them.
- **Import:**
  - **Merge:** it merges by id, and the newer `updatedAt` wins; a tie keeps this device's copy.
  - **Photo files:** a photo arriving without its file keeps this device's file.
  - **Device settings:** only `currentPersonId` and `lastGardenId` are taken from the backup's settings, and only when this device has none. Its id, error log and dismissed hints stay its own.
  - **Re-zipped backups:** a backup re-zipped inside a folder, as the Files app's Compress does, is accepted.
- **Restore a backup** is offered on the welcome screen, so a new phone, or the installed app after using Safari, starts from a backup instead of an empty journal. The brief didn't ask for this.
- **A restore** counts as the last backup on a device that has never made one, so a restored phone isn't nagged straight away.
- **The backup reminder:**
  - **Never backed up:** it counts the 30 days from when the journal began.
  - **Once:** it's recorded as shown even if a more important banner covers it. The storage banner says to make a backup too.
  - **Clearing:** a backup made any other way clears it.
- **Banners** show one at a time, in this order: a problem, then an update, then low storage, then the backup reminder.

### App and offline (#68)
- **The app icon** is the sprig from the empty states, light on the theme's deep green, matching the favicon.
- **All font subsets** are precached (about 280 KB), so text never falls back to a system font offline.
- **Update now:**
  - It saves any draft still waiting on its half-second timer before reloading.
  - Only the tab where it was tapped reloads. Other open tabs keep their banner rather than reloading over unsaved typing.
- **The sample garden** (development builds only) has drawn photos, so it needs no image files.

## Additions to `theme.css`

The theme was supplied in the first commit (`2e757c2`). Since then:

### Flat, and controls that stay visible outdoors (#8)
- **No shadows:**
  - the `--shadow-*` tokens and every `box-shadow` that used them are gone, from buttons, cards, the FAB, the hero cover, the switch, sheets, menus, toasts and print;
  - cards no longer lift on hover;
  - surfaces are separated by borders, fills and spacing.
- **`--ivy-300`** is added, and `--color-border-strong` uses it, so the edges of inputs, chips, buttons and checkboxes are at least 3:1 against the page.
- **The severity bars** keep the old pale grey (`--dew-400`).
- **Placeholders** use `--color-text-muted` at full strength.

### Sizes and touch
- **`--tap-sm`** (36px) for `.btn-sm` and the toast button. Both get a full 44px touch area through `::before`.
- **The photo tray's remove button** has a 44px touch area growing into the photo.

### App bar and page
- **The bar's contents** line up with the centred page on wide screens.
- **`.appbar-switcher` and `.appbar-back`** (the garden name in the bar) are one line with an ellipsis. On a phone, the back link shrinks to its arrow once the page title shows in the bar, as on iOS.
- **`.banner-area`** lines banners up with the page's gutters.
- **`.split`** has a single `minmax(0, 1fr)` column on phones, so long text can't widen the page.
- **The sticky aside** uses `--aside-height`, so a details column taller than the window scrolls until its end shows, then stays.
- **`.text-attention`** marks words that need attention, such as "2 need attention".
- **`.eyebrow`** sets the sans font, so eyebrows inside serif text (such as "Care notes") stay sans.

### Buttons
- **A disclosure button's chevron** (`.btn[aria-expanded]`) turns to point the way it will go.
- **`.check-button`:**
  - `.is-done` is the look, and `.is-new` adds the pop and tick animation, so only a check made just now animates;
  - the done look holds under a pointer;
  - its words may wrap when text is enlarged.

### Cards, lists and timeline
- **`.facts-strip`** has one equal column for each fact the plant has, rather than always three.
- **`.plant-card`:** removed and dead plants mute the drawn cover too, not only photos.
- **`.search`** is capped at the reading measure.
- **`.issue-card` and `.issue-open`:**
  - the whole card opens the problem through a stretched title button, with press, hover and focus states;
  - the status line wraps;
  - the status buttons sit above the stretched button.
- **`.timeline-item` and `.entry-open`:** an entry she wrote opens when tapped anywhere on it. The highlight runs out to the card's edges.
- **`.photo-grid > *`** applies to any tile, not only buttons. Photo buttons in an entry sit above the entry's tap target.

### Forms
- **`fieldset.field`:** a reset for choice groups labelled by a legend.
- **`.composer-footer`:**
  - wraps;
  - holds the entry's date, as wide as the date needs;
  - keeps its buttons on one line beside it down to a 360px phone, wrapping them below it together when text is enlarged.
- **`.photo-tray .thumb-message`** says inside the square why a photo failed.

### Sheets, menus, lightbox and toasts
- **`.sheet-body`** is `flex: 1 1 auto`, and **`.sheet-form`** is added. With `flex: 1`, iPhone WebKit sized a sheet to its header alone (#47).
- **`.menu[popover]`** opens where its script places it, and `.is-end` lines it up with a button at the end of the bar.
- **Menu items** wrap long names and have padding for two lines.
- **`.menu-heading`** is added, and `aria-current='page'` gets the current look.
- **`.lightbox`:** previous and next sit either side of the caption, and `.lightbox-cover` marks the cover photo.
- **On phones,** toasts sit above the floating Add button.

### Empty states
- **`.empty > svg`** sizes only the drawing.
- **`.empty :is(h1, h2, h3)`** colours any heading level, and a whole-page `h1` is kept below display size.

## Raised, not fixed
- **#62:** two existing messages are drawn behind the sheet or lightbox that raised them (the photo limit in the add-problem sheet, and a failed cover change in the lightbox).
- **#66:** after a fresh load in Chromium, a focus ring is drawn around the page heading. It needs a one-line theme rule.
- **Import memory (#65):** a 98 MB backup peaked at 221 MB of JS heap. Slicing photos straight from the picked file would avoid that if journals grow much past about 300 photos.
