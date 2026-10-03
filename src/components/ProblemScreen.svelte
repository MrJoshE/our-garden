<script>
  import { strings } from '../lib/strings.js';

  /** @type {{ problem: import('../lib/errors.js').Explanation, onRetry?: () => void }} */
  let { problem, onRetry } = $props();

  const buttons = $derived(
    [
      onRetry && problem.actions.includes('retry') && { label: strings.actions.retry, run: onRetry },
      problem.actions.includes('reload') && { label: strings.actions.reload, run: () => location.reload() }
    ].filter((button) => !!button)
  );
</script>

<main class="page page-narrow">
  <div class="empty" role="alert">
    <h1>{problem.title}</h1>
    <p>{problem.message}</p>
    {#if buttons.length}
      <div class="cluster">
        {#each buttons as button, i (button.label)}
          <button class="btn" class:btn-primary={i === 0} type="button" onclick={button.run}>{button.label}</button>
        {/each}
      </div>
    {/if}
  </div>
</main>
