<script>
  import { getGarden, getPlant } from '../lib/db/index.js';
  import { explainError } from '../lib/errors.js';
  import { live } from '../lib/state/live.svelte.js';
  import { openSheet, paths, route } from '../lib/state/router.svelte.js';
  import { strings } from '../lib/strings.js';
  import NotFound from '../components/NotFound.svelte';
  import PlantSheet from '../components/PlantSheet.svelte';
  import ProblemScreen from '../components/ProblemScreen.svelte';

  const garden = live(() => route.gardenId ?? '', getGarden);
  const plant = live(() => route.plantId ?? '', getPlant);

  // A plant reached through another garden's address is not found here
  const found = $derived(plant.value && garden.value && plant.value.gardenId === garden.value.id);
</script>

{#if garden.error || plant.error}
  <ProblemScreen
    problem={explainError(garden.error ?? plant.error)}
    onRetry={() => {
      garden.retry();
      plant.retry();
    }}
  />
{:else if !garden.loading && !plant.loading && !found}
  <NotFound
    href={garden.value ? paths.garden(garden.value.id) : paths.start}
    label={garden.value ? strings.navigation.toGarden : strings.navigation.toGardens}
  />
{:else if found && garden.value && plant.value}
  <!-- The plant page arrives in step 3. -->
  <main class="page">
    <a href={paths.garden(garden.value.id)}>{garden.value.name}</a>
    <h1 tabindex="-1">{plant.value.commonName}</h1>
    <button class="btn" type="button" onclick={() => openSheet('edit-plant')}>{strings.actions.edit}</button>
  </main>
  <PlantSheet open={route.sheet === 'edit-plant'} gardenId={garden.value.id} plantId={plant.value.id} />
{/if}
