<script>
  import { tick } from 'svelte';
  import Icon from './Icon.svelte';
  import Photo from './Photo.svelte';
  import { setCoverPhoto } from '../lib/db/index.js';
  import { dayName } from '../lib/dates.js';
  import { app, reportError, showToast } from '../lib/state/app.svelte.js';
  import { closeSheet } from '../lib/state/router.svelte.js';
  import { strings } from '../lib/strings.js';

  /**
   * An entry's photos, full size, one at a time (brief section 10). Open
   * while `viewing` is set. Swiping is the stage's own scrolling.
   * @type {{
   *   viewing: { entry: Record<string, any>, index: number } | undefined,
   *   plantId: string,
   *   coverId: string | null
   * }} viewing: the entry and the photo to start on; coverId: the plant's cover photo
   */
  let { viewing, plantId, coverId } = $props();

  /** @type {HTMLDialogElement} */
  let dialog;
  /** @type {HTMLElement} */
  let stage;
  let current = $state(0);
  // The photo she tapped, to give focus back to
  let openedFrom = '';

  const photos = $derived(viewing?.entry.photos ?? []);
  const photo = $derived(photos[current]);
  const open = $derived(!!viewing);

  $effect(() => {
    if (open && !dialog.open) show();
    else if (!open && dialog.open) {
      dialog.close();
      returnFocus();
    }
  });

  async function show() {
    if (!viewing) return;
    current = viewing.index;
    openedFrom = photos[current]?.id ?? '';
    dialog.showModal();
    await tick();
    stage.scrollTo({ left: current * stage.clientWidth, behavior: 'instant' });
  }

  // The button that opened it may have been redrawn since, so it is found again
  function returnFocus() {
    const opener = document.querySelector(`[data-photo="${openedFrom}"]`) ?? document.querySelector('main h1');
    if (opener instanceof HTMLElement) opener.focus();
  }

  /** @param {number} index */
  function go(index) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    stage.scrollTo({ left: index * stage.clientWidth, behavior: reduce ? 'instant' : 'smooth' });
  }

  /** @param {KeyboardEvent} event */
  function onkeydown(event) {
    if (event.key === 'ArrowLeft' && current > 0) go(current - 1);
    if (event.key === 'ArrowRight' && current < photos.length - 1) go(current + 1);
  }

  async function useAsCover() {
    if (!photo) return;
    try {
      await setCoverPhoto(plantId, photo.id);
      showToast(strings.lightbox.coverChanged);
    } catch (error) {
      reportError(error, { operation: 'setCoverPhoto', plantId, photoId: photo.id });
    }
  }
</script>

<dialog
  bind:this={dialog}
  class="lightbox"
  aria-label={strings.lightbox.label}
  oncancel={(event) => {
    event.preventDefault();
    closeSheet();
  }}
  onclose={() => open && closeSheet()}
  {onkeydown}
>
  <div class="bar">
    <button class="btn btn-icon btn-quiet" type="button" aria-label={strings.actions.close} onclick={closeSheet}>
      <Icon name="close" />
    </button>
    {#if photos.length > 1}
      <span aria-live="polite">{strings.lightbox.position(current + 1, photos.length)}</span>
    {/if}
    {#if photo && photo.id === coverId}
      <span class="lightbox-cover"><Icon name="check" />{strings.lightbox.isCover}</span>
    {:else if photo}
      <button class="btn btn-quiet" type="button" onclick={useAsCover}>{strings.lightbox.useAsCover}</button>
    {/if}
  </div>

  <div class="stage" bind:this={stage} onscroll={() => (current = Math.round(stage.scrollLeft / stage.clientWidth))}>
    {#each photos as each, i (each.id)}
      <div>
        <!-- A photo whose image data was purged shows the stage's own dark ground -->
        {#if each.blob ?? each.thumb}
          <Photo blob={each.blob ?? each.thumb} alt={strings.lightbox.position(i + 1, photos.length)} />
        {/if}
      </div>
    {/each}
  </div>

  <div class="caption">
    {#if photos.length > 1}
      <button class="btn btn-icon btn-quiet" type="button" aria-label={strings.lightbox.previous} disabled={current === 0} onclick={() => go(current - 1)}>
        <Icon name="chevronLeft" />
      </button>
    {/if}
    <div class="grow">
      {#if photo?.caption}{photo.caption}<br />{/if}
      {#if viewing}{dayName(viewing.entry.occurredOn, app.today)}{/if}
    </div>
    {#if photos.length > 1}
      <button class="btn btn-icon btn-quiet" type="button" aria-label={strings.lightbox.next} disabled={current === photos.length - 1} onclick={() => go(current + 1)}>
        <Icon name="chevronRight" />
      </button>
    {/if}
  </div>
</dialog>
