<script>
  import { tick } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import EntrySheet from './EntrySheet.svelte';
  import InlineProblem from './InlineProblem.svelte';
  import Lightbox from './Lightbox.svelte';
  import Photo from './Photo.svelte';
  import { deleteEntry, listEntries, listPeople, restoreEntry } from '../lib/db/index.js';
  import { ENTRY_KINDS } from '../lib/constants.js';
  import { dayName } from '../lib/dates.js';
  import { explainError } from '../lib/errors.js';
  import { app, reportError, showToast } from '../lib/state/app.svelte.js';
  import { live } from '../lib/state/live.svelte.js';
  import { closeSheet, openSheet, route } from '../lib/state/router.svelte.js';
  import { strings } from '../lib/strings.js';

  /**
   * @type {{ plantId: string, issues: Record<string, any>[], coverId: string | null }}
   *   issues: all the plant's issues; coverId: the plant's cover photo
   */
  let { plantId, issues, coverId } = $props();

  const PAGE = 30;
  const SHOWN_PHOTOS = 3;
  // Entries made after the timeline opened rise into place (brief section 13);
  // ones loaded with Show earlier, or brought back by Undo, do not
  const openedAt = new Date().toISOString();

  let limit = $state(PAGE);
  const entries = live(() => [plantId, limit], ([id, count]) => listEntries(/** @type {string} */ (id), /** @type {number} */ (count)));
  const people = live(() => null, listPeople);
  const headingId = $props.id();

  // Who did it says something only once more than one person keeps the journal
  const names = $derived(
    new Map((people.value?.length ?? 0) > 1 ? people.value?.map((person) => [person.id, person.name]) : [])
  );

  // Entries arrive newest first; each day gets one heading
  const days = $derived.by(() => {
    /** @type {{ date: string, entries: Record<string, any>[] }[]} */
    const groups = [];
    for (const entry of entries.value?.entries ?? []) {
      const last = groups.at(-1);
      if (last?.date === entry.occurredOn) last.entries.push(entry);
      else groups.push({ date: entry.occurredOn, entries: [entry] });
    }
    return groups;
  });

  /** @param {Record<string, any>} entry */
  const meta = (entry) => [names.get(entry.doneBy), entry.editedAt && strings.timeline.edited].filter(Boolean).join(' · ');

  // The entry open in the edit sheet, named by the sheet's history entry
  const editing = $derived(entries.value?.entries.find((entry) => route.sheet === `entry:${entry.id}`));

  // The photo open in the lightbox, named by its history entry, with the entry it belongs to
  const viewing = $derived.by(() => {
    if (!route.sheet?.startsWith('photo:')) return undefined;
    const photoId = route.sheet.slice('photo:'.length);
    for (const entry of entries.value?.entries ?? []) {
      const index = entry.photos.findIndex((/** @type {Record<string, any>} */ photo) => photo.id === photoId);
      if (index >= 0) return { entry, index };
    }
  });

  // Entries on their way out play .is-leaving first (brief section 13)
  const leaving = new SvelteSet();

  /** @param {Record<string, any>} entry */
  async function remove(entry) {
    closeSheet();
    leaving.add(entry.id);
    await tick();
    const element = document.querySelector(`[data-entry="${entry.id}"]`);
    await Promise.allSettled(element?.getAnimations().map((animation) => animation.finished) ?? []);
    try {
      const deletedAt = await deleteEntry(entry.id);
      showToast(strings.toasts.entryDeleted, {
        action: {
          label: strings.actions.undo,
          run: () => restoreEntry(entry.id, deletedAt).catch((error) => reportError(error, { operation: 'restoreEntry', entryId: entry.id }))
        }
      });
    } catch (error) {
      reportError(error, { operation: 'deleteEntry', entryId: entry.id });
    } finally {
      leaving.delete(entry.id);
    }
  }
</script>

<section class="stack" aria-labelledby={headingId}>
  <h2 class="eyebrow" id={headingId}>{strings.timeline.title}</h2>

  {#if entries.error}
    <InlineProblem problem={explainError(entries.error)} onRetry={entries.retry} />
  {:else if !entries.value}
    {#if entries.slow}
      <div class="timeline" aria-hidden="true">
        {#each { length: 3 }, i (i)}
          <div class="timeline-item">
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text"></div>
          </div>
        {/each}
      </div>
    {/if}
  {:else if days.length === 0}
    <div class="empty">
      <h3>{strings.timeline.empty.title}</h3>
      <p>{strings.timeline.empty.message}</p>
    </div>
  {:else}
    <div class="timeline">
      {#each days as day (day.date)}
        <h3 class="timeline-date">{dayName(day.date, app.today)}</h3>
        {#each day.entries as entry (entry.id)}
          {@const details = meta(entry)}
          <article
            class="timeline-item"
            class:is-auto={entry.auto}
            class:is-new={entry.createdAt > openedAt}
            class:is-leaving={leaving.has(entry.id)}
            data-kind={entry.kind}
            data-entry={entry.id}
          >
            <div class="entry-head">
              <!-- The app's own entries say what happened in their note, not their kind, and can't be changed -->
              {#if entry.auto}
                <span>{entry.note}</span>
              {:else}
                <button
                  class="entry-kind entry-open"
                  type="button"
                  aria-label={strings.timeline.edit(ENTRY_KINDS.label(entry.kind), dayName(day.date, app.today))}
                  onclick={() => openSheet(`entry:${entry.id}`)}
                >
                  {ENTRY_KINDS.label(entry.kind)}
                </button>
              {/if}
              {#if details}<span class="entry-meta">{details}</span>{/if}
            </div>
            {#if !entry.auto && entry.note}<p class="prose">{entry.note}</p>{/if}
            {#if entry.product}
              <p class="text-sm"><span class="muted">{strings.timeline.product}</span> {entry.product}</p>
            {/if}
            {#if entry.photos.length}
              {@const shown = entry.photos.slice(0, SHOWN_PHOTOS)}
              <div class="photo-grid" data-count={shown.length}>
                {#each shown as photo, i (photo.id)}
                  <!-- A photo whose image data was purged keeps its place, empty -->
                  <button
                    type="button"
                    data-photo={photo.id}
                    aria-label={strings.lightbox.position(i + 1, entry.photos.length)}
                    onclick={() => openSheet(`photo:${photo.id}`)}
                  >
                    {#if photo.thumb}<Photo blob={photo.thumb} />{/if}
                    {#if i === SHOWN_PHOTOS - 1 && entry.photos.length > SHOWN_PHOTOS}
                      <span class="more" aria-hidden="true">+{entry.photos.length - SHOWN_PHOTOS}</span>
                    {/if}
                  </button>
                {/each}
              </div>
            {/if}
          </article>
        {/each}
      {/each}
    </div>
    {#if entries.value.hasMore}
      <button
        class="btn btn-quiet"
        type="button"
        aria-busy={entries.loading ? 'true' : undefined}
        onclick={() => (limit += PAGE)}
      >
        {strings.timeline.earlier}
      </button>
    {/if}
  {/if}
</section>

<EntrySheet entry={editing} {issues} onDelete={remove} />
<Lightbox {viewing} {plantId} {coverId} />
