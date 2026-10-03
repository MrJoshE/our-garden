<script>
  import { onMount } from 'svelte';
  import { startDatabase } from './lib/db/index.js';
  import { app, block, checkStorage, reportError } from './lib/state/app.svelte.js';
  import { paths, route } from './lib/state/router.svelte.js';
  import { explainError } from './lib/errors.js';
  import { strings } from './lib/strings.js';
  import ProblemBanner from './components/ProblemBanner.svelte';
  import ProblemScreen from './components/ProblemScreen.svelte';
  import SettingsSheet from './components/SettingsSheet.svelte';
  import StorageBanner from './components/StorageBanner.svelte';
  import Toasts from './components/Toasts.svelte';
  import NotFound from './components/NotFound.svelte';
  import Start from './pages/Start.svelte';
  import Garden from './pages/Garden.svelte';
  import Plant from './pages/Plant.svelte';

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
    checkStorage();
  });
</script>

{#if app.blocking}
  <ProblemScreen problem={app.blocking} />
{:else if ready}
  {#if app.problem}
    <ProblemBanner problem={app.problem} onDismiss={() => (app.problem = null)} />
  {:else if app.storageLow}
    <StorageBanner />
  {/if}
  <svelte:boundary onerror={(error) => reportError(error, { operation: 'render' })}>
    {#if route.name === 'start'}
      <Start />
    {:else if route.name === 'garden'}
      <Garden />
    {:else if route.name === 'plant'}
      <Plant />
    {:else}
      <NotFound href={paths.start} label={strings.navigation.toGardens} />
    {/if}

    {#snippet failed(error, reset)}
      <ProblemScreen problem={explainError(error)} onRetry={reset} />
    {/snippet}
  </svelte:boundary>
  <!-- Here, not on a page, because the storage banner opens it from anywhere -->
  <SettingsSheet open={route.sheet === 'settings'} />
{/if}

<Toasts />
