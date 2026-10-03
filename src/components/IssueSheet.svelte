<script>
  import { untrack } from 'svelte';
  import DayField from './DayField.svelte';
  import Field from './Field.svelte';
  import InlineProblem from './InlineProblem.svelte';
  import PhotoTray, { readyPhotos } from './PhotoTray.svelte';
  import Sheet from './Sheet.svelte';
  import { createIssue, getDraft, updateIssue } from '../lib/db/index.js';
  import { ISSUE_KINDS, LIMITS, SEVERITIES } from '../lib/constants.js';
  import { isFuture } from '../lib/dates.js';
  import { focusFirstProblem, saveFailure } from '../lib/forms.js';
  import { checkStorage, showToast } from '../lib/state/app.svelte.js';
  import { keepDraft } from '../lib/state/drafts.js';
  import { closeSheet } from '../lib/state/router.svelte.js';
  import { strings } from '../lib/strings.js';

  /**
   * Flags a problem, or with `issue`, edits one.
   * @type {{
   *   open: boolean,
   *   plantId: string,
   *   issue?: Record<string, any>,
   *   onDelete?: (issue: Record<string, any>) => void
   * }} onDelete: closes the sheet and deletes the problem
   */
  let { open, plantId, issue, onDelete } = $props();

  // Stays the last problem edited, so the sheet keeps its edit look while it
  // slides away after the problem is saved or deleted
  /** @type {Record<string, any> | undefined} */
  let editing = $state();
  $effect(() => {
    if (issue) editing = issue;
  });

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
    // An edit starts from the problem as it is, and keeps no draft (brief section 7)
    if (editing) {
      values = { ...blank(), ...Object.fromEntries(FIELDS.map((field) => [field, editing?.[field] ?? ''])) };
      return;
    }
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
      if (editing) {
        await updateIssue(editing.id, fields);
        showToast(strings.toasts.saved);
        closeSheet();
        return;
      }
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

<Sheet {open} title={editing ? strings.issueSheet.editTitle : strings.issueSheet.addTitle} onsubmit={submit}>
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
    {#if editing}
      <hr />
      <button class="btn btn-quiet btn-danger" type="button" onclick={() => editing && onDelete?.(editing)}>
        {strings.issueSheet.delete}
      </button>
    {:else}
      <PhotoTray bind:this={tray} bind:photos={values.photos} />
    {/if}
  </div>

  {#snippet footer()}
    <button class="btn" type="button" onclick={cancel}>{strings.issueSheet.cancel}</button>
    <button class="btn btn-primary" type="submit" aria-busy={saving ? 'true' : undefined}>
      {editing ? strings.issueSheet.saveEdit : strings.issueSheet.save}
    </button>
  {/snippet}
</Sheet>
