<script>
  import { untrack } from 'svelte';
  import Field from './Field.svelte';
  import Icon from './Icon.svelte';
  import FormProblem from './FormProblem.svelte';
  import Sheet from './Sheet.svelte';
  import { createGarden, deleteGarden, findStartGardenId, updateGarden } from '../lib/db/index.js';
  import { GARDEN_STATUSES, LIMITS } from '../lib/constants.js';
  import { focusFirstProblem, saveFailure } from '../lib/forms.js';
  import { reportError, showToast } from '../lib/state/app.svelte.js';
  import { closeSheet, navigate, paths } from '../lib/state/router.svelte.js';
  import { compareText, strings } from '../lib/strings.js';

  /** @type {{ open: boolean, garden?: Record<string, any> }} With a garden, edits it; otherwise adds one. */
  let { open, garden } = $props();

  const DETAILS = ['ownerName', 'contact', 'address', 'soil', 'aspect', 'notes'];
  const FIELDS = ['name', 'status', ...DETAILS];
  const blank = () => ({ name: '', status: 'active', ownerName: '', contact: '', address: '', soil: '', aspect: '', notes: '' });
  const statusOptions = GARDEN_STATUSES.values.map((value) => ({ value, label: GARDEN_STATUSES.label(value) }));

  let values = $state(blank());
  /** @type {Record<string, string>} */
  let errors = $state({});
  /** @type {import('../lib/errors.js').Explanation | null} */
  let problem = $state(null);
  let saving = $state(false);
  let showDetails = $state(false);
  let confirmingDelete = $state(false);
  let confirmName = $state('');
  let deleting = $state(false);

  $effect(() => {
    if (!open) return;
    untrack(() => {
      values = garden
        ? { ...blank(), ...Object.fromEntries(FIELDS.map((field) => [field, garden[field] ?? ''])) }
        : blank();
      errors = {};
      problem = null;
      confirmingDelete = false;
      confirmName = '';
      showDetails = DETAILS.some((field) => values[/** @type {keyof typeof values} */ (field)] !== '');
    });
  });

  /** @param {SubmitEvent} event */
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    problem = null;
    errors = values.name.trim() ? {} : { name: strings.errors.field.required };
    if (errors.name) return focusFirstProblem();

    saving = true;
    try {
      if (garden) {
        await updateGarden(garden.id, values);
        showToast(strings.toasts.saved);
        closeSheet();
      } else {
        const { status, ...input } = values;
        const id = await createGarden(input);
        showToast(strings.toasts.gardenAdded);
        // Replaces the sheet's history entry, so back returns to the garden it was opened from
        navigate(paths.garden(id), { replace: true });
      }
    } catch (error) {
      const failure = saveFailure(error, FIELDS);
      if (failure.field) {
        errors = { [failure.field]: failure.message };
        if (DETAILS.includes(failure.field)) showDetails = true;
      }
      problem = failure.problem;
      focusFirstProblem();
    } finally {
      saving = false;
    }
  }

  async function remove() {
    if (!garden || deleting) return;
    deleting = true;
    try {
      await deleteGarden(garden.id);
      const nextId = await findStartGardenId();
      showToast(strings.toasts.gardenDeleted);
      navigate(nextId ? paths.garden(nextId) : paths.start, { replace: true });
    } catch (error) {
      reportError(error, { operation: 'deleteGarden', gardenId: garden.id });
    } finally {
      deleting = false;
    }
  }

  const nameMatches = $derived(!!garden && compareText(confirmName.trim(), garden.name) === 0);
</script>

<Sheet {open} title={garden ? strings.gardenSheet.editTitle : strings.gardenSheet.addTitle} onsubmit={submit}>
  <div class="stack">
    {#if problem}<FormProblem {problem} />{/if}
    <Field label={strings.gardenSheet.name} name="name" autocomplete="off" maxlength={LIMITS.name} bind:value={values.name} error={errors.name} />
    {#if garden}
      <Field label={strings.gardenSheet.status} name="status" options={statusOptions} bind:value={values.status} error={errors.status} />
    {/if}

    <button
      class="btn btn-quiet"
      type="button"
      aria-expanded={showDetails}
      aria-controls="garden-details"
      onclick={() => (showDetails = !showDetails)}
    >
      {strings.gardenSheet.more}
      <Icon name="chevronDown" />
    </button>
    <div class="reveal" class:is-open={showDetails} id="garden-details" inert={!showDetails}>
      <div class="stack">
        <Field label={strings.gardenSheet.ownerName} name="ownerName" autocomplete="off" maxlength={LIMITS.name} bind:value={values.ownerName} error={errors.ownerName} />
        <Field label={strings.gardenSheet.contact} name="contact" autocomplete="off" hint={strings.gardenSheet.contactHint} maxlength={LIMITS.name} bind:value={values.contact} error={errors.contact} />
        <Field label={strings.gardenSheet.address} name="address" multiline maxlength={LIMITS.note} bind:value={values.address} error={errors.address} />
        <div class="field-row">
          <Field label={strings.gardenSheet.soil} name="soil" autocomplete="off" maxlength={LIMITS.name} bind:value={values.soil} error={errors.soil} />
          <Field label={strings.gardenSheet.aspect} name="aspect" autocomplete="off" hint={strings.gardenSheet.aspectHint} maxlength={LIMITS.name} bind:value={values.aspect} error={errors.aspect} />
        </div>
        <Field label={strings.gardenSheet.notes} name="notes" multiline maxlength={LIMITS.note} bind:value={values.notes} error={errors.notes} />
      </div>
    </div>

    {#if garden}
      <hr />
      {#if confirmingDelete}
        <div class="stack stack-sm">
          <Field label={strings.gardenSheet.confirmLabel(garden.name)} name="confirmDelete" autocomplete="off" bind:value={confirmName} />
          <p class="hint">{strings.gardenSheet.deleteWarning}</p>
          <button
            class="btn btn-primary btn-danger"
            type="button"
            disabled={!nameMatches}
            aria-busy={deleting ? 'true' : undefined}
            onclick={remove}
          >
            {strings.gardenSheet.deleteConfirm}
          </button>
        </div>
      {:else}
        <button class="btn btn-quiet btn-danger" type="button" onclick={() => (confirmingDelete = true)}>
          {strings.gardenSheet.delete}
        </button>
      {/if}
    {/if}
  </div>

  {#snippet footer()}
    <button class="btn" type="button" onclick={closeSheet}>{strings.gardenSheet.cancel}</button>
    <button class="btn btn-primary" type="submit" aria-busy={saving ? 'true' : undefined}>
      {garden ? strings.gardenSheet.save : strings.gardenSheet.add}
    </button>
  {/snippet}
</Sheet>
