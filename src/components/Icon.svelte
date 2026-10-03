<script>
  // Small inline icons: 1.75 stroke in the current text colour. Add a path
  // here when a component needs a new icon.
  const paths = {
    close: ['M18 6 6 18', 'M6 6l12 12']
  };

  /** @type {{ name: keyof typeof paths } & Record<string, any>} */
  let { name, ...rest } = $props();
</script>

<svg
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.75"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  {...rest}
>
  {#each paths[name] as d (d)}<path {d} />{/each}
</svg>
