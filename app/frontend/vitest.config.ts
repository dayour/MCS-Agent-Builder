import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';

// Separate vitest config so component tests don't collide with Playwright.
// Only picks up src/**/__tests__/**/*.test.{ts,tsx} — Playwright owns e2e/**.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: false,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    // Node:test-driven utils/__tests__ files must not run through vitest —
    // they're executed via `npm run test:unit` with `node --test
    // --experimental-strip-types`. Mixing runners on the same file produces
    // 'No test suite found' false-fails because the API namespaces (vitest's
    // `expect`/`describe` vs node:test's `assert`/`test`) don't intersect.
    exclude: [
      'src/utils/__tests__/persistChatAgent.test.ts',
      'src/utils/__tests__/publishState.test.ts',
    ],
  },
});
