<script>
  import { setIssueStatus } from '../lib/db/index.js';
  import { ISSUE_KINDS, ISSUE_STATUSES, SEVERITIES } from '../lib/constants.js';
  import { daysSince } from '../lib/dates.js';
  import { app, reportError, showToast } from '../lib/state/app.svelte.js';
  import { strings } from '../lib/strings.js';

  /** @type {{ issue: Record<string, any> }} */
  let { issue } = $props();

  const titleId = $props.id();
  const TONES = { open: 'attention', watching: 'watching', resolved: 'resolved' };
  /** @type {'open' | 'watching' | 'resolved'} */
  const status = $derived(ISSUE_STATUSES.has(issue.status) ? issue.status : 'open');
  // The two statuses she can move it to from here
  const moves = $derived(
    status === 'resolved'
      ? [{ to: 'open', label: strings.issues.reopen }]
      : [
          { to: status === 'open' ? 'watching' : 'open', label: ISSUE_STATUSES.label(status === 'open' ? 'watching' : 'open') },
          { to: 'resolved', label: ISSUE_STATUSES.label('resolved') }
        ]
  );

  /** @type {string | null} */
  let saving = $state(null);

  /** @param {'open' | 'watching' | 'resolved'} to */
  async function move(to) {
    if (saving) return;
    saving = to;
    try {
      if (await setIssueStatus(issue.id, to)) {
        if (to === 'resolved') navigator.vibrate?.(10);
        showToast(strings.autoEntry.issueStatus[to]);
      }
    } catch (error) {
      reportError(error, { operation: 'setIssueStatus', issueId: issue.id });
    } finally {
      saving = null;
    }
  }
</script>

<article class="card issue-card" data-tone={TONES[status]} aria-labelledby={titleId}>
  <p class="status">
    <span>{ISSUE_STATUSES.label(status)}</span>
    <span>{ISSUE_KINDS.label(issue.kind)}</span>
    <span>
      <span class="severity" data-level={issue.severity} aria-hidden="true"><i></i><i></i><i></i></span>
      {SEVERITIES.label(issue.severity)}
    </span>
    <span>{strings.issues.seen(daysSince(issue.firstSeenOn, app.today))}</span>
  </p>
  <h3 class="title" id={titleId}>{issue.title}</h3>
  {#if issue.notes}<p class="prose text-sm">{issue.notes}</p>{/if}
  <div class="cluster">
    {#each moves as { to, label } (to)}
      <button
        class="btn"
        class:btn-secondary={to === 'resolved'}
        type="button"
        aria-describedby={titleId}
        aria-busy={saving === to ? 'true' : undefined}
        onclick={() => move(/** @type {'open' | 'watching' | 'resolved'} */ (to))}
      >
        {label}
      </button>
    {/each}
  </div>
</article>
