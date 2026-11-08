import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // Pure logic tests run in node. A DOM test opts in with `// @vitest-environment jsdom`.
    environment: 'node',
  },
});
