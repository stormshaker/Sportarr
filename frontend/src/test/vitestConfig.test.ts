import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('vitest/config', () => ({ defineConfig: (config: unknown) => config }));
vi.mock('@vitejs/plugin-react', () => ({ default: () => ({ name: 'react' }) }));

async function loadTestConfig(ci: string) {
  vi.stubEnv('CI', ci);
  vi.resetModules();
  const mod = await import('../../vitest.config');
  return (mod.default as { test: { testTimeout?: number; hookTimeout?: number; maxWorkers?: number } }).test;
}

describe('vitest.config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('raises testTimeout and hookTimeout to 20000 when CI is set', async () => {
    const test = await loadTestConfig('1');
    expect(test.testTimeout).toBe(20000);
    expect(test.hookTimeout).toBe(20000);
  });

  it('caps the worker pool at 2 when CI is set', async () => {
    const test = await loadTestConfig('1');
    expect(test.maxWorkers).toBe(2);
  });

  it('leaves testTimeout and hookTimeout to vitest defaults when CI is empty', async () => {
    const test = await loadTestConfig('');
    expect(test.testTimeout).toBeUndefined();
    expect(test.hookTimeout).toBeUndefined();
    expect(test.maxWorkers).toBeUndefined();
  });
});
