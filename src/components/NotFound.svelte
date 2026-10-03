<script>
  import { strings } from '../lib/strings.js';

  /** @type {{ href: string, label: string }} where to go instead */
  let { href, label } = $props();
</script>

<main class="page page-narrow">
  <div class="empty">
    <h1 tabindex="-1">{strings.errors.notFound.title}</h1>
    <p>{strings.errors.notFound.message}</p>
    <a class="btn btn-primary" {href}>{label}</a>
  </div>
</main>
