import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    exclude: ['node_modules/**'],
    clearMocks: true,
    restoreMocks: true,
  },
});
