<script>
  import Icon from './Icon.svelte';
  import IssueCard from './IssueCard.svelte';
  import IssueSheet from './IssueSheet.svelte';
  import { ACTIVE_ISSUE_STATUSES } from '../lib/constants.js';
  import { openSheet, route } from '../lib/state/router.svelte.js';
  import { strings } from '../lib/strings.js';

  /**
   * The plant's problems: open and watching ones as cards, resolved ones
   * folded away underneath, and a way to flag a new one (brief section 8).
   * @type {{ issues: Record<string, any>[], plantId: string }}
   */
  let { issues, plantId } = $props();

  const headingId = $props.id();
  const active = $derived(issues.filter((issue) => ACTIVE_ISSUE_STATUSES.includes(issue.status)));
  const resolved = $derived(issues.filter((issue) => !ACTIVE_ISSUE_STATUSES.includes(issue.status)));
  let showResolved = $state(false);
</script>

<section class="stack stack-sm" aria-labelledby={headingId}>
  <div class="cluster cluster-between">
    <h2 class="eyebrow" id={headingId}>{strings.issues.title}</h2>
    <button class="btn btn-quiet" type="button" onclick={() => openSheet('add-issue')}>
      <Icon name="plus" />
      {strings.issues.flag}
    </button>
  </div>
  {#each active as issue (issue.id)}
    <IssueCard {issue} />
  {/each}
  {#if resolved.length}
    <button
      class="btn btn-quiet"
      type="button"
      aria-expanded={showResolved}
      aria-controls="{headingId}-resolved"
      onclick={() => (showResolved = !showResolved)}
    >
      {strings.issues.resolvedGroup(resolved.length)}
      <Icon name="chevronDown" />
    </button>
    <div class="reveal" class:is-open={showResolved} id="{headingId}-resolved" inert={!showResolved}>
      <div class="stack stack-sm">
        {#each resolved as issue (issue.id)}
          <IssueCard {issue} />
        {/each}
      </div>
    </div>
  {/if}
</section>

<IssueSheet open={route.sheet === 'add-issue'} {plantId} />

<style>
  /* The fold sits at the start of the column, like the cards above it */
  [aria-expanded] {
    align-self: flex-start;
  }
</style>
