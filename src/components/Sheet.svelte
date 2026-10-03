<script>
  import { tick } from 'svelte';
  import Icon from './Icon.svelte';
  import { closeSheet } from '../lib/state/router.svelte.js';
  import { strings } from '../lib/strings.js';

  /**
   * @type {{
   *   open: boolean,
   *   title: string,
   *   dismissible?: boolean,
   *   onsubmit?: (event: SubmitEvent) => void,
   *   children: import('svelte').Snippet,
   *   footer?: import('svelte').Snippet
   * }}
   */
  let { open, title, dismissible = true, onsubmit, children, footer } = $props();

  const titleId = $props.id();
  /** @type {HTMLDialogElement} */
  let dialog;
  /** @type {HTMLElement | undefined} */
  let grabber = $state();
  let closing = $state(false);

  // Dragging the grabber down closes the sheet, as on iOS
  let dragStart = $state(/** @type {number | null} */ (null));
  let dragOffset = $state(0);

  $effect(() => {
    if (open && !dialog.open) {
      dragOffset = 0;
      dialog.showModal();
    } else if (!open && dialog.open && !closing) {
      animateClose();
    }
  });

  async function animateClose() {
    closing = true;
    await tick();
    // The dialog's own animations only: a busy button's spinner never finishes
    await Promise.allSettled(dialog.getAnimations().map((animation) => animation.finished));
    dialog.close();
    closing = false;
    if (open) dialog.showModal();
  }

  function requestClose() {
    if (dismissible) closeSheet();
  }

  /** @param {Event} event */
  function oncancel(event) {
    event.preventDefault();
    requestClose();
  }

  // The browser can close a dialog without asking, such as Chrome on Android
  // handling the back button itself. Keep history in step, or reopen a sheet
  // that can't be dismissed.
  function onclose() {
    if (!open) return;
    if (dismissible) closeSheet();
    else dialog.showModal();
  }

  /** @param {MouseEvent} event */
  function onclick(event) {
    if (event.target === dialog) requestClose();
  }

  /** @param {PointerEvent} event */
  function onpointerdown(event) {
    const onPhone = grabber?.offsetParent != null;
    if (!dismissible || !onPhone || /** @type {Element} */ (event.target).closest('button')) return;
    dragStart = event.clientY;
    /** @type {Element} */ (event.currentTarget).setPointerCapture(event.pointerId);
  }

  /** @param {PointerEvent} event */
  function onpointermove(event) {
    if (dragStart !== null) dragOffset = Math.max(0, event.clientY - dragStart);
  }

  function onpointerup() {
    if (dragStart === null) return;
    dragStart = null;
    if (dragOffset > dialog.offsetHeight / 4) requestClose();
    else dragOffset = 0;
  }
</script>

{#snippet content()}
  <div class="sheet-body">{@render children()}</div>
  {#if footer}<div class="sheet-footer">{@render footer()}</div>{/if}
{/snippet}

<dialog
  bind:this={dialog}
  class="sheet"
  class:is-closing={closing}
  class:is-dragging={dragStart !== null}
  style:transform={dragOffset ? `translateY(${dragOffset}px)` : null}
  aria-labelledby={titleId}
  {oncancel}
  {onclose}
  {onclick}
>
  <!-- Dragging is a touch shortcut; Close and Escape are the accessible ways out -->
  <div class="sheet-handle" role="presentation" {onpointerdown} {onpointermove} {onpointerup} onpointercancel={onpointerup}>
    {#if dismissible}<div class="sheet-grabber" bind:this={grabber}></div>{/if}
    <header class="sheet-header">
      <h2 id={titleId}>{title}</h2>
      {#if dismissible}
        <button class="btn btn-icon btn-quiet" type="button" aria-label={strings.actions.close} onclick={requestClose}>
          <Icon name="close" />
        </button>
      {/if}
    </header>
  </div>
  {#if onsubmit}
    <form class="sheet-form" novalidate {onsubmit}>{@render content()}</form>
  {:else}
    {@render content()}
  {/if}
</dialog>

<style>
  dialog {
    transition: transform var(--dur-base) var(--ease-out);
  }
  dialog.is-dragging {
    transition: none;
  }
  .sheet-handle {
    touch-action: none;
  }
</style>
