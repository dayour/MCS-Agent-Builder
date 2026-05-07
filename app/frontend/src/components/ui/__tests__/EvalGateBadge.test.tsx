/**
 * EvalGateBadge tests — cover every state in publish-state-matrix.md.
 * Fail-closed behavior on unknown state is the critical security guard.
 */

import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EvalGateBadge } from "../EvalGateBadge";

describe("EvalGateBadge", () => {
  test("renders Draft for not_started", () => {
    render(<EvalGateBadge status="not_started" />);
    const badge = screen.getByTestId("eval-gate-badge");
    expect(badge.getAttribute("data-state")).toBe("draft");
    expect(badge.textContent).toContain("Draft");
  });

  test("renders Building for in_progress", () => {
    render(<EvalGateBadge status="in_progress" />);
    expect(screen.getByTestId("eval-gate-badge").getAttribute("data-state")).toBe("building");
  });

  test("renders Internal—needs eval for published-internal with evalGate reason", () => {
    render(
      <EvalGateBadge
        status="published-internal"
        evalGate={{ verdict: "BLOCK", reason: "Safety at 60% (requires 90%)" }}
      />,
    );
    const badge = screen.getByTestId("eval-gate-badge");
    expect(badge.getAttribute("data-state")).toBe("internal-needs-eval");
    expect(badge.textContent).toContain("Internal");
    // tooltip text is on inner span
    const inner = badge.querySelector("span[title]");
    expect(inner?.getAttribute("title")).toContain("BLOCK");
    expect(inner?.getAttribute("title")).toContain("Safety at 60%");
  });

  test("renders Published (UAT) for published-uat on eval-pass path", () => {
    render(<EvalGateBadge status="published-uat" evalGate={{ overallRate: 92 }} />);
    const badge = screen.getByTestId("eval-gate-badge");
    expect(badge.getAttribute("data-state")).toBe("uat");
    // No override badge when override is false/absent
    expect(screen.queryByTestId("eval-gate-override-badge")).toBeNull();
  });

  test("renders Override sub-badge when published-uat with override=true", () => {
    render(
      <EvalGateBadge
        status="published-uat"
        evalGate={{ override: true, overrideApprovedBy: "Jane Doe", overrideTicketRef: "gh-123" }}
      />,
    );
    const override = screen.getByTestId("eval-gate-override-badge");
    expect(override.textContent).toContain("Override");
    expect(override.getAttribute("title")).toContain("Jane Doe");
    expect(override.getAttribute("title")).toContain("gh-123");
  });

  test("renders legacy Published (pre-gate) badge for bare 'published'", () => {
    render(<EvalGateBadge status="published" />);
    expect(screen.getByTestId("eval-gate-badge").getAttribute("data-state")).toBe("legacy-published");
  });

  test("renders Build failed for failed", () => {
    render(<EvalGateBadge status="failed" />);
    expect(screen.getByTestId("eval-gate-badge").getAttribute("data-state")).toBe("failed");
  });

  test("FAIL-CLOSED: unknown backend status renders red-outline 'unknown' — never Published", () => {
    render(<EvalGateBadge status={"ready-to-ship" as any} />);
    const badge = screen.getByTestId("eval-gate-badge");
    expect(badge.getAttribute("data-state")).toBe("unknown");
    expect(badge.textContent).toContain("Unknown");
    // Critical security guarantee: unknown must NOT be rendered as Published/UAT
    expect(badge.textContent).not.toContain("Published");
    expect(badge.textContent).not.toContain("UAT");
  });

  test("FAIL-CLOSED: null status renders as unknown", () => {
    render(<EvalGateBadge status={null} />);
    expect(screen.getByTestId("eval-gate-badge").getAttribute("data-state")).toBe("unknown");
  });

  test("FAIL-CLOSED: undefined status renders as unknown", () => {
    render(<EvalGateBadge />);
    expect(screen.getByTestId("eval-gate-badge").getAttribute("data-state")).toBe("unknown");
  });

  test("long evalGate.reason is truncated in tooltip (<=180 chars)", () => {
    const longReason = "a".repeat(500);
    render(<EvalGateBadge status="published-internal" evalGate={{ verdict: "BLOCK", reason: longReason }} />);
    const inner = screen.getByTestId("eval-gate-badge").querySelector("span[title]");
    const title = inner?.getAttribute("title") || "";
    // Tooltip prefix plus up to 180 chars reason
    expect(title.length).toBeLessThan(280);
    expect(title).toContain("…");
  });

  test("override badge honors showOverrideBadge=false prop", () => {
    render(
      <EvalGateBadge
        status="published-uat"
        evalGate={{ override: true, overrideApprovedBy: "Jane Doe" }}
        showOverrideBadge={false}
      />,
    );
    expect(screen.queryByTestId("eval-gate-override-badge")).toBeNull();
  });
});
