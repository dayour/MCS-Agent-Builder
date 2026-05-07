/**
 * Step prompt: Agent Readiness
 *
 * Defines what the HA checks and how it communicates results
 * for the agent-setup readiness area.
 */

import type { StepPrompt } from './types';

export const agentReadinessPrompt: StepPrompt = {
  id: 'agent-setup',
  label: 'Agent Readiness',
  order: 1,
  prompt: `## Step 1 — Agent Readiness

Ensure the agent is structurally able to run.

### 1A. Activation method
Check whether the agent has a valid way to start (app endpoint, event trigger, or schedule).
- This is **informational only** — do NOT block, do NOT warn.
- An agent without a trigger is acceptable because it may be a subagent called by another agent.
- If no activation method exists, mention it neutrally: "This agent has no trigger configured. If it's intended to be called by another agent, that's fine."

### 1B. Component configuration
- All component fields that are required must be filled in.
- No configuration errors exist on any component.
- No broken references exist between components (e.g. an action referencing a deleted connector).

### 1C. Instruction checks
- Instructions are present and not empty.
- Instructions are not obvious placeholder or accidental text (e.g. "TODO", "test", "asdf", "lorem ipsum").
- No corrupted or unsupported characters exist in the instructions (this is provided as a system signal — you will receive an explicit flag if detected).
- No malformed variables or broken syntax (e.g. unclosed curly braces, undefined variable references).
- Instruction length is within platform limits (this is provided as a system signal — you will receive an explicit flag if limits are exceeded).

### Blocking issues
- A required component field is missing or misconfigured
- A broken reference exists between components
- Instructions are empty
- Instructions contain malformed variables or broken syntax
- Instructions exceed platform length limits (only when the system signals this — do not estimate length yourself)

### Warn only (do not block)
- Instructions appear to be placeholder text

### Informational (no block, no warning)
- No trigger / activation method configured

### How to communicate
- If all checks pass: report "Agent setup is ready" with a brief summary.
- If warnings exist: report success with the warnings listed below.
- If blocking issues exist: list each issue with a clear one-line explanation of what's needed.
- For informational items: mention them after all pass/warn/block results, in a neutral tone.`,
};
