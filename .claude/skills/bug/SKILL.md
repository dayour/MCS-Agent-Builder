---
name: bug
description: Report a bug conversationally — Claude gathers details, previews, and files a GitHub issue via gh CLI.
---

# Bug Report

File a bug report on GitHub without leaving the dashboard.

## Process

1. **Auth check** — run `gh auth status`. If not authenticated, tell the user to run `gh auth login` and stop.

2. **Ask ONE question**:
   > What went wrong? Describe the bug — what happened, what you expected, and any steps to reproduce.

3. **Auto-gather context** Claude already knows:
   - Current project (from Build-Guides/ or conversation)
   - Skill or workflow that failed (if applicable)
   - Environment / account (from session config)
   - Any error messages from the current session

4. **Generate issue**:
   - **Title**: `Bug: <concise summary>` (under 70 chars)
   - **Body** (markdown):
     ```
     ## What happened
     <user's description>

     ## Steps to reproduce
     <extracted from description, or "Not provided">

     ## Expected behavior
     <extracted or inferred>

     ## Environment
     - Account: <if known>
     - Environment: <if known>
     - Skill/workflow: <if applicable>
     ```

5. **Preview** — show the full title + body to the user and ask:
   > Here's the issue I'll create. Want me to submit it, or would you like to change anything?

6. **On confirmation** — run:
   ```
   gh issue create --repo microsoft/CAD-MCS-Builder --title "Bug: ..." --label bug --body "$(cat <<'EOF'
   <body>
   EOF
   )"
   ```

7. **Return** the issue URL to the user.

## Rules

- Repo is always `microsoft/CAD-MCS-Builder`
- Label is always `bug`
- NEVER submit without user confirmation
- Use HEREDOC for the body to preserve formatting
- Keep the title under 70 characters
- If the user's description is vague, ask ONE follow-up — don't interrogate
