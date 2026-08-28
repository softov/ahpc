import { defineConfig } from 'vitest/config';

/*
 * No aliases.
 *
 * Inside the TextUI workspace this file redirected `@textui/*` at the
 * packages' own source, so an example tested against the runtime as it is
 * rather than as it was last published. Here that would be a lie: this client
 * depends on the published packages like anything else does, and testing
 * against sources it does not ship with would hide the day they diverge.
 */
export default defineConfig({
  test: { include: ['test/**/*.test.ts', 'test/**/*.test.tsx'], environment: 'node' },
  esbuild: { jsx: 'automatic', jsxImportSource: '@textui/core' },
});
