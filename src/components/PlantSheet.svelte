<script>
  import { untrack } from 'svelte';
  import Field from './Field.svelte';
  import Icon from './Icon.svelte';
  import FormProblem from './FormProblem.svelte';
  import Sheet from './Sheet.svelte';
  import { createPlant, getDraft, getPlant, updatePlant } from '../lib/db/index.js';
  import { LIMITS, PLANT_STATUSES } from '../lib/constants.js';
  import { today } from '../lib/dates.js';
  import { focusFirstProblem, saveFailure } from '../lib/forms.js';
  import { showToast } from '../lib/state/app.svelte.js';
  import { keepDraft } from '../lib/state/drafts.js';
  import { closeSheet } from '../lib/state/router.svelte.js';
  import { strings } from '../lib/strings.js';

  /** @type {{ open: boolean, gardenId: string, plantId?: string }} With plantId, edits that plant; otherwise adds one. */
  let { open, gardenId, plantId } = $props();

  const DETAILS = ['botanicalName', 'variety', 'plantedOn', 'quantity', 'source', 'careNotes', 'tags'];
  const FIELDS = ['commonName', 'location', 'status', ...DETAILS];
  const blank = () => ({
    commonName: '',
    location: '',
    status: 'growing',
    botanicalName: '',
    variety: '',
    plantedOn: '',
    quantity: '',
    source: '',
    careNotes: '',
    tags: ''
  });
  const statusOptions = PLANT_STATUSES.values.map((value) => ({ value, label: PLANT_STATUSES.label(value) }));

  let values = $state(blank());
  /** @type {Record<string, string>} */
  let errors = $state({});
  /** @type {import('../lib/errors.js').Explanation | null} */
  let problem = $state(null);
  let saving = $state(false);
  let showDetails = $state(false);
  /** @type {ReturnType<typeof keepDraft> | null} */
  let draft = null;

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

  // Every change to the form goes into the draft
  $effect(() => {
    JSON.stringify(values);
    draft?.changed();
  });

  /** @param {() => boolean} closed */
  async function load(closed) {
    errors = {};
    problem = null;
    saving = false;
    if (plantId) {
      const plant = await getPlant(plantId);
      if (closed() || !plant) return;
      values = {
        ...blank(),
        ...Object.fromEntries(FIELDS.map((field) => [field, plant[field] == null ? '' : String(plant[field])])),
        tags: (plant.tags ?? []).join(', ')
      };
    } else {
      const key = `plant:${gardenId}`;
      const saved = await getDraft(key);
      if (closed()) return;
      values = { ...blank(), ...saved };
      draft = keepDraft(key, () => $state.snapshot(values));
    }
    showDetails = DETAILS.some((field) => values[/** @type {keyof typeof values} */ (field)] !== '');
  }

  /** @param {SubmitEvent} event */
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    problem = null;
    errors = values.commonName.trim() ? {} : { commonName: strings.errors.field.required };
    if (errors.commonName) return focusFirstProblem();

    saving = true;
    const { status, ...rest } = values;
    const input = { ...rest, tags: values.tags.split(',').map((tag) => tag.trim()).filter(Boolean) };
    try {
      if (plantId) {
        await updatePlant(plantId, { ...input, status });
        showToast(strings.toasts.saved);
      } else {
        await createPlant(gardenId, input);
        await draft?.discard();
        showToast(strings.toasts.plantAdded);
      }
      closeSheet();
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

  async function cancel() {
    await draft?.discard();
    closeSheet();
  }
</script>

<Sheet {open} title={plantId ? strings.plantSheet.editTitle : strings.plantSheet.addTitle} onsubmit={submit}>
  <div class="stack">
    {#if problem}<FormProblem {problem} />{/if}
    <Field
      label={strings.plantSheet.commonName}
      name="commonName"
      autocomplete="off"
      maxlength={LIMITS.name}
      bind:value={values.commonName}
      error={errors.commonName}
    />
    <Field
      label={strings.plantSheet.location}
      name="location"
      optional
      autocomplete="off"
      maxlength={LIMITS.name}
      bind:value={values.location}
      error={errors.location}
    />
    {#if plantId}
      <Field
        label={strings.plantSheet.status}
        name="status"
        options={statusOptions}
        bind:value={values.status}
        error={errors.status}
      />
    {/if}

    <button
      class="btn btn-quiet"
      type="button"
      aria-expanded={showDetails}
      aria-controls="plant-details"
      onclick={() => (showDetails = !showDetails)}
    >
      {strings.plantSheet.more}
      <Icon name="chevronDown" />
    </button>
    <div class="reveal" class:is-open={showDetails} id="plant-details" inert={!showDetails}>
      <div class="stack">
        <Field label={strings.plantSheet.botanicalName} name="botanicalName" autocomplete="off" maxlength={LIMITS.name} bind:value={values.botanicalName} error={errors.botanicalName} />
        <Field label={strings.plantSheet.variety} name="variety" autocomplete="off" maxlength={LIMITS.name} bind:value={values.variety} error={errors.variety} />
        <div class="field-row">
          <Field label={strings.plantSheet.plantedOn} name="plantedOn" type="date" max={today()} bind:value={values.plantedOn} error={errors.plantedOn} />
          <Field label={strings.plantSheet.quantity} name="quantity" type="number" inputmode="numeric" min="1" step="1" bind:value={values.quantity} error={errors.quantity} />
        </div>
        <Field label={strings.plantSheet.source} name="source" autocomplete="off" maxlength={LIMITS.name} bind:value={values.source} error={errors.source} />
        <Field label={strings.plantSheet.careNotes} name="careNotes" multiline maxlength={LIMITS.note} bind:value={values.careNotes} error={errors.careNotes} />
        <Field label={strings.plantSheet.tags} name="tags" autocomplete="off" hint={strings.plantSheet.tagsHint} bind:value={values.tags} error={errors.tags} />
      </div>
    </div>
  </div>

  {#snippet footer()}
    <button class="btn" type="button" onclick={cancel}>{strings.plantSheet.cancel}</button>
    <button class="btn btn-primary" type="submit" aria-busy={saving ? 'true' : undefined}>
      {plantId ? strings.plantSheet.save : strings.plantSheet.add}
    </button>
  {/snippet}
</Sheet>
