<script>
  import { onMount } from 'svelte';
  import { startDatabase } from './lib/db/index.js';
  import { app, block, reportError } from './lib/state/app.svelte.js';
  import { explainError } from './lib/errors.js';
  import { strings } from './lib/strings.js';
  import ProblemBanner from './components/ProblemBanner.svelte';
  import ProblemScreen from './components/ProblemScreen.svelte';
  import Toasts from './components/Toasts.svelte';

  let ready = $state(false);

  onMount(async () => {
    try {
      await startDatabase({
        onClosedByUpgrade: () => block('closed'),
        onUpgradeBlocked: () => block('blocked')
      });
    } catch (error) {
      reportError(error, { operation: 'startDatabase' });
      return;
    }
    // Opening waits out a blocked upgrade, so by now any "close other tabs"
    // message no longer applies.
    if (app.blocking?.kind === 'blocked') app.blocking = null;
    ready = true;
  });
</script>

{#if app.blocking}
  <ProblemScreen problem={app.blocking} />
{:else if ready}
  {#if app.problem}
    <ProblemBanner problem={app.problem} onDismiss={() => (app.problem = null)} />
  {/if}
  <svelte:boundary onerror={(error) => reportError(error, { operation: 'render' })}>
    <!-- Pages arrive with the router (step 2.2). -->
    <main class="page">
      <h1>{strings.appName}</h1>
    </main>

    {#snippet failed(error, reset)}
      <ProblemScreen problem={explainError(error)} onRetry={reset} />
    {/snippet}
  </svelte:boundary>
{/if}

<Toasts />
