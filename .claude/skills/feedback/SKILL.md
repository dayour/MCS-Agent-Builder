---
name: feedback
description: "File a bug report or feature suggestion on GitHub via gh CLI. Gathers details conversationally, previews, and creates an issue. Use when the user wants to report a bug or suggest a feature."
user_invocable: true
---

# Feedback — Bug Reports & Feature Suggestions

File bugs and suggestions on GitHub without leaving the dashboard.

## Determine Type

From the invocation, determine the feedback type:
- Args contain `bug` (or user describes something broken/wrong/failing) → **Bug**
- Args contain `suggest` or `enhancement` (or user describes something they want added/improved) → **Suggestion**
- Ambiguous → ask: "Is this a bug report or a feature suggestion?"

## Process

1. **Auth & tooling check** — run `gh auth status`. If not authenticated, tell the user to run `gh auth login` and stop.

2. **Account confirmation (MANDATORY)** — show the user the signed-in account from `gh auth status` output and ask them to confirm:
   > You're signed in as **[username]**. Issues will be created in **microsoft/MCS-Agent-Builder**. Is this correct?

   Do NOT proceed until the user confirms. If they say no, help them switch accounts with `gh auth login`.

3. **Check for pre-filled context** — if args were passed (from the dashboard dialog), extract the context and skip the "ask" step. The format is: `[bug|suggest] Project: X | Agent: Y | Page: Z | ... | User says: "description"`. Use the "User says" portion as the description and the rest as auto-context.

4. **If no args**, ask ONE question:
   - Bug: "What went wrong? Describe the bug — what happened, what you expected, and any steps to reproduce."
   - Suggestion: "What would you like to see added or improved?"

5. **Auto-gather context** Claude already knows:
   - Current project (from Build-Guides/ or conversation or pre-filled args)
   - Skill or workflow that failed (if applicable)
   - Environment / account (from session config)
   - Any error messages from the current session

6. **Generate issue**:

   **For bugs:**
   - **Title**: `Bug: <concise summary>` (under 70 chars)
   - **Label**: `bug`
   - **Body**:
     ```
     ## What happened
     [user's description]

     ## Steps to reproduce
     [extracted from description, or "Not provided"]

     ## Expected behavior
     [extracted or inferred]

     ## Environment
     - Account: [if known]
     - Environment: [if known]
     - Skill/workflow: [if applicable]
     - Page: [if provided]
     ```

   **For suggestions:**
   - **Title**: `Suggestion: <concise summary>` (under 70 chars)
   - **Label**: `enhancement`
   - **Body**:
     ```
     ## Problem / motivation
     [why this would help]

     ## Proposed solution
     [what the user wants]

     ## Context
     - Area: [dashboard, skills, build workflow, etc.]
     - Related: [any related features or components]
     - Page: [if provided]
     ```

7. **Preview** — show the full title + body to the user and ask:
   > Here's the issue I'll create. Want me to submit it, or would you like to change anything?

8. **On confirmation** — run:
   ```
   gh issue create --repo microsoft/MCS-Agent-Builder --title "Bug: ..." --body "$(cat <<'EOF'
   <body>
   EOF
   )" --label bug
   ```
   (Use `--label enhancement` for suggestions.)

9. **Return** the issue number and URL to the user.

## Rules

- Repo is always `microsoft/MCS-Agent-Builder`
- ALWAYS confirm the user's signed-in account before creating anything
- NEVER submit without user confirmation of the issue preview
- Use HEREDOC for the body to preserve formatting
- Keep the title under 70 characters
- If the user's description is vague, ask ONE follow-up — don't interrogate
- When invoked with pre-filled args from the dashboard, skip the description question but STILL confirm the account
