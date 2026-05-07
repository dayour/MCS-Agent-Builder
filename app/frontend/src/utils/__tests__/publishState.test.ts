/**
 * Unit tests for getPublishDisplayState — the pure backend→UI mapping.
 * Run: node --experimental-strip-types --test app/frontend/src/utils/__tests__/publishState.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import { getPublishDisplayState } from "../publishState.ts";

test("not_started → draft", () => {
  const d = getPublishDisplayState("not_started");
  assert.equal(d.state, "draft");
  assert.equal(d.isUatVisible, false);
});

test("published-internal → internal-needs-eval, NOT UAT-visible", () => {
  const d = getPublishDisplayState("published-internal", { verdict: "BLOCK", reason: "zero tests" });
  assert.equal(d.state, "internal-needs-eval");
  assert.equal(d.isUatVisible, false);
  assert.ok(d.tooltip.includes("zero tests"));
});

test("published-uat eval-pass → uat, UAT-visible, no override", () => {
  const d = getPublishDisplayState("published-uat", { overallRate: 88 });
  assert.equal(d.state, "uat");
  assert.equal(d.isUatVisible, true);
  assert.equal(d.hasOverride, false);
});

test("published-uat with override=true → hasOverride=true", () => {
  const d = getPublishDisplayState("published-uat", {
    override: true,
    overrideApprovedBy: "Jane",
    overrideTicketRef: "tix-1",
  });
  assert.equal(d.state, "uat");
  assert.equal(d.hasOverride, true);
  assert.ok(d.tooltip.includes("OVERRIDE"));
  assert.ok(d.tooltip.includes("Jane"));
});

test("legacy 'published' renders as legacy-published with yellow tint", () => {
  const d = getPublishDisplayState("published");
  assert.equal(d.state, "legacy-published");
  assert.equal(d.badgeVariant, "yellow");
  assert.equal(d.isUatVisible, true);  // grandfathered
});

test("failed state isUatVisible=false", () => {
  const d = getPublishDisplayState("failed");
  assert.equal(d.state, "failed");
  assert.equal(d.isUatVisible, false);
});

test("UNKNOWN STATE fails closed (isUatVisible=false, red-outline)", () => {
  const d = getPublishDisplayState("ready-to-ship-to-everyone-now");
  assert.equal(d.state, "unknown");
  assert.equal(d.isUatVisible, false, "unknown states MUST NOT be UAT-visible");
  assert.equal(d.badgeVariant, "red-outline");
  assert.ok(d.label.includes("Unknown"));
});

test("null status → unknown + fail-closed", () => {
  const d = getPublishDisplayState(null);
  assert.equal(d.state, "unknown");
  assert.equal(d.isUatVisible, false);
});

test("undefined status → unknown + fail-closed", () => {
  const d = getPublishDisplayState(undefined);
  assert.equal(d.state, "unknown");
  assert.equal(d.isUatVisible, false);
});
