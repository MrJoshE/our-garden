<script>
  import EntryFields from './EntryFields.svelte';
  import Icon from './Icon.svelte';
  import InlineProblem from './InlineProblem.svelte';
  import PhotoTray, { readyPhotos } from './PhotoTray.svelte';
  import { createEntry, getDraft } from '../lib/db/index.js';
  import { ACTIVE_ISSUE_STATUSES } from '../lib/constants.js';
  import { isFuture } from '../lib/dates.js';
  import { focusFirstProblem, saveFailure } from '../lib/forms.js';
  import { logError } from '../lib/log.js';
  import { app, checkStorage, showToast } from '../lib/state/app.svelte.js';
  import { keepDraft } from '../lib/state/drafts.js';
  import { strings } from '../lib/strings.js';

  /** @type {{ plantId: string, issues: Record<string, any>[] }} issues: all the plant's issues */
  let { plantId, issues } = $props();

  const FIELDS = ['note', 'kind', 'occurredOn', 'product', 'issueId'];
  const blank = () => ({
    note: '',
    kind: 'observation',
    occurredOn: '',
    product: '',
    issueId: '',
    /** @type {import('./PhotoTray.svelte').TrayPhoto[]} */
    photos: []
  });

  const dateErrorId = $props.id();
  let values = $state(blank());
  /** @type {Record<string, string>} */
  let errors = $state({});
  /** @type {import('../lib/errors.js').Explanation | null} */
  let problem = $state(null);
  let saving = $state(false);
  /** @type {ReturnType<typeof keepDraft> | null} */
  let draft = null;
  /** @type {{ settled: () => Promise<void> } | undefined} */
  let tray = $state();

  const openIssues = $derived(issues.filter((issue) => ACTIVE_ISSUE_STATUSES.includes(issue.status)));

  // The same rule the database applies: a note, a photo, or a kind other than Observation
  const canSave = $derived(
    values.note.trim() !== '' || values.kind !== 'observation' || values.photos.some((item) => item.status !== 'failed')
  );
  const started = $derived(JSON.stringify(values) !== JSON.stringify(blank()));

  // A draft left from before, perhaps when the phone discarded the page, comes back silently
  $effect(() => {
    const key = `entry:${plantId}`;
    let gone = false;
    getDraft(key)
      .then((saved) => {
        if (gone) return;
        if (saved) values = { ...blank(), ...saved };
        // Photos join the draft once processed; one still processing can't be picked up again
        draft = keepDraft(key, () => {
          const snapshot = $state.snapshot(values);
          return { ...snapshot, photos: readyPhotos(snapshot.photos) };
        });
      })
      .catch((error) => logError(error, { operation: 'getDraft' }));
    return () => {
      gone = true;
      draft?.stop();
      draft = null;
    };
  });

  // A blank form has nothing worth keeping, whether it was saved, cleared or emptied by hand
  $effect(() => {
    JSON.stringify(values);
    if (started) draft?.changed();
    else draft?.discard().catch((error) => logError(error, { operation: 'clearDraft' }));
  });

  function reset() {
    values = blank();
    errors = {};
    problem = null;
  }

  /** @param {SubmitEvent} event */
  async function submit(event) {
    event.preventDefault();
    if (saving || !canSave) return;
    const form = /** @type {HTMLFormElement} */ (event.target);
    problem = null;
    // The picker stops at today, but a date can still be typed
    errors = isFuture(values.occurredOn) ? { occurredOn: strings.errors.field.future } : {};
    if (errors.occurredOn) return focusFirstProblem(form);
    saving = true;
    try {
      // Photos still being processed are waited for, not left behind
      await tray?.settled();
      const { photos: picked, ...fields } = $state.snapshot(values);
      const photos = readyPhotos(picked).map((item) => item.photo);
      await createEntry(plantId, {
        ...fields,
        photos,
        // An issue resolved since the form was filled in is no longer offered
        issueId: openIssues.some((issue) => issue.id === fields.issueId) ? fields.issueId : null
      });
      reset();
      // Closes the phone's keyboard, so the new entry can be seen arriving
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      showToast(strings.toasts.saved);
      if (photos.length) checkStorage();
    } catch (error) {
      const failure = saveFailure(error, FIELDS);
      if (failure.field) errors = { [failure.field]: failure.message };
      problem = failure.problem;
      focusFirstProblem(form);
    } finally {
      saving = false;
    }
  }
</script>

<form class="card card-pad composer" aria-label={strings.entry.form} novalidate onsubmit={submit}>
  {#if problem}<InlineProblem {problem} />{/if}
  <EntryFields bind:values {errors} issues={openIssues} composer />
  <PhotoTray bind:this={tray} bind:photos={values.photos} />
  <div class="composer-footer">
    <!-- Shows today until another day is chosen; an empty value keeps meaning today -->
    <label>
      <span class="sr-only">{strings.entry.date}</span>
      <input
        class="input"
        type="date"
        name="occurredOn"
        max={app.today}
        bind:value={() => values.occurredOn || app.today, (date) => (values.occurredOn = date === app.today ? '' : date)}
        aria-invalid={errors.occurredOn ? 'true' : undefined}
        aria-describedby={errors.occurredOn ? dateErrorId : undefined}
      />
    </label>
    <div class="cluster">
      {#if started}
        <button class="btn btn-icon btn-quiet" type="button" aria-label={strings.entry.clear} onclick={reset}>
          <Icon name="close" />
        </button>
      {/if}
      <button class="btn btn-primary" type="submit" disabled={!canSave} aria-busy={saving ? 'true' : undefined}>
        {strings.entry.save}
      </button>
    </div>
  </div>
  {#if errors.occurredOn}<p class="error" id={dateErrorId}>{errors.occurredOn}</p>{/if}
</form>
