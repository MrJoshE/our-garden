<script>
  import Icon from './Icon.svelte';
  import { openSheet } from '../lib/state/router.svelte.js';
  import { strings } from '../lib/strings.js';

  /**
   * A banner whose button opens Backup and settings.
   * @type {{
   *   tone: string,
   *   title: string,
   *   message: string,
   *   action: string,
   *   onDismiss: () => void,
   *   closeOnAction?: boolean
   * }}
   */
  let { tone, title, message, action, onDismiss, closeOnAction = false } = $props();

  function act() {
    if (closeOnAction) onDismiss();
    openSheet('settings');
  }
</script>

<div class="banner-area">
  <div class="banner" data-tone={tone} role="status">
    <div class="grow">
      <strong>{title}</strong>
      {message}
      <div class="mt-2">
        <button class="btn btn-sm" type="button" onclick={act}>{action}</button>
      </div>
    </div>
    <button class="btn btn-icon btn-quiet" type="button" aria-label={strings.actions.dismiss} onclick={onDismiss}>
      <Icon name="close" />
    </button>
  </div>
</div>
