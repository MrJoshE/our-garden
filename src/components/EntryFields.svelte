<script>
  import Field from './Field.svelte';
  import { ENTRY_KINDS, KINDS_WITH_PRODUCT, LIMITS } from '../lib/constants.js';
  import { app } from '../lib/state/app.svelte.js';
  import { strings } from '../lib/strings.js';

  /**
   * The fields of a journal entry, shared by the entry form on the plant page
   * and the edit entry sheet. An empty occurredOn means today, whichever day
   * that turns out to be when it is saved.
   * @type {{
   *   values: { note: string, kind: string, occurredOn: string, product: string, issueId: string },
   *   errors: Record<string, string>,
   *   issues: Record<string, any>[],
   *   composer?: boolean
   * }} issues: the plant's open issues, to link the entry to; composer: the
   *   compact form on the plant page, where the note's placeholder and the
   *   chips say what they are for, and the date sits in the form's footer
   */
  let { values = $bindable(), errors, issues, composer = false } = $props();

  const kindsId = $props.id();
  const kinds = ENTRY_KINDS.values.map((value) => ({ value, label: ENTRY_KINDS.label(value) }));
  const hasProduct = $derived(KINDS_WITH_PRODUCT.includes(values.kind));
  const issueOptions = $derived([
    { value: '', label: strings.entry.noIssue },
    ...issues.map((issue) => ({ value: issue.id, label: issue.title }))
  ]);
</script>

<Field
  label={strings.entry.note}
  hideLabel={composer}
  placeholder={composer ? strings.entry.notePlaceholder : undefined}
  name="note"
  multiline
  maxlength={LIMITS.note}
  bind:value={values.note}
  error={errors.note}
/>

<fieldset class="field" aria-describedby={errors.kind ? `${kindsId}-error` : undefined}>
  <legend class="label" class:sr-only={composer}>{strings.entry.kind}</legend>
  <div class="kind-picker">
    {#each kinds as kind (kind.value)}
      <label class="chip" data-kind={kind.value}>
        <input type="radio" name="kind" value={kind.value} bind:group={values.kind} />
        {kind.label}
      </label>
    {/each}
  </div>
  {#if errors.kind}<p class="error" id="{kindsId}-error">{errors.kind}</p>{/if}
</fieldset>

{#if !composer || hasProduct}
<div class="field-row">
  {#if !composer}
    <Field
      label={strings.entry.date}
      name="occurredOn"
      type="date"
      max={app.today}
      bind:value={() => values.occurredOn || app.today, (date) => (values.occurredOn = date === app.today ? '' : date)}
      error={errors.occurredOn}
    />
  {/if}
  {#if hasProduct}
    <Field
      label={strings.entry.product}
      name="product"
      autocomplete="off"
      maxlength={LIMITS.name}
      hint={strings.entry.productHint}
      bind:value={values.product}
      error={errors.product}
    />
  {/if}
</div>
{/if}

{#if issues.length}
  <Field
    label={strings.entry.issue}
    name="issueId"
    options={issueOptions}
    bind:value={values.issueId}
    error={errors.issueId}
  />
{/if}

<style>
  fieldset {
    border: 0;
    padding: 0;
    margin: 0;
  }
  legend {
    padding: 0;
    margin-bottom: var(--space-1);
  }
</style>
