<script>
  import { tick } from 'svelte';
  import Field from './Field.svelte';
  import InstallHint from './InstallHint.svelte';
  import Sheet from './Sheet.svelte';
  import { createFirstGarden } from '../lib/db/index.js';
  import { explainError } from '../lib/errors.js';
  import { LIMITS } from '../lib/constants.js';
  import { navigate, paths } from '../lib/state/router.svelte.js';
  import { strings } from '../lib/strings.js';

  let personName = $state('');
  let gardenName = $state('');
  let errors = $state({ personName: '', gardenName: '' });
  /** @type {import('../lib/errors.js').Explanation | null} */
  let problem = $state(null);
  let saving = $state(false);

  async function focusFirstProblem() {
    await tick();
    /** @type {HTMLElement | null} */ (document.querySelector('dialog[open] [aria-invalid="true"]'))?.focus();
  }

  /** @param {SubmitEvent} event */
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const required = strings.errors.field.required;
    errors = { personName: personName.trim() ? '' : required, gardenName: gardenName.trim() ? '' : required };
    problem = null;
    if (errors.personName || errors.gardenName) return focusFirstProblem();

    saving = true;
    try {
      const gardenId = await createFirstGarden({ personName, gardenName });
      // Asks the browser not to clear the journal when space runs low
      navigator.storage?.persist?.().catch(() => {});
      navigate(paths.garden(gardenId), { replace: true });
    } catch (error) {
      const explanation = explainError(error);
      if (explanation.field === 'personName' || explanation.field === 'gardenName') {
        errors[explanation.field] = explanation.fieldMessage ?? '';
      } else {
        problem = explanation;
      }
      saving = false;
      focusFirstProblem();
    }
  }
</script>

<Sheet open title={strings.welcome.title} dismissible={false} onsubmit={submit}>
  <div class="stack">
    <InstallHint />
    <p class="muted">{strings.welcome.intro}</p>
    {#if problem}
      <div class="banner" data-tone="danger" role="alert">
        <div class="grow">
          <strong>{problem.title}</strong>
          {problem.message}
        </div>
      </div>
    {/if}
    <Field
      label={strings.welcome.personName}
      name="personName"
      autocomplete="given-name"
      autofocus
      maxlength={LIMITS.name}
      bind:value={personName}
      error={errors.personName}
    />
    <Field
      label={strings.welcome.gardenName}
      name="gardenName"
      autocomplete="off"
      maxlength={LIMITS.name}
      bind:value={gardenName}
      error={errors.gardenName}
    />
  </div>

  {#snippet footer()}
    <button class="btn btn-primary btn-lg" type="submit" aria-busy={saving ? 'true' : undefined}>
      {strings.welcome.submit}
    </button>
  {/snippet}
</Sheet>
