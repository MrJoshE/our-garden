<script>
  import Field from './Field.svelte';
  import { app } from '../lib/state/app.svelte.js';

  /**
   * A date she chooses, showing today until another day is picked and never
   * allowing a later one. An empty value means today, so a form left open
   * past midnight still saves the day it is saved on.
   * @type {{ label: string, value: string, error?: string } & Record<string, any>}
   */
  let { value = $bindable(), ...rest } = $props();
</script>

<Field
  type="date"
  max={app.today}
  bind:value={() => value || app.today, (date) => (value = date === app.today ? '' : date)}
  {...rest}
/>
