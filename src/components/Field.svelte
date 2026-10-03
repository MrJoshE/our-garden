<script>
  import { strings } from '../lib/strings.js';

  /**
   * A labelled input, textarea or select with its error and any hint
   * underneath. Other attributes (name, type, autocomplete, autofocus…) go
   * to the control.
   * @type {{
   *   label: string,
   *   value: string,
   *   error?: string,
   *   hint?: string,
   *   maxlength?: number,
   *   optional?: boolean,
   *   hideLabel?: boolean,
   *   multiline?: boolean,
   *   options?: { value: string, label: string }[]
   * } & Record<string, any>}
   */
  let {
    label,
    value = $bindable(''),
    error = '',
    hint = '',
    maxlength,
    optional = false,
    hideLabel = false,
    multiline = false,
    options,
    ...rest
  } = $props();

  const id = $props.id();
  // Only near the limit is the count worth the space
  const showCount = $derived(maxlength !== undefined && value.length >= maxlength * 0.9);

  // Shake once each time an error appears
  let shaking = $state(false);
  $effect(() => {
    if (error) shaking = true;
  });

  // The message goes once she changes the field, and comes back if the form
  // is submitted with the field still wrong
  let edited = $state(false);
  const shownError = $derived(edited ? '' : error);
  /** @type {HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | undefined} */
  let control = $state();
  // Captured on the way down, so the message is back before the form's own
  // submit handler looks for a field to focus
  $effect(() => {
    /** @param {Event} event */
    const reset = (event) => {
      if (event.target === control?.form) edited = false;
    };
    addEventListener('submit', reset, { capture: true });
    return () => removeEventListener('submit', reset, { capture: true });
  });
</script>

<div class="field" class:is-shaking={shaking} onanimationend={() => (shaking = false)}>
  <!-- A hidden label is still read out, for a field whose placeholder says what it is for -->
  <label for={id} class:sr-only={hideLabel}>
    {label}
    {#if optional}<span class="optional">{strings.form.optional}</span>{/if}
  </label>
  {#if options}
    <select
      bind:this={control}
      {id}
      class="select"
      bind:value
      aria-invalid={shownError ? 'true' : undefined}
      aria-describedby={shownError ? `${id}-error` : undefined}
      oninput={() => (edited = true)}
      {...rest}
    >
      {#each options as option (option.value)}<option value={option.value}>{option.label}</option>{/each}
    </select>
  {:else if multiline}
    <textarea
      bind:this={control}
      {id}
      class="textarea"
      bind:value
      {maxlength}
      aria-invalid={shownError ? 'true' : undefined}
      aria-describedby={shownError ? `${id}-error` : undefined}
      oninput={() => (edited = true)}
      {...rest}
    ></textarea>
  {:else}
    <input
      bind:this={control}
      {id}
      class="input"
      bind:value
      {maxlength}
      aria-invalid={shownError ? 'true' : undefined}
      aria-describedby={shownError ? `${id}-error` : undefined}
      oninput={() => (edited = true)}
      {...rest}
    />
  {/if}
  {#if hint}<p class="hint">{hint}</p>{/if}
  {#if showCount && maxlength !== undefined}
    <p class="hint">{strings.form.count(value.length, maxlength)}</p>
  {/if}
  {#if shownError}
    <p class="error" id="{id}-error">{shownError}</p>
  {/if}
</div>
