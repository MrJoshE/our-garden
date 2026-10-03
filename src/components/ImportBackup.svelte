<script>
  import { untrack } from 'svelte';
  import InlineProblem from './InlineProblem.svelte';
  import PhotoProgress from './PhotoProgress.svelte';
  import { importJournal } from '../lib/db/index.js';
  import { explainError } from '../lib/errors.js';
  import { logError } from '../lib/log.js';
  import { strings } from '../lib/strings.js';

  /**
   * Picks a backup file and merges it into the journal.
   * @type {{
   *   title: string,
   *   hint: string,
   *   label: string,
   *   open?: boolean,
   *   busy?: boolean,
   *   onImported?: () => void
   * }}
   */
  let { title, hint, label, open = true, busy = $bindable(false), onImported } = $props();

  /** @type {HTMLInputElement} */
  let input;
  /** @type {{ done: number, total: number } | null} */
  let progress = $state(null);
  let summary = $state('');
  /** @type {import('../lib/errors.js').Explanation | null} */
  let problem = $state(null);

  // What the last import did is news only until she leaves
  $effect(() => {
    if (open && !untrack(() => progress)) {
      summary = '';
      problem = null;
    }
  });

  async function pick() {
    const file = input.files?.[0];
    input.value = '';
    if (!file || progress) return;
    problem = null;
    summary = '';
    progress = { done: 0, total: 0 };
    busy = true;
    try {
      summary = strings.backup.imported(await importJournal(file, (done, total) => (progress = { done, total })));
      onImported?.();
    } catch (error) {
      logError(error, { operation: 'importJournal' });
      problem = explainError(error);
    } finally {
      progress = null;
      busy = false;
    }
  }
</script>

<div class="grow stack stack-sm">
  <div>
    <p role="status">{progress ? strings.backup.importing : summary || title}</p>
    <p class="hint">{hint}</p>
  </div>
  {#if progress}<PhotoProgress label={strings.backup.importing} {...progress} />{/if}
  <!-- Without a retry button: choosing the file again is the way to retry -->
  {#if problem}<InlineProblem {problem} />{/if}
  <div>
    <button class="btn" type="button" aria-busy={progress ? 'true' : undefined} onclick={() => input.click()}>
      {label}
    </button>
    <input
      bind:this={input}
      class="sr-only"
      type="file"
      accept=".zip,application/zip"
      tabindex="-1"
      aria-hidden="true"
      onchange={pick}
    />
  </div>
</div>
