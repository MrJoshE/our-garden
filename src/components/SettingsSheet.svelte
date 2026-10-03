<script>
  import { untrack } from 'svelte';
  import Backup from './Backup.svelte';
  import Field from './Field.svelte';
  import Icon from './Icon.svelte';
  import InlineProblem from './InlineProblem.svelte';
  import Sheet from './Sheet.svelte';
  import { getCurrentPerson, getMeta, updatePerson } from '../lib/db/index.js';
  import { LIMITS } from '../lib/constants.js';
  import { formatMoment } from '../lib/dates.js';
  import { explainError } from '../lib/errors.js';
  import { focusFirstProblem, saveFailure } from '../lib/forms.js';
  import { getErrorLog, logError } from '../lib/log.js';
  import { STORAGE_WARNING_SHARE, storageEstimate } from '../lib/state/app.svelte.js';
  import { strings } from '../lib/strings.js';

  /** @type {{ open: boolean }} */
  let { open } = $props();

  const logId = $props.id();

  /** @type {Record<string, any> | undefined} */
  let person = $state();
  let name = $state('');
  let nameError = $state('');
  /** @type {import('../lib/errors.js').Explanation | null} */
  let problem = $state(null);
  let saving = $state(false);
  let saved = $state(false);
  /** @type {string | null} */
  let lastBackupAt = $state(null);
  /** @type {{ usage: number, quota: number } | null} */
  let storage = $state(null);
  /** @type {import('../lib/log.js').ErrorRecord[]} */
  let log = $state([]);
  let showLog = $state(false);

  const nameChanged = $derived(!!person && name.trim() !== person.name);
  const usedShare = $derived(storage ? Math.min(1, storage.usage / storage.quota) : 0);

  $effect(() => {
    if (open) untrack(load);
  });

  async function load() {
    name = person?.name ?? '';
    nameError = '';
    problem = null;
    saved = false;
    showLog = false;
    try {
      const [current, backedUpAt, estimate, records] = await Promise.all([
        getCurrentPerson(),
        getMeta('lastBackupAt'),
        storageEstimate(),
        getErrorLog()
      ]);
      person = current;
      lastBackupAt = backedUpAt ?? null;
      name = current?.name ?? '';
      storage = estimate;
      log = records.toReversed();
    } catch (error) {
      logError(error, { operation: 'loadSettings', tables: ['people', 'meta'] });
      person = undefined;
      problem = explainError(error);
    }
  }

  /** @param {SubmitEvent} event */
  async function saveName(event) {
    event.preventDefault();
    if (!person || saving || !nameChanged) return;
    const form = /** @type {HTMLFormElement} */ (event.target);
    problem = null;
    nameError = name.trim() ? '' : strings.errors.field.required;
    if (nameError) return focusFirstProblem(form);
    saving = true;
    try {
      await updatePerson(person.id, { name });
      person = { ...person, name: name.trim() };
      saved = true;
    } catch (error) {
      const failure = saveFailure(error, ['name']);
      nameError = failure.message;
      problem = failure.problem;
      focusFirstProblem(form);
    } finally {
      saving = false;
    }
  }
</script>

<Sheet {open} title={strings.settings.title}>
  <div class="stack stack-lg">
    {#if problem}<InlineProblem {problem} onRetry={person ? undefined : load} />{/if}
    {#if person}
      <Backup {open} bind:lastBackupAt />

      <form novalidate onsubmit={saveName}>
        <Field
          label={strings.settings.name}
          name="name"
          autocomplete="given-name"
          maxlength={LIMITS.name}
          bind:value={name}
          error={nameError}
        />
        {#if nameChanged}
          <button class="btn mt-2" type="submit" aria-busy={saving ? 'true' : undefined}>{strings.settings.saveName}</button>
        {/if}
        <!-- A toast would sit behind the sheet, so the sheet says it -->
        <p class={['hint', saved && !nameChanged && 'mt-2']} role="status">
          {saved && !nameChanged ? strings.settings.nameSaved : ''}
        </p>
      </form>

      <ul class="list">
        <li class="list-row">
          <div class="grow stack stack-sm">
            <div class="cluster cluster-between">
              <span>{strings.settings.storage}</span>
              <span class="muted">
                {storage ? strings.settings.storageUsed(storage.usage, storage.quota) : strings.settings.storageUnknown}
              </span>
            </div>
            {#if storage}
              <!-- The text above already says this -->
              <div class="progress" class:is-warning={usedShare > STORAGE_WARNING_SHARE} aria-hidden="true">
                <i style:--value={usedShare * 100}></i>
              </div>
            {/if}
          </div>
        </li>
        <li class="list-row">
          <span class="grow">{strings.settings.version}</span>
          <span class="muted">{__APP_VERSION__}</span>
        </li>
      </ul>

      {#if log.length}
        <section class="stack stack-sm">
          <button
            class="btn btn-quiet"
            type="button"
            aria-expanded={showLog}
            aria-controls={logId}
            onclick={() => (showLog = !showLog)}
          >
            {strings.settings.log(log.length)}
            <Icon name="chevronDown" />
          </button>
          <div class="reveal" class:is-open={showLog} id={logId} inert={!showLog}>
            <div class="stack stack-sm">
              <p class="hint">{strings.settings.logHint}</p>
              <ol class="list">
                {#each log as record (record.id)}
                  <li class="list-row">
                    <div class="grow">
                      <p class="text-sm">
                        <strong>{record.context?.operation ?? record.name}</strong>
                        <span class="muted">· {formatMoment(record.at)}</span>
                      </p>
                      <p class="text-xs muted">{record.name}: {record.message}</p>
                      {#each record.causes as cause}
                        <p class="text-xs muted">{strings.settings.causedBy} {cause.name}: {cause.message}</p>
                      {/each}
                    </div>
                  </li>
                {/each}
              </ol>
            </div>
          </div>
        </section>
      {:else}
        <p class="hint">{strings.settings.logEmpty}</p>
      {/if}
    {/if}
  </div>
</Sheet>
