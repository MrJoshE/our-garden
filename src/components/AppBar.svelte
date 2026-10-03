<script>
  /** @type {{ children: import('svelte').Snippet, actions?: import('svelte').Snippet }} */
  let { children, actions } = $props();

  let scrollY = $state(0);
</script>

<svelte:window bind:scrollY />

<header class="appbar" class:is-scrolled={scrollY > 0}>
  {@render children()}
  {#if actions}<div class="appbar-actions">{@render actions()}</div>{/if}
</header>
