<script setup lang="ts">
/**
 * MCP tools as `tools/list` serves them, from the data `reference.data.ts` reads out of the built client.
 *
 * `group` shows one `--mcp-tools` group, or `core`. `names` shows the tools it lists, comma-separated.
 * With neither, every tool.
 */
import { computed } from 'vue';
import { data } from './reference.data';

const props = defineProps<{ group?: string; names?: string }>();

const tools = computed(() => {
  const named = props.names?.split(',').map((name) => name.trim());
  return data.tools.filter((tool) =>
    (props.group === undefined || tool.group === props.group)
    && (named === undefined || named.includes(tool.name)));
});
</script>

<template>
  <table class="mcp-tools">
    <thead>
      <tr><th>Tool</th><th>What it does</th><th>Arguments</th></tr>
    </thead>
    <tbody>
      <tr v-for="tool in tools" :key="tool.name">
        <td>
          <code>{{ tool.name }}</code>
          <div class="mcp-note">{{ tool.group }}{{ tool.readOnly ? ', read only' : '' }}</div>
        </td>
        <td>{{ tool.description }}</td>
        <td>
          <div v-for="argument in tool.arguments" :key="argument.name">
            <code>{{ argument.name }}</code>
            <span class="mcp-note"> {{ argument.type }}{{ argument.required ? ', required' : '' }}</span>
            <div>{{ argument.description }}</div>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style>
.mcp-tools {
  font-size: 14px;
  line-height: 1.5;
}

.mcp-tools th,
.mcp-tools td {
  padding: 6px 10px;
  vertical-align: top;
}

.mcp-tools td code {
  font-size: 12px;
  white-space: nowrap;
}

.mcp-tools td > div + div {
  margin-top: 6px;
}

.mcp-tools td:last-child {
  min-width: 14em;
}

.mcp-note {
  color: var(--vp-c-text-2);
  font-size: 12px;
}
</style>
