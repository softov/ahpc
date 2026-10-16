import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import McpTools from './McpTools.vue';
import './custom.css';

/** VitePress's default theme, with the ahpapp palette and the generated MCP tool tables. */
export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('McpTools', McpTools);
  },
} satisfies Theme;
