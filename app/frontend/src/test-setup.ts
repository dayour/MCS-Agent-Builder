/**
 * Vitest test setup — runs before every test file in the frontend workspace.
 *
 * Registers @testing-library/jest-dom matchers (toBeInTheDocument, toHaveText, …)
 * and clears React Testing Library renders between tests so state doesn't leak.
 */

import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
