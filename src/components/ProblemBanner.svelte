<script>
  import Icon from './Icon.svelte';
  import { strings } from '../lib/strings.js';

  /** @type {{ problem: import('../lib/errors.js').Explanation, onDismiss: () => void }} */
  let { problem, onDismiss } = $props();
</script>

<div class="banner-area">
  <div class="banner" data-tone="danger" role="alert">
    <div class="grow">
      <strong>{problem.title}</strong>
      {problem.message}
      <div class="mt-2">
        <button class="btn btn-sm" type="button" onclick={() => location.reload()}>{strings.actions.reload}</button>
      </div>
    </div>
    <button class="btn btn-icon btn-quiet" type="button" aria-label={strings.actions.dismiss} onclick={onDismiss}>
      <Icon name="close" />
    </button>
  </div>
</div>
