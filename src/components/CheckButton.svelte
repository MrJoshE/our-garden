<script>
  import Icon from './Icon.svelte';
  import { checkToday } from '../lib/db/index.js';
  import { daysSince, formatDate } from '../lib/dates.js';
  import { app, reportError, showToast } from '../lib/state/app.svelte.js';
  import { strings } from '../lib/strings.js';

  /** @type {{ plant: Record<string, any> }} from getPlant */
  let { plant } = $props();

  const lastId = $props.id();
  let saving = $state(false);
  // Only a check made in this visit pops and draws its tick
  let checkedNow = $state(false);

  const done = $derived(plant.lastOwnCheckOn === app.today);
  const last = $derived(
    plant.lastCheckedOn
      ? strings.check.last(daysSince(plant.lastCheckedOn, app.today), formatDate(plant.lastCheckedOn))
      : strings.check.never
  );

  async function check() {
    if (saving) return;
    saving = true;
    try {
      if (await checkToday(plant.id)) {
        checkedNow = true;
        navigator.vibrate?.(10);
        showToast(strings.check.button);
      } else {
        showToast(strings.check.already);
      }
    } catch (error) {
      reportError(error, { operation: 'checkToday', plantId: plant.id });
    } finally {
      saving = false;
    }
  }
</script>

<div class="stack stack-sm">
  <button
    class="btn btn-primary btn-lg btn-block check-button"
    class:is-done={done}
    class:is-new={checkedNow}
    type="button"
    aria-busy={saving ? 'true' : undefined}
    aria-describedby={lastId}
    onclick={check}
  >
    <Icon name="check" class="tick" />
    {strings.check.button}
  </button>
  <p class="muted text-sm" id={lastId}>{last}</p>
</div>
