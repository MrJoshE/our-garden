<script>
  import { untrack } from 'svelte';
  import DayField from './DayField.svelte';
  import Field from './Field.svelte';
  import InlineProblem from './InlineProblem.svelte';
  import PhotoTray, { readyPhotos } from './PhotoTray.svelte';
  import Sheet from './Sheet.svelte';
  import { createIssue, getDraft } from '../lib/db/index.js';
  import { ISSUE_KINDS, LIMITS, SEVERITIES } from '../lib/constants.js';
  import { isFuture } from '../lib/dates.js';
  import { focusFirstProblem, saveFailure } from '../lib/forms.js';
  import { checkStorage, showToast } from '../lib/state/app.svelte.js';
  import { keepDraft } from '../lib/state/drafts.js';
  import { closeSheet } from '../lib/state/router.svelte.js';
  import { strings } from '../lib/strings.js';

  /** @type {{ open: boolean, plantId: string }} */
  let { open, plantId } = $props();

  const FIELDS = ['title', 'kind', 'severity', 'firstSeenOn', 'notes'];
  // "Other" until she says, rather than a guess that would mislabel the card
  const blank = () => ({
    title: '',
    kind: 'other',
    severity: 'medium',
    firstSeenOn: '',
    notes: '',
    /** @type {import('./PhotoTray.svelte').TrayPhoto[]} */
    photos: []
  });
  const kindOptions = ISSUE_KINDS.values.map((value) => ({ value, label: ISSUE_KINDS.label(value) }));

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

  $effect(() => {
    if (!open) return;
    let closed = false;
    untrack(() => load(() => closed));
    return () => {
      closed = true;
      draft?.stop();
      draft = null;
    };
  });

  // Every change, photos included once processed, goes into the draft
  $effect(() => {
    JSON.stringify(values);
    draft?.changed();
  });

  /** @param {() => boolean} closed */
  async function load(closed) {
    errors = {};
    problem = null;
    saving = false;
    const key = `issue:${plantId}`;
    const saved = await getDraft(key);
    if (closed()) return;
    values = { ...blank(), ...saved };
    draft = keepDraft(key, () => {
      const snapshot = $state.snapshot(values);
      return { ...snapshot, photos: readyPhotos(snapshot.photos) };
    });
  }

  /** @param {SubmitEvent} event */
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    problem = null;
    errors = !values.title.trim()
      ? { title: strings.errors.field.required }
      : isFuture(values.firstSeenOn)
        ? { firstSeenOn: strings.errors.field.future }
        : {};
    if (Object.keys(errors).length) return focusFirstProblem();

    saving = true;
    try {
      // Photos still being processed are waited for, not left behind
      await tray?.settled();
      const { photos: picked, ...fields } = $state.snapshot(values);
      const photos = readyPhotos(picked).map((item) => item.photo);
      await createIssue(plantId, { ...fields, photos });
      await draft?.discard();
      showToast(strings.toasts.problemFlagged);
      closeSheet();
      if (photos.length) checkStorage();
    } catch (error) {
      const failure = saveFailure(error, FIELDS);
      if (failure.field) errors = { [failure.field]: failure.message };
      problem = failure.problem;
      focusFirstProblem();
    } finally {
      saving = false;
    }
  }

  async function cancel() {
    await draft?.discard();
    closeSheet();
  }
</script>

<Sheet {open} title={strings.issueSheet.addTitle} onsubmit={submit}>
  <div class="stack">
    {#if problem}<InlineProblem {problem} />{/if}
    <Field
      label={strings.issueSheet.title}
      name="title"
      autocomplete="off"
      maxlength={LIMITS.name}
      hint={strings.issueSheet.titleHint}
      bind:value={values.title}
      error={errors.title}
    />
    <div class="field-row">
      <Field label={strings.issueSheet.kind} name="kind" options={kindOptions} bind:value={values.kind} error={errors.kind} />
      <DayField label={strings.issueSheet.firstSeen} name="firstSeenOn" bind:value={values.firstSeenOn} error={errors.firstSeenOn} />
    </div>
    <fieldset class="field">
      <legend class="label">{strings.issueSheet.severity}</legend>
      <div class="cluster">
        {#each SEVERITIES.values as level (level)}
          <label class="chip">
            <input type="radio" name="severity" value={level} bind:group={values.severity} />
            {SEVERITIES.label(level)}
          </label>
        {/each}
      </div>
    </fieldset>
    <Field
      label={strings.issueSheet.notes}
      name="notes"
      optional
      multiline
      maxlength={LIMITS.note}
      bind:value={values.notes}
      error={errors.notes}
    />
    <PhotoTray bind:this={tray} bind:photos={values.photos} />
  </div>

  {#snippet footer()}
    <button class="btn" type="button" onclick={cancel}>{strings.issueSheet.cancel}</button>
    <button class="btn btn-primary" type="submit" aria-busy={saving ? 'true' : undefined}>{strings.issueSheet.save}</button>
  {/snippet}
</Sheet>
