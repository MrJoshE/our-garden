<script>
  import { strings } from '../lib/strings.js';

  /**
   * A labelled text input or textarea with its error underneath. Other
   * attributes (name, type, autocomplete, autofocus…) go to the control.
   * @type {{
   *   label: string,
   *   value: string,
   *   error?: string,
   *   maxlength?: number,
   *   optional?: boolean,
   *   multiline?: boolean
   * } & Record<string, any>}
   */
  let { label, value = $bindable(''), error = '', maxlength, optional = false, multiline = false, ...rest } = $props();

  const id = $props.id();
  // Only near the limit is the count worth the space
  const showCount = $derived(maxlength !== undefined && value.length >= maxlength * 0.9);

  // Shake once each time an error appears
  let shaking = $state(false);
  $effect(() => {
    if (error) shaking = true;
  });
</script>

<div class="field" class:is-shaking={shaking} onanimationend={() => (shaking = false)}>
  <label for={id}>
    {label}
    {#if optional}<span class="optional">{strings.form.optional}</span>{/if}
  </label>
  {#if multiline}
    <textarea
      {id}
      class="textarea"
      bind:value
      {maxlength}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      {...rest}
    ></textarea>
  {:else}
    <input
      {id}
      class="input"
      bind:value
      {maxlength}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      {...rest}
    />
  {/if}
  {#if showCount && maxlength !== undefined}
    <p class="hint">{strings.form.count(value.length, maxlength)}</p>
  {/if}
  {#if error}
    <p class="error" id="{id}-error">{error}</p>
  {/if}
</div>
