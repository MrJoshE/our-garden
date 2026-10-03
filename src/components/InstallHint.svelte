<script>
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';
  import { getMeta, setMeta } from '../lib/db/index.js';
  import { logError } from '../lib/log.js';
  import { strings } from '../lib/strings.js';

  // In iOS, Safari and the installed app keep separate storage, so a journal
  // started in the browser is not there once installed (brief section 11).
  let show = $state(false);

  onMount(async () => {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
    const installed = matchMedia('(display-mode: standalone)').matches || /** @type {any} */ (navigator).standalone === true;
    show = ios && !installed && !(await getMeta('installHintDismissed'));
  });

  async function dismiss() {
    show = false;
    try {
      await setMeta('installHintDismissed', true);
    } catch (error) {
      logError(error, { operation: 'dismissInstallHint' });
    }
  }
</script>

{#if show}
  <div class="banner" data-tone="info">
    <div class="grow">
      <strong>{strings.installHint.title}</strong>
      {strings.installHint.steps}
    </div>
    <button class="btn btn-icon btn-quiet" type="button" aria-label={strings.actions.dismiss} onclick={dismiss}>
      <Icon name="close" />
    </button>
  </div>
{/if}
