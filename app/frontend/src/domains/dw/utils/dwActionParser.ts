/**
 * dwActionParser.ts
 *
 * Parses fenced `dw-action` blocks from assistant message text and extracts
 * structured JSON payloads used to drive side-effects in the DW conversational
 * chat experience (instruction updates, skill creation, task creation, etc.).
 *
 * Block format:
 *
 *   ```dw-action
 *   {"type": "update-instructions", "role": "Finance Analyst", ...}
 *   ```
 */

// ---------------------------------------------------------------------------
// Action types
// ---------------------------------------------------------------------------

export type DwActionType =
  | 'update-instructions'
  | 'create-skill'
  | 'create-task'
  | 'show-tasks';

export interface DwInstructionsAction {
  type: 'update-instructions';
  title?: string;
  role: string;
  responsibilities: Array<{ text: string; color?: string }>;
  goal: string;
  fullInstructions?: string;
}

export interface DwSkillAction {
  type: 'create-skill';
  name: string;
  description: string;
  capabilities: string[];
  optimizedFor?: string;
}

export interface DwTaskAction {
  type: 'create-task';
  name: string;
  description: string;
  bullets?: string[];
  recurrence?: string;
  timeSaved?: string;
}

export interface DwTaskListAction {
  type: 'show-tasks';
  tasks: Array<{
    name: string;
    subtitle?: string;
    status: 'running' | 'complete' | 'pending' | 'upcoming';
    connectors?: string[];
  }>;
}

export type DwAction =
  | DwInstructionsAction
  | DwSkillAction
  | DwTaskAction
  | DwTaskListAction;

export interface ParseResult {
  /** The original text with all dw-action fenced blocks removed and trimmed. */
  cleanText: string;
  /** Parsed actions extracted from the fenced blocks. */
  actions: DwAction[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_ACTION_TYPES = new Set<string>([
  'update-instructions',
  'create-skill',
  'create-task',
  'show-tasks',
]);

/**
 * Regex to match fenced dw-action blocks.
 *
 * Captures the content between the opening ```dw-action and the closing ```.
 * The `s` (dotAll) flag lets `.` match newlines so multi-line JSON payloads
 * are captured correctly.
 */
const DW_ACTION_BLOCK_RE = /```dw-action\s*\n([\s\S]*?)```/g;

function isValidActionType(type: unknown): type is DwActionType {
  return typeof type === 'string' && VALID_ACTION_TYPES.has(type);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scan `text` for fenced `dw-action` blocks, parse each as JSON, and return
 * the cleaned text (blocks removed) along with the array of parsed actions.
 *
 * - Blocks with invalid JSON are silently skipped.
 * - Blocks whose `type` field is not a recognized `DwActionType` are skipped.
 * - Consecutive blank lines left after stripping blocks are collapsed.
 */
export function parseDwActions(text: string): ParseResult {
  const actions: DwAction[] = [];

  // Strip each dw-action block from the text while extracting payloads.
  let cleanText = text.replace(DW_ACTION_BLOCK_RE, (_match, jsonBody: string) => {
    try {
      const parsed = JSON.parse(jsonBody.trim());
      if (parsed && typeof parsed === 'object' && isValidActionType(parsed.type)) {
        actions.push(parsed as DwAction);
      }
    } catch {
      // Invalid JSON — skip silently.
    }
    // Replace the entire block with an empty string.
    return '';
  });

  // Collapse runs of blank lines (3+ newlines) down to a single blank line,
  // then trim leading/trailing whitespace.
  cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();

  return { cleanText, actions };
}
