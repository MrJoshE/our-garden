<script>
  import { SvelteSet } from 'svelte/reactivity';
  import { app, dismissToast } from '../lib/state/app.svelte.js';

  const UNDO_MS = 6000;
  const PLAIN_MS = 4000;

  const leaving = new SvelteSet();

  /**
   * Starts a toast's timer. Svelte clears it if the toast is removed first,
   * such as when a new undo toast replaces this one.
   * @param {import('../lib/state/app.svelte.js').Toast} toast
   */
  function expire(toast) {
    return () => {
      const timer = setTimeout(() => leaving.add(toast.id), toast.action ? UNDO_MS : PLAIN_MS);
      return () => clearTimeout(timer);
    };
  }

  /** @param {import('../lib/state/app.svelte.js').Toast} toast */
  function act(toast) {
    toast.action?.run();
    dismissToast(toast.id);
  }

  /**
   * @param {AnimationEvent} event
   * @param {number} id
   */
  function removeAfterLeaving(event, id) {
    if (event.animationName !== 'toast-out') return;
    leaving.delete(id);
    dismissToast(id);
  }
</script>

<div class="toast-region" aria-live="polite">
  {#each app.toasts as toast (toast.id)}
    <div
      class="toast"
      class:is-leaving={leaving.has(toast.id)}
      data-tone={toast.tone}
      {@attach expire(toast)}
      onanimationend={(event) => removeAfterLeaving(event, toast.id)}
    >
      <span>{toast.message}</span>
      {#if toast.action}
        <button class="btn" type="button" onclick={() => act(toast)}>{toast.action.label}</button>
      {/if}
    </div>
  {/each}
</div>
