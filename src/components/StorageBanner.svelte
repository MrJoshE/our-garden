<script>
  import Icon from './Icon.svelte';
  import { app } from '../lib/state/app.svelte.js';
  import { openSheet } from '../lib/state/router.svelte.js';
  import { strings } from '../lib/strings.js';
</script>

<!-- Shown again after the next photos are saved, if the device is still nearly full -->
<div class="banner-area">
  <div class="banner" data-tone="attention" role="status">
    <div class="grow">
      <strong>{strings.storage.title}</strong>
      {strings.storage.message}
      <div class="mt-2">
        <button class="btn btn-sm" type="button" onclick={() => openSheet('settings')}>{strings.settings.title}</button>
      </div>
    </div>
    <button class="btn btn-icon btn-quiet" type="button" aria-label={strings.actions.dismiss} onclick={() => (app.storageLow = false)}>
      <Icon name="close" />
    </button>
  </div>
</div>
