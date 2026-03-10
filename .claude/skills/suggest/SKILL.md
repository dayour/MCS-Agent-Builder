---
name: suggest
description: Submit a feature suggestion conversationally — Claude gathers details, previews, and creates a GitHub issue via gh CLI.
---

# Feature Suggestion

File a feature suggestion on GitHub without leaving the dashboard.

## Process

1. **Auth & tooling check** — run `gh auth status`. If not authenticated, tell the user to run `gh auth login` and stop.

2. **Account confirmation (MANDATORY)** — show the user the signed-in account from `gh auth status` output and ask them to confirm:
   > You're signed in as **[username]**. Issues will be created in **microsoft/MCS-Agent-Builder**. Is this correct?

   Do NOT proceed until the user confirms. If they say no, help them switch accounts with `gh auth login`.

3. **Check for pre-filled context** — if args were passed (from the dashboard dialog), extract the context and skip the "ask" step. The format is: `Project: X | Agent: Y | Page: Z | ... | User says: "description"`. Use the "User says" portion as the suggestion description and the rest as auto-context.

4. **If no args**, ask ONE question:
   > What would you like to see added or improved?

5. **Auto-gather context** Claude already knows:
   - Current project or workflow area (from conversation or pre-filled args)
   - Related skills or components
   - Any prior discussion context from the session

6. **Generate issue**:
   - **Title**: `Suggestion: <concise summary>` (under 70 chars)
   - **Body** (markdown):
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
   > Here's the suggestion I'll create. Want me to submit it, or would you like to change anything?

8. **On confirmation** — run:
   ```
   gh issue create --repo microsoft/MCS-Agent-Builder --title "Suggestion: ..." --body "$(cat <<'EOF'
   <body>
   EOF
   )" --label enhancement
   ```

9. **Return** the issue number and URL to the user.

## Rules

- Repo is always `microsoft/MCS-Agent-Builder`
- Label is always `enhancement`
- ALWAYS confirm the user's signed-in account before creating anything
- NEVER submit without user confirmation of the issue preview
- Use HEREDOC for the body to preserve formatting
- Keep the title under 70 characters
- If the user's idea is vague, ask ONE follow-up — don't interrogate
- When invoked with pre-filled args from the dashboard, skip the description question but STILL confirm the account
