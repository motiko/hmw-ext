import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    environment: 'happy-dom',
    globals: true,
    mockReset: true,
    restoreMocks: true,
    unstubGlobals: true,
  },
});
