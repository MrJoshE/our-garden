<script>
  import { deletePlant, getGarden, getPlant, listIssues, restorePlant } from '../lib/db/index.js';
  import { PLANT_STATUSES, tintFor } from '../lib/constants.js';
  import { formatDate } from '../lib/dates.js';
  import { explainError } from '../lib/errors.js';
  import { reportError, showToast } from '../lib/state/app.svelte.js';
  import { live } from '../lib/state/live.svelte.js';
  import { back, openSheet, paths, route } from '../lib/state/router.svelte.js';
  import { strings } from '../lib/strings.js';
  import AppBar from '../components/AppBar.svelte';
  import CheckButton from '../components/CheckButton.svelte';
  import EntryForm from '../components/EntryForm.svelte';
  import Icon from '../components/Icon.svelte';
  import Menu from '../components/Menu.svelte';
  import NotFound from '../components/NotFound.svelte';
  import Photo from '../components/Photo.svelte';
  import PlantSheet from '../components/PlantSheet.svelte';
  import ProblemScreen from '../components/ProblemScreen.svelte';
  import Timeline from '../components/Timeline.svelte';

  const garden = live(() => route.gardenId ?? '', getGarden);
  const plant = live(() => route.plantId ?? '', getPlant);
  const issues = live(() => route.plantId ?? '', listIssues);

  // A plant reached through another garden's address is not found here
  const found = $derived(plant.value && garden.value && plant.value.gardenId === garden.value.id);
  let asideHeight = $state(0);

  // A photo whose image data was purged after deletion shows the sprig
  const coverImage = $derived(plant.value?.cover?.blob ?? plant.value?.cover?.thumb ?? null);

  /** @param {MouseEvent} event */
  function goBack(event) {
    // Leave modified clicks to the browser, such as opening a new tab
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    back(paths.garden(/** @type {string} */ (route.gardenId)));
  }

  async function remove() {
    if (!plant.value) return;
    const { id, gardenId } = plant.value;
    // Leave first, so this page never shows the plant as not found
    await back(paths.garden(gardenId));
    try {
      const deletedAt = await deletePlant(id);
      showToast(strings.toasts.plantDeleted, {
        action: {
          label: strings.actions.undo,
          run: () => restorePlant(id, deletedAt).catch((error) => reportError(error, { operation: 'restorePlant', plantId: id }))
        }
      });
    } catch (error) {
      reportError(error, { operation: 'deletePlant', plantId: id });
    }
  }
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
  {@const details = plant.value}
  <AppBar>
    <a
      class="appbar-back"
      href={paths.garden(garden.value.id)}
      aria-label={strings.plant.back(garden.value.name)}
      onclick={goBack}
    >
      <Icon name="chevronLeft" />
      <span class="eyebrow">{garden.value.name}</span>
    </a>
    <span class="appbar-title" aria-hidden="true">{details.commonName}</span>
    {#snippet actions()}
      <button class="btn btn-quiet" type="button" onclick={() => openSheet('edit-plant')}>{strings.actions.edit}</button>
      <Menu label={strings.plant.menu} buttonClass="btn btn-icon btn-quiet" end>
        {#snippet button()}<Icon name="more" />{/snippet}
        <button class="menu-item is-danger" type="button" onclick={remove}>{strings.plant.delete}</button>
      </Menu>
    {/snippet}
  </AppBar>

  <main class="page">
    <div class="split">
      <div class="split-aside stack" bind:clientHeight={asideHeight} style:--aside-height="{asideHeight}px">
        <div class="hero-cover" data-cover={details.id}>
          {#if coverImage}
            <Photo blob={coverImage} />
          {:else}
            <div class="cover-empty" data-tint={tintFor(details.id)}><Icon name="sprig" /></div>
          {/if}
        </div>

        <div class="stack stack-sm">
          <h1 tabindex="-1">{details.commonName}</h1>
          {#if details.botanicalName || details.variety}
            <!-- A variety is written upright in quotes after the italic botanical name -->
            <p class="botanical">
              {details.botanicalName ?? ''}{#if details.variety}{details.botanicalName ? ' ' : ''}<span class="variety">‘{details.variety}’</span>{/if}
            </p>
          {/if}
        </div>

        <dl class="facts-strip">
          {#if details.location}
            <div><dt>{strings.plant.location}</dt><dd>{details.location}</dd></div>
          {/if}
          <div><dt>{strings.plant.status}</dt><dd>{PLANT_STATUSES.label(details.status)}</dd></div>
          {#if details.plantedOn}
            <div><dt>{strings.plant.plantedOn}</dt><dd>{formatDate(details.plantedOn)}</dd></div>
          {/if}
        </dl>

        {#if details.careNotes}
          <section class="stack stack-sm">
            <h2 class="eyebrow">{strings.plant.careNotes}</h2>
            <p class="prose">{details.careNotes}</p>
          </section>
        {/if}

        {#if details.tags.length}
          <ul class="cluster" aria-label={strings.plant.tags}>
            {#each details.tags as tag}<li class="tag">{tag}</li>{/each}
          </ul>
        {/if}
      </div>

      <div class="stack stack-lg">
        <CheckButton plant={details} />
        {#key details.id}
          <EntryForm plantId={details.id} issues={issues.value ?? []} />
          <Timeline plantId={details.id} issues={issues.value ?? []} />
        {/key}
      </div>
    </div>
  </main>

  <PlantSheet open={route.sheet === 'edit-plant'} gardenId={garden.value.id} plantId={details.id} />
{/if}

<style>
  .variety {
    font-style: normal;
  }
</style>
