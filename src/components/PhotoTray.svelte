<script>
  import Icon from './Icon.svelte';
  import Photo from './Photo.svelte';
  import { LIMITS } from '../lib/constants.js';
  import { uuid } from '../lib/ids.js';
  import { processPhoto } from '../lib/images.js';
  import { logError } from '../lib/log.js';
  import { showToast } from '../lib/state/app.svelte.js';
  import { strings } from '../lib/strings.js';

  /**
   * @typedef {object} TrayPhoto
   * @property {string} key
   * @property {'processing' | 'ready' | 'failed'} status
   * @property {Record<string, any> | null} photo what processPhoto made, once ready
   */

  /**
   * Photos picked for an entry, each turned into what the journal keeps
   * (brief section 10) one at a time, so a phone's memory is not swamped.
   * @type {{ photos: TrayPhoto[] }}
   */
  let { photos = $bindable() } = $props();

  // Each picked file waits for the one before it
  let queue = Promise.resolve();

  /** Resolves once every picked photo has been processed. */
  export function settled() {
    return queue;
  }

  /** @param {Event & { currentTarget: HTMLInputElement }} event */
  function pick(event) {
    const input = event.currentTarget;
    const files = [...(input.files ?? [])];
    // Let the same file be picked again after removing it
    input.value = '';
    const room = LIMITS.photosPerEntry - photos.filter((item) => item.status !== 'failed').length;
    if (files.length > room) showToast(strings.photos.tooMany(LIMITS.photosPerEntry));
    for (const file of files.slice(0, Math.max(0, room))) {
      const key = uuid();
      photos.push({ key, status: 'processing', photo: null });
      queue = queue.then(() => process(key, file));
    }
  }

  /**
   * @param {string} key
   * @param {File} file
   */
  async function process(key, file) {
    // Removed while it waited its turn
    if (!photos.some((item) => item.key === key)) return;
    try {
      const photo = await processPhoto(file);
      const item = photos.find((each) => each.key === key);
      if (item) Object.assign(item, { status: 'ready', photo });
    } catch (error) {
      logError(error, { operation: 'processPhoto', type: file.type });
      const item = photos.find((each) => each.key === key);
      if (item) item.status = 'failed';
    }
  }

  /** @param {string} key */
  function remove(key) {
    photos = photos.filter((item) => item.key !== key);
  }
</script>

<div class="photo-tray">
  {#each photos as item (item.key)}
    <div class="thumb" class:is-processing={item.status === 'processing'} class:is-failed={item.status === 'failed'}>
      {#if item.photo}<Photo blob={item.photo.thumb} />{/if}
      {#if item.status === 'failed'}<span class="thumb-message">{strings.photos.failed}</span>{/if}
      <button class="remove" type="button" aria-label={strings.photos.remove} onclick={() => remove(item.key)}>
        <Icon name="close" />
      </button>
    </div>
  {/each}
  {#if photos.filter((item) => item.status !== 'failed').length < LIMITS.photosPerEntry}
    <label class="photo-add">
      <input type="file" accept="image/*" multiple onchange={pick} />
      <Icon name="camera" />
      {strings.photos.add}
    </label>
  {/if}
</div>
