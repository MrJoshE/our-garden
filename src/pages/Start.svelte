<script>
  import { onMount } from 'svelte';
  import { findStartGardenId } from '../lib/db/index.js';
  import { navigate, paths } from '../lib/state/router.svelte.js';
  import { reportError } from '../lib/state/app.svelte.js';
  import { strings } from '../lib/strings.js';

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
  <!-- The welcome sheet arrives in step 2.3. -->
  <main class="page">
    <h1 tabindex="-1">{strings.appName}</h1>
  </main>
{/if}
