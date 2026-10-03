<script>
  import Icon from './Icon.svelte';
  import { listGardens } from '../lib/db/index.js';
  import { live } from '../lib/state/live.svelte.js';
  import { openSheet, paths } from '../lib/state/router.svelte.js';
  import { strings } from '../lib/strings.js';

  /** @type {{ garden: Record<string, any> }} the garden being looked at */
  let { garden } = $props();

  const gardens = live(() => null, listGardens);
  const menuId = $props.id();
  /** @type {HTMLElement} */
  let menu;
  /** @type {HTMLButtonElement} */
  let button;

  // A native popover: tapping outside, Escape and the Android back button
  // close it. It opens just under the button.
  /** @param {ToggleEvent} event */
  function place(event) {
    if (event.newState !== 'open') return;
    const rect = button.getBoundingClientRect();
    menu.style.top = `${rect.bottom}px`;
    menu.style.left = `${rect.left}px`;
  }

  /** @param {string} sheet */
  function open(sheet) {
    menu.hidePopover();
    openSheet(sheet);
  }
</script>

<button
  bind:this={button}
  class="appbar-switcher"
  type="button"
  popovertarget={menuId}
  aria-label={strings.gardenMenu.open(garden.name)}
>
  <span class="eyebrow">{garden.name}</span>
  <Icon name="chevronDown" />
</button>

<div bind:this={menu} id={menuId} class="menu" popover="auto" onbeforetoggle={place}>
  <p class="eyebrow menu-heading">{strings.gardenMenu.gardens}</p>
  {#each gardens.value ?? [] as other (other.id)}
    <a
      class="menu-item"
      href={paths.garden(other.id)}
      aria-current={other.id === garden.id ? 'page' : undefined}
      onclick={() => menu.hidePopover()}
    >
      <span class="grow">
        {other.name}
        {#if other.status === 'archived'}<span class="muted">· {strings.gardenMenu.archived}</span>{/if}
      </span>
      {#if other.id === garden.id}<Icon name="check" />{/if}
    </a>
  {/each}
  <div class="menu-divider"></div>
  <button class="menu-item" type="button" onclick={() => open('add-garden')}>{strings.gardenMenu.add}</button>
  <button class="menu-item" type="button" onclick={() => open('edit-garden')}>{strings.gardenMenu.edit}</button>
</div>
