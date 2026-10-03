<script>
  import Icon from './Icon.svelte';
  import { strings } from '../lib/strings.js';

  /**
   * A banner with one action button and a dismiss button.
   * @type {{
   *   tone: string,
   *   title: string,
   *   message: string,
   *   action: string,
   *   onAction: () => void,
   *   onDismiss: () => void
   * }}
   */
  let { tone, title, message, action, onAction, onDismiss } = $props();
</script>

<div class="banner-area">
  <div class="banner" data-tone={tone} role="status">
    <div class="grow">
      <strong>{title}</strong>
      {message}
      <div class="mt-2">
        <button class="btn btn-sm" type="button" onclick={onAction}>{action}</button>
      </div>
    </div>
    <button class="btn btn-icon btn-quiet" type="button" aria-label={strings.actions.dismiss} onclick={onDismiss}>
      <Icon name="close" />
    </button>
  </div>
</div>
