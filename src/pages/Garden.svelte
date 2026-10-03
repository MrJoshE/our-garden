<script>
  import { getGarden, listPlants, setLastGarden } from '../lib/db/index.js';
  import { explainError } from '../lib/errors.js';
  import { live } from '../lib/state/live.svelte.js';
  import { paths, route } from '../lib/state/router.svelte.js';
  import { strings } from '../lib/strings.js';
  import NotFound from '../components/NotFound.svelte';
  import ProblemScreen from '../components/ProblemScreen.svelte';

  const garden = live(() => route.gardenId ?? '', getGarden);
  const plants = live(() => route.gardenId ?? '', listPlants);

  const gardenId = $derived(garden.value?.id);
  $effect(() => {
    if (gardenId) setLastGarden(gardenId);
  });
</script>

{#if garden.error || plants.error}
  <ProblemScreen
    problem={explainError(garden.error ?? plants.error)}
    onRetry={() => {
      garden.retry();
      plants.retry();
    }}
  />
{:else if !garden.loading && !garden.value}
  <NotFound href={paths.start} label={strings.navigation.toGardens} />
{:else if garden.value}
  <main class="page">
    <h1 tabindex="-1">{garden.value.name}</h1>
    <!-- The plant grid arrives in step 2.4. -->
    <ul class="stack stack-sm mt-4">
      {#each plants.value ?? [] as plant (plant.id)}
        <li><a href={paths.plant(garden.value.id, plant.id)}>{plant.commonName}</a></li>
      {/each}
    </ul>
  </main>
{/if}
