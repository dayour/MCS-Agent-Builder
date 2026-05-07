import { type Page } from '@playwright/test';

export interface OracleContext {
  page: Page;
  testRunId?: string;
}

export interface Oracle {
  /** Feature key matching knowledge/feature-map.json */
  feature: string;
  /** Short description for reports */
  description: string;
  /** Seed app state (localStorage, feature flags, fixtures). Called once before actions. */
  setup: (ctx: OracleContext) => Promise<void>;
  /** Perform the user journey — navigate, click, type. No assertions here. */
  actions: (ctx: OracleContext) => Promise<void>;
  /** Semantic assertions on business outcomes — NOT just "page loaded". */
  assertions: (ctx: OracleContext) => Promise<void>;
  /** Invariants that must hold throughout (no error boundary, no critical console errors). */
  invariants: (ctx: OracleContext) => Promise<void>;
  /** Optional cleanup (stop timers, reset flags). */
  cleanup?: (ctx: OracleContext) => Promise<void>;
}
