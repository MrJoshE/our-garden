<script>
  import { untrack } from 'svelte';
  import EntryFields from './EntryFields.svelte';
  import InlineProblem from './InlineProblem.svelte';
  import Sheet from './Sheet.svelte';
  import { updateEntry } from '../lib/db/index.js';
  import { ACTIVE_ISSUE_STATUSES } from '../lib/constants.js';
  import { isFuture } from '../lib/dates.js';
  import { focusFirstProblem, saveFailure } from '../lib/forms.js';
  import { showToast } from '../lib/state/app.svelte.js';
  import { closeSheet } from '../lib/state/router.svelte.js';
  import { strings } from '../lib/strings.js';

  /**
   * Edits one of her entries. Open while `entry` is set.
   * @type {{
   *   entry: Record<string, any> | undefined,
   *   issues: Record<string, any>[],
   *   onDelete: (entry: Record<string, any>) => void
   * }} issues: all the plant's issues; onDelete: closes the sheet and removes the entry
   */
  let { entry, issues, onDelete } = $props();

  const FIELDS = ['note', 'kind', 'occurredOn', 'product', 'issueId'];

  let values = $state({ note: '', kind: 'observation', occurredOn: '', product: '', issueId: '' });
  /** @type {Record<string, string>} */
  let errors = $state({});
  /** @type {import('../lib/errors.js').Explanation | null} */
  let problem = $state(null);
  let saving = $state(false);

  // Open issues, and the one this entry is already linked to even if it has since been resolved
  const offered = $derived(
    issues.filter((issue) => ACTIVE_ISSUE_STATUSES.includes(issue.status) || issue.id === entry?.issueId)
  );
  // The same rule the database applies: a note, a photo, or a kind other than Observation
  const canSave = $derived(values.note.trim() !== '' || values.kind !== 'observation' || entry?.photos.length > 0);

  // Filled in when a sheet opens for an entry, not again when the entry changes
  // elsewhere, which would throw away what she is typing
  const entryId = $derived(entry?.id);
  $effect(() => {
    if (!entryId) return;
    untrack(() => {
      if (!entry) return;
      values = {
        note: entry.note ?? '',
        kind: entry.kind,
        occurredOn: entry.occurredOn,
        product: entry.product ?? '',
        issueId: entry.issueId ?? ''
      };
      errors = {};
      problem = null;
    });
  });

  /** @param {SubmitEvent} event */
  async function submit(event) {
    event.preventDefault();
    if (!entry || saving || !canSave) return;
    problem = null;
    errors = isFuture(values.occurredOn) ? { occurredOn: strings.errors.field.future } : {};
    if (errors.occurredOn) return focusFirstProblem();
    saving = true;
    try {
      await updateEntry(entry.id, {
        ...values,
        issueId: offered.some((issue) => issue.id === values.issueId) ? values.issueId : null
      });
      showToast(strings.toasts.saved);
      closeSheet();
    } catch (error) {
      const failure = saveFailure(error, FIELDS);
      if (failure.field) errors = { [failure.field]: failure.message };
      problem = failure.problem;
      focusFirstProblem();
    } finally {
      saving = false;
    }
  }
</script>

<Sheet open={!!entry} title={strings.entrySheet.title} onsubmit={submit}>
  <div class="stack">
    {#if problem}<InlineProblem {problem} />{/if}
    <EntryFields bind:values {errors} issues={offered} />
    <hr />
    <button class="btn btn-quiet btn-danger" type="button" onclick={() => entry && onDelete(entry)}>
      {strings.entrySheet.delete}
    </button>
  </div>

  {#snippet footer()}
    <button class="btn" type="button" onclick={closeSheet}>{strings.entrySheet.cancel}</button>
    <button class="btn btn-primary" type="submit" disabled={!canSave} aria-busy={saving ? 'true' : undefined}>
      {strings.entrySheet.save}
    </button>
  {/snippet}
</Sheet>
