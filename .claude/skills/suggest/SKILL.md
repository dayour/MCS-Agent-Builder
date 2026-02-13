---
name: suggest
description: Submit a feature suggestion conversationally — Claude gathers details, previews, and files a GitHub issue via gh CLI.
---

# Feature Suggestion

File a feature suggestion on GitHub without leaving the dashboard.

## Process

1. **Auth check** — run `gh auth status`. If not authenticated, tell the user to run `gh auth login` and stop.

2. **Ask ONE question**:
   > What would you like to see added or improved?

3. **Auto-gather context** Claude already knows:
   - Current project or workflow area
   - Related skills or components
   - Any prior discussion context from the session

4. **Generate issue**:
   - **Title**: `Suggestion: <concise summary>` (under 70 chars)
   - **Body** (markdown):
     ```
     ## Problem / motivation
     <why this would help>

     ## Proposed solution
     <what the user wants>

     ## Context
     - Area: <dashboard, skills, build workflow, etc.>
     - Related: <any related features or components>
     ```

5. **Preview** — show the full title + body to the user and ask:
   > Here's the suggestion I'll create. Want me to submit it, or would you like to change anything?

6. **On confirmation** — run:
   ```
   gh issue create --repo damgyeah/MCS-Agent-Automation --title "Suggestion: ..." --label enhancement --body "$(cat <<'EOF'
   <body>
   EOF
   )"
   ```

7. **Return** the issue URL to the user.

## Rules

- Repo is always `damgyeah/MCS-Agent-Automation`
- Label is always `enhancement`
- NEVER submit without user confirmation
- Use HEREDOC for the body to preserve formatting
- Keep the title under 70 characters
- If the user's idea is vague, ask ONE follow-up — don't interrogate
