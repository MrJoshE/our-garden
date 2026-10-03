<script module>
  // Gardens whose cards have already risen in this session
  const staggered = new Set();
</script>

<script>
  import { getGarden, listPlants, setLastGarden } from '../lib/db/index.js';
  import { explainError } from '../lib/errors.js';
  import { plantMatches } from '../lib/search.js';
  import { live } from '../lib/state/live.svelte.js';
  import { openSheet, paths, route, setView } from '../lib/state/router.svelte.js';
  import { strings } from '../lib/strings.js';
  import AppBar from '../components/AppBar.svelte';
  import GardenMenu from '../components/GardenMenu.svelte';
  import GardenSheet from '../components/GardenSheet.svelte';
  import Icon from '../components/Icon.svelte';
  import NotFound from '../components/NotFound.svelte';
  import PlantCard from '../components/PlantCard.svelte';
  import PlantSheet from '../components/PlantSheet.svelte';
  import ProblemScreen from '../components/ProblemScreen.svelte';

  // The brief shows the search box only for more than eight plants
  const SEARCH_ABOVE = 8;

  const garden = live(() => route.gardenId ?? '', getGarden);
  const plants = live(() => route.gardenId ?? '', listPlants);

  const gardenId = $derived(garden.value?.id);
  $effect(() => {
    if (gardenId) setLastGarden(gardenId);
  });

  const all = $derived(plants.value ?? []);
  const attentionCount = $derived(all.filter((plant) => plant.needsAttention).length);
  const searchable = $derived(all.length > SEARCH_ABOVE);
  const searching = $derived(searchable && route.search.trim() !== '');
  const shown = $derived(
    all.filter(
      (plant) => (route.filter === 'all' || plant.needsAttention) && (!searching || plantMatches(plant, route.search))
    )
  );

  // Cards rise in one after another the first time a garden opens, not on
  // every return to it or change of filter
  let stagger = $state(false);
  $effect(() => {
    if (gardenId && plants.value && !staggered.has(gardenId)) {
      staggered.add(gardenId);
      stagger = true;
    }
  });

  // Counted, not looked up: most cards share the last delay, so hundreds of
  // these events can arrive in the same frame.
  let risen = 0;

  /** @param {AnimationEvent} event */
  function finishStagger(event) {
    const card = /** @type {Element} */ (event.target);
    if (event.animationName !== 'rise-in' || card.parentElement !== event.currentTarget) return;
    risen++;
    if (risen >= shown.length) {
      stagger = false;
      risen = 0;
    }
  }
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
  <AppBar>
    <GardenMenu garden={garden.value} />
  </AppBar>

  <main class="page">
    <div class="page-header">
      <div class="stack stack-sm">
        <h1 tabindex="-1">{garden.value.name}</h1>
        {#if all.length}
          <p class="muted">
            {strings.garden.plants(all.length)}{#if attentionCount},
              <span class="text-attention">{strings.garden.needAttention(attentionCount)}</span>{/if}
          </p>
        {/if}
      </div>
      <!-- An empty garden has its own Add plant button, in the empty state -->
      {#if all.length}
        <button class="btn btn-primary only-wide" type="button" onclick={() => openSheet('add-plant')}>
          <Icon name="plus" />
          {strings.plantSheet.add}
        </button>
      {/if}
    </div>

    {#if searchable}
      <div class="search" role="search">
        <Icon name="search" />
        <input
          class="input"
          type="search"
          aria-label={strings.garden.search}
          placeholder={strings.garden.search}
          autocomplete="off"
          enterkeyhint="search"
          value={route.search}
          oninput={(event) => setView({ search: event.currentTarget.value })}
        />
      </div>
    {/if}

    {#if all.length}
      <div class="segmented mt-4" role="group" aria-label={strings.garden.filter}>
        <button type="button" aria-pressed={route.filter === 'all'} onclick={() => setView({ filter: 'all' })}>
          {strings.garden.all}
        </button>
        <button type="button" aria-pressed={route.filter === 'attention'} onclick={() => setView({ filter: 'attention' })}>
          {strings.garden.attention}
          {#if attentionCount}<span class="chip-count">{attentionCount}</span>{/if}
        </button>
      </div>
    {/if}

    {#if plants.loading}
      {#if plants.slow}
        <div class="plant-grid mt-4" aria-hidden="true">
          {#each { length: 6 }, i (i)}<div class="skeleton skeleton-card"></div>{/each}
        </div>
      {/if}
    {:else if all.length === 0}
      <div class="empty">
        <Icon name="sprig" />
        <h2>{strings.garden.noPlants.title}</h2>
        <p>{strings.garden.noPlants.message}</p>
        <button class="btn btn-primary" type="button" onclick={() => openSheet('add-plant')}>
          <Icon name="plus" />
          {strings.plantSheet.add}
        </button>
      </div>
    {:else if shown.length === 0 && searching}
      <div class="empty">
        <Icon name="search" />
        <h2>{strings.garden.noResults.title(route.search.trim())}</h2>
        <p>{strings.garden.noResults.message}</p>
        <button class="btn" type="button" onclick={() => setView({ search: '' })}>{strings.garden.noResults.action}</button>
      </div>
    {:else if shown.length === 0}
      <div class="empty">
        <Icon name="sprig" />
        <h2>{strings.garden.noneNeedAttention.title}</h2>
        <p>{strings.garden.noneNeedAttention.message}</p>
        <button class="btn" type="button" onclick={() => setView({ filter: 'all' })}>
          {strings.garden.noneNeedAttention.action}
        </button>
      </div>
    {:else}
      <div class="plant-grid mt-4" class:stagger onanimationend={finishStagger}>
        {#each shown as plant, index (plant.id)}
          <PlantCard {plant} {index} />
        {/each}
      </div>
    {/if}
  </main>

  {#if all.length}
    <button class="btn btn-primary fab" type="button" onclick={() => openSheet('add-plant')}>
      <Icon name="plus" />
      {strings.plantSheet.add}
    </button>
  {/if}

  <PlantSheet open={route.sheet === 'add-plant'} gardenId={garden.value.id} />
  <GardenSheet open={route.sheet === 'add-garden'} />
  <GardenSheet open={route.sheet === 'edit-garden'} garden={garden.value} />
{/if}
