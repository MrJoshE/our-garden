<script>
  import { untrack } from 'svelte';
  import ImportBackup from './ImportBackup.svelte';
  import InlineProblem from './InlineProblem.svelte';
  import PhotoProgress from './PhotoProgress.svelte';
  import { exportJournal, setMeta } from '../lib/db/index.js';
  import { daysSince, formatDate, localDate, today } from '../lib/dates.js';
  import { explainError } from '../lib/errors.js';
  import { logError } from '../lib/log.js';
  import { app } from '../lib/state/app.svelte.js';
  import { strings } from '../lib/strings.js';

  /** @type {{ open: boolean, lastBackupAt: string | null }} */
  let { open, lastBackupAt = $bindable() } = $props();

  // Long enough for any browser to have started the download
  const KEEP_DOWNLOAD_URL_MS = 60_000;

  /** @type {{ done: number, total: number } | null} */
  let progress = $state(null);
  /** @type {File | null} a finished backup that still needs handing over */
  let ready = $state(null);
  let unreadable = $state(0);
  /** @type {import('../lib/errors.js').Explanation | null} */
  let problem = $state(null);
  let handingOver = false;

  // A backup left unsaved goes stale as she writes more, so each visit starts afresh
  $effect(() => {
    if (open && !untrack(() => progress)) {
      ready = null;
      unreadable = 0;
      problem = null;
    }
  });

  const status = $derived.by(() => {
    if (progress) return strings.backup.preparing;
    if (ready) return strings.backup.ready;
    if (!lastBackupAt) return strings.backup.never;
    const day = localDate(new Date(lastBackupAt));
    return strings.backup.last(daysSince(day, app.today), formatDate(day));
  });

  async function start() {
    if (progress) return;
    problem = null;
    ready = null;
    unreadable = 0;
    progress = { done: 0, total: 0 };
    try {
      const backup = await exportJournal((done, total) => (progress = { done, total }));
      ready = new File([backup.zip], `garden-journal-${today()}.zip`, { type: backup.zip.type });
      unreadable = backup.unreadable;
    } catch (error) {
      logError(error, { operation: 'exportJournal' });
      problem = explainError(error);
    } finally {
      progress = null;
    }
    if (ready) await save(false);
  }

  /** @param {boolean} tapped whether a tap on Save backup started this */
  async function save(tapped) {
    if (!ready || handingOver) return;
    handingOver = true;
    problem = null;
    try {
      await handOver(ready, tapped);
      const at = new Date().toISOString();
      await setMeta('lastBackupAt', at);
      lastBackupAt = at;
      ready = null;
      app.backupReminder = false;
    } catch (error) {
      // She closed the share sheet, or the export outlasted the tap that the
      // share sheet needs: Save backup stays for her to tap
      if (isDomError(error, 'AbortError') || isDomError(error, 'NotAllowedError')) return;
      logError(error, { operation: 'saveBackup', tables: ['meta'] });
      problem = explainError(error);
    } finally {
      handingOver = false;
    }
  }

  /**
   * The share sheet where the browser can share the file (the reliable route
   * in an installed iOS app), or else a download.
   * @param {File} file
   * @param {boolean} tapped
   */
  async function handOver(file, tapped) {
    if (navigator.canShare?.({ files: [file] })) {
      try {
        return await navigator.share({ files: [file] });
      } catch (error) {
        // Some browsers refuse to share even straight after a tap
        if (!tapped || !isDomError(error, 'NotAllowedError')) throw error;
      }
    }
    const url = URL.createObjectURL(file);
    Object.assign(document.createElement('a'), { href: url, download: file.name }).click();
    setTimeout(() => URL.revokeObjectURL(url), KEEP_DOWNLOAD_URL_MS);
  }

  /**
   * @param {unknown} error
   * @param {string} name
   */
  const isDomError = (error, name) => error instanceof DOMException && error.name === name;
</script>

<ul class="list">
  <li class="list-row">
    <div class="grow stack stack-sm">
      <div>
        <div role="status">
          <p>{status}</p>
          {#if unreadable}<p class="hint">{strings.backup.unreadable(unreadable)}</p>{/if}
        </div>
        <p class="hint">{strings.backup.hint}</p>
      </div>
      {#if progress}<PhotoProgress label={strings.backup.preparing} {...progress} />{/if}
      {#if problem}<InlineProblem {problem} onRetry={ready ? () => save(true) : start} />{/if}
      <div>
        {#if ready}
          <button class="btn btn-primary" type="button" onclick={() => save(true)}>{strings.backup.save}</button>
        {:else}
          <button class="btn" type="button" aria-busy={progress ? 'true' : undefined} onclick={start}>
            {strings.backup.export}
          </button>
        {/if}
      </div>
    </div>
  </li>
  <li class="list-row">
    <ImportBackup
      {open}
      title={strings.backup.importTitle}
      hint={strings.backup.importHint}
      label={strings.backup.import}
    />
  </li>
</ul>
