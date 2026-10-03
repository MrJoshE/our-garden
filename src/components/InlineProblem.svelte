<script>
  import { recoveryButtons } from '../lib/errors.js';

  /**
   * A problem shown in place, such as in a form or a section of a page.
   * Without onRetry it offers no buttons: in a form, Save is the way to try
   * again, and a reload could lose what was typed.
   * @type {{ problem: import('../lib/errors.js').Explanation, onRetry?: () => void }}
   */
  let { problem, onRetry } = $props();

  const buttons = $derived(onRetry ? recoveryButtons(problem, onRetry) : []);
</script>

<div class="banner" data-tone="danger" role="alert">
  <div class="grow">
    <strong>{problem.title}</strong>
    {problem.message}
    {#if buttons.length}
      <div class="cluster mt-2">
        {#each buttons as button (button.label)}
          <button class="btn btn-sm" type="button" onclick={button.run}>{button.label}</button>
        {/each}
      </div>
    {/if}
  </div>
</div>
