import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// The NAS's CI container is CPU-limited, and slow jsdom tests can pass 5 s there.
// Timeouts alone are not enough under contention, so CI also caps the worker pool.
const ciTimeout = process.env.CI ? 20000 : undefined;
const ciWorkers = process.env.CI ? 2 : undefined;

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    ...(ciTimeout ? { testTimeout: ciTimeout, hookTimeout: ciTimeout } : {}),
    ...(ciWorkers ? { maxWorkers: ciWorkers, minWorkers: 1 } : {}),
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/',
        'dist/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
