<script>
  import { onMount } from 'svelte';
  import { startDatabase } from './lib/db/index.js';
  import { registerSW } from 'virtual:pwa-register';
  import { app, block, checkBackupReminder, checkStorage, reportError } from './lib/state/app.svelte.js';
  import { saveWaitingDrafts } from './lib/state/drafts.js';
  import { openSheet, paths, route } from './lib/state/router.svelte.js';
  import { logError } from './lib/log.js';
  import { explainError } from './lib/errors.js';
  import { strings } from './lib/strings.js';
  import ProblemBanner from './components/ProblemBanner.svelte';
  import ProblemScreen from './components/ProblemScreen.svelte';
  import SettingsSheet from './components/SettingsSheet.svelte';
  import ActionBanner from './components/ActionBanner.svelte';
  import Toasts from './components/Toasts.svelte';
  import NotFound from './components/NotFound.svelte';
  import Start from './pages/Start.svelte';
  import Garden from './pages/Garden.svelte';
  import Plant from './pages/Plant.svelte';

  let ready = $state(false);

  // Prompt mode: a new version waits until she chooses Update now (brief section 7)
  let updating = false;
  const updateServiceWorker = registerSW({
    onNeedRefresh: () => (app.updateReady = true),
    // The new version has taken over. If another tab chose Update now, this
    // one waits for her rather than reloading over whatever she's typing.
    onNeedReload: () => (updating ? location.reload() : (app.updateReady = true)),
    onRegisterError: (error) => logError(error, { operation: 'registerServiceWorker' })
  });

  async function updateNow() {
    updating = true;
    // Updating reloads the page, which can cut short a draft still waiting to be saved
    await saveWaitingDrafts();
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration?.waiting) await updateServiceWorker(true);
    else location.reload();
  }

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
    checkBackupReminder();
  });
</script>

{#if app.blocking}
  <ProblemScreen problem={app.blocking} />
{:else if ready}
  {#if app.problem}
    <ProblemBanner problem={app.problem} onDismiss={() => (app.problem = null)} />
  {:else if app.updateReady}
    <ActionBanner
      tone="info"
      title={strings.update.title}
      message={strings.update.message}
      action={strings.update.action}
      onAction={updateNow}
      onDismiss={() => (app.updateReady = false)}
    />
  {:else if app.storageLow}
    <!-- Shown again after the next photos are saved, if the device is still nearly full -->
    <ActionBanner
      tone="attention"
      title={strings.storage.title}
      message={strings.storage.message}
      action={strings.settings.title}
      onAction={() => openSheet('settings')}
      onDismiss={() => (app.storageLow = false)}
    />
  {:else if app.backupReminder}
    <ActionBanner
      tone="info"
      title={strings.backupReminder.title}
      message={strings.backupReminder.message}
      action={strings.backupReminder.action}
      onAction={() => {
        app.backupReminder = false;
        openSheet('settings');
      }}
      onDismiss={() => (app.backupReminder = false)}
    />
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
  <!-- Here, not on a page, because the banners open it from anywhere -->
  <SettingsSheet open={route.sheet === 'settings'} />
{/if}

<Toasts />
