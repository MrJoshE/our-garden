<script>
  /**
   * A native popover menu, opened by its button: tapping outside, Escape and
   * the Android back button close it, as does choosing an item.
   * @type {{
   *   label: string,
   *   buttonClass: string,
   *   button: import('svelte').Snippet,
   *   children: import('svelte').Snippet,
   *   end?: boolean
   * }} end: line the menu up with the button's right edge, for a button at the end of the bar
   */
  let { label, buttonClass, button: buttonContent, children, end = false } = $props();

  const id = $props.id();
  /** @type {HTMLElement} */
  let menu;
  /** @type {HTMLButtonElement} */
  let button;

  /** @param {ToggleEvent} event */
  function place(event) {
    if (event.newState !== 'open') return;
    const rect = button.getBoundingClientRect();
    menu.style.top = `${rect.bottom}px`;
    if (end) menu.style.right = `${document.documentElement.clientWidth - rect.right}px`;
    else menu.style.left = `${rect.left}px`;
  }

  /** @param {MouseEvent} event */
  function close(event) {
    if (/** @type {Element} */ (event.target).closest('.menu-item')) menu.hidePopover();
  }
</script>

<button bind:this={button} class={buttonClass} type="button" popovertarget={id} aria-label={label}>
  {@render buttonContent()}
</button>

<!-- Clicks come from the menu's own links and buttons, which handle keys themselves -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div bind:this={menu} {id} class="menu" class:is-end={end} popover="auto" onbeforetoggle={place} onclick={close}>
  {@render children()}
</div>
