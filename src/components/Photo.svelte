<script>
  /**
   * An image from a saved photo. Makes the object URL and frees it when the
   * photo or the component goes, and fades the image in once decoded.
   * @type {{ blob: Blob, alt?: string } & Record<string, any>}
   */
  let { blob, alt = '', ...rest } = $props();

  let url = $state('');
  let loaded = $state(false);

  $effect(() => {
    const objectUrl = URL.createObjectURL(blob);
    url = objectUrl;
    loaded = false;
    return () => URL.revokeObjectURL(objectUrl);
  });
</script>

{#if url}
  <img
    src={url}
    {alt}
    loading="lazy"
    decoding="async"
    class="fade"
    class:is-loaded={loaded}
    onload={() => (loaded = true)}
    {...rest}
  />
{/if}
