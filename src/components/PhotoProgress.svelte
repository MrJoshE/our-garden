<script>
  import { strings } from '../lib/strings.js';

  /** @type {{ label: string, done: number, total: number }} */
  let { label, done, total } = $props();
</script>

<div
  class="progress"
  role="progressbar"
  aria-label={label}
  aria-valuemin="0"
  aria-valuemax={total}
  aria-valuenow={done}
  aria-valuetext={strings.backup.progress(done, total)}
>
  <i style:--value={total ? (done / total) * 100 : 0}></i>
</div>
