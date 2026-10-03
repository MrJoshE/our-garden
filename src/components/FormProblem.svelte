<script>
  /** @type {{ problem: import('../lib/errors.js').Explanation }} */
  let { problem } = $props();
</script>

<div class="banner" data-tone="danger" role="alert">
  <div class="grow">
    <strong>{problem.title}</strong>
    {problem.message}
  </div>
</div>
