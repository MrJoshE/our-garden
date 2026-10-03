<script>
  import Icon from './Icon.svelte';
  import Photo from './Photo.svelte';
  import { INACTIVE_PLANT_STATUSES, PLANT_STATUSES, tintFor } from '../lib/constants.js';
  import { paths } from '../lib/state/router.svelte.js';
  import { strings } from '../lib/strings.js';

  /** @type {{ plant: Record<string, any>, index: number }} */
  let { plant, index } = $props();

  // A photo whose image data was purged after deletion has no thumb
  const thumb = $derived(plant.cover?.thumb ?? null);
  const inactive = $derived(INACTIVE_PLANT_STATUSES.includes(plant.status));
</script>

<a
  class="card card-interactive plant-card"
  class:is-attention={plant.needsAttention && !inactive}
  data-status={plant.status}
  href={paths.plant(plant.gardenId, plant.id)}
  style:--i={index}
>
  <div class="cover" data-cover={plant.id}>
    {#if thumb}
      <Photo blob={thumb} />
    {:else}
      <div class="cover-empty" data-tint={tintFor(plant.id)}><Icon name="sprig" /></div>
    {/if}
    {#if inactive}
      <span class="badge" data-tone="neutral">{PLANT_STATUSES.label(plant.status)}</span>
    {:else if plant.needsAttention}
      <span class="badge badge-dot" data-tone="attention">{strings.garden.attention}</span>
    {/if}
  </div>
  <div class="body">
    <span class="name">{plant.commonName}</span>
    {#if plant.location}<span class="meta">{plant.location}</span>{/if}
  </div>
</a>
