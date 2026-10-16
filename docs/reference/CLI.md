<script setup>
import { data } from '../.vitepress/theme/reference.data';
</script>

# CLI

Every command, as `ahpc help` prints it. This page is built from the same text, so it matches the installed version.

For the flags of the screen, see [Screen](../use/SCREEN.md). For what each command is for, see the [subject pages](../README.md#subjects).

<pre class="cli-help"><code>{{ data.help }}</code></pre>

<style>
.cli-help {
  overflow-x: auto;
  padding: 16px 20px;
  border-radius: 8px;
  background: var(--vp-code-block-bg);
  font-size: 13px;
  line-height: 1.5;
}
</style>
