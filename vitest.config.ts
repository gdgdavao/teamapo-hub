import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
  '@assets': fileURLToPath(new URL('./src/assets', import.meta.url)),
};

export default defineConfig({
  resolve: { alias },
  test: {
    // Two projects, not one. The existing suite under tests/unit is
    // source-shape and logic tests that import modules directly; they run in
    // node and must stay fast. Component tests need a DOM, and paying for
    // jsdom on every unit test to serve them is a bad trade.
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/**/*.test.{ts,tsx}'],
          exclude: ['tests/rules/**', 'tests/dom/**', 'node_modules/**'],
          clearMocks: true,
          restoreMocks: true,
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['tests/dom/**/*.test.tsx'],
          setupFiles: ['tests/dom/setup.ts'],
          clearMocks: true,
          restoreMocks: true,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/utils/**'],
      exclude: [
        'src/utils/storageUtils.ts',
        'src/utils/certificateGeneration.ts',
      ],
    },
  },
});