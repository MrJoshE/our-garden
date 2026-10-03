<script>
  import Icon from './Icon.svelte';
  import Menu from './Menu.svelte';
  import { listGardens } from '../lib/db/index.js';
  import { live } from '../lib/state/live.svelte.js';
  import { reportError, showToast } from '../lib/state/app.svelte.js';
  import { navigate, openSheet, paths } from '../lib/state/router.svelte.js';
  import { strings } from '../lib/strings.js';

  /** @type {{ garden: Record<string, any> }} the garden being looked at */
  let { garden } = $props();

  const gardens = live(() => null, listGardens);

  let loadingSample = false;

  // Development only. Loaded on demand, so the sample stays out of the build.
  async function loadSample() {
    if (loadingSample) return;
    loadingSample = true;
    try {
      const { loadSampleGarden } = await import('../lib/db/seed.js');
      const id = await loadSampleGarden();
      showToast(strings.toasts.gardenAdded);
      navigate(paths.garden(id));
    } catch (error) {
      reportError(error, { operation: 'loadSampleGarden' });
    } finally {
      loadingSample = false;
    }
  }
</script>

<Menu label={strings.gardenMenu.open(garden.name)} buttonClass="appbar-switcher">
  {#snippet button()}
    <span class="eyebrow">{garden.name}</span>
    <Icon name="chevronDown" />
  {/snippet}

  <p class="eyebrow menu-heading">{strings.gardenMenu.gardens}</p>
  {#each gardens.value ?? [] as other (other.id)}
    <a class="menu-item" href={paths.garden(other.id)} aria-current={other.id === garden.id ? 'page' : undefined}>
      <span class="grow">
        {other.name}
        {#if other.status === 'archived'}<span class="muted">· {strings.gardenMenu.archived}</span>{/if}
      </span>
      {#if other.id === garden.id}<Icon name="check" />{/if}
    </a>
  {/each}
  <div class="menu-divider"></div>
  <button class="menu-item" type="button" onclick={() => openSheet('add-garden')}>{strings.gardenMenu.add}</button>
  <button class="menu-item" type="button" onclick={() => openSheet('edit-garden')}>{strings.gardenMenu.edit}</button>
  {#if import.meta.env.DEV}
    <button class="menu-item" type="button" onclick={loadSample}>Load sample garden</button>
  {/if}
</Menu>
