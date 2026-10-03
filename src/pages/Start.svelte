<script>
  import { onMount } from 'svelte';
  import { findStartGardenId } from '../lib/db/index.js';
  import { navigate, paths } from '../lib/state/router.svelte.js';
  import { reportError } from '../lib/state/app.svelte.js';
  import { strings } from '../lib/strings.js';
  import Icon from '../components/Icon.svelte';
  import WelcomeSheet from '../components/WelcomeSheet.svelte';

  let firstRun = $state(false);

  onMount(async () => {
    try {
      const gardenId = await findStartGardenId();
      if (gardenId) navigate(paths.garden(gardenId), { replace: true });
      else firstRun = true;
    } catch (error) {
      reportError(error, { operation: 'findStartGardenId' });
    }
  });
</script>

{#if firstRun}
  <main class="page">
    <!-- Seen above the bottom sheet on phones; behind a centred dialog it only gets in the way -->
    <div class="empty only-phone">
      <Icon name="sprig" />
      <h1 tabindex="-1">{strings.appName}</h1>
    </div>
  </main>
  <WelcomeSheet />
{/if}
