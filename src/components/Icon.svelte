<script>
  // Small inline icons: 1.75 stroke in the current text colour. Add a path
  // here when a component needs a new icon.
  const paths = {
    camera: ['M4 8.5h3l1.8-2.5h6.4L17 8.5h3V19H4z', 'M12 16.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5z'],
    check: ['m5 12.5 4.5 4.5L19 7'],
    chevronDown: ['m6 9 6 6 6-6'],
    chevronLeft: ['m15 18-6-6 6-6'],
    chevronRight: ['m9 18 6-6-6-6'],
    close: ['M18 6 6 18', 'M6 6l12 12'],
    more: [
      'M6.25 12a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0z',
      'M13.25 12a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0z',
      'M20.25 12a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0z'
    ],
    plus: ['M12 5v14', 'M5 12h14'],
    search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'm20 20-4-4'],
    // The one drawing for plants without a photo, and the empty states
    sprig: [
      'M12 21.5c0-5.5-.2-11 0-16',
      'M12 18c-2.2.1-4.6-.9-5.4-3.4 2.7-.4 4.7.8 5.4 3.4z',
      'M12 15c2.2.1 4.6-.9 5.4-3.4-2.7-.4-4.7.8-5.4 3.4z',
      'M12 12c-1.9.1-4-.8-4.7-2.9 2.3-.4 4.1.7 4.7 2.9z',
      'M12 9.3c1.7 0 3.5-.8 4.1-2.6-2-.3-3.6.6-4.1 2.6z',
      'M12 5.5c-.9-1.1-1-2.6-.1-3.6.9 1 .9 2.5.1 3.6z'
    ]
  };

  /** @type {{ name: keyof typeof paths } & Record<string, any>} */
  let { name, ...rest } = $props();
</script>

<!-- Strokes don't scale with the icon, so stroke-width is in screen pixels
     at any size: 1.75 here, and the theme's thin line on large covers. -->
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
  {#each paths[name] as d (d)}<path {d} vector-effect="non-scaling-stroke" />{/each}
</svg>
