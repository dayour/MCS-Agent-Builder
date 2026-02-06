---
name: mcs-init
description: Initialize a new MCS agent project with folder structure and template files.
---

# MCS Project Initializer

Create a new project folder and detect the intake path.

## Input

Provide project name:
- `/mcs-init ProjectName`

## Process

### Step 1: Create Project Folder

```
Build-Guides/[ProjectName]/
```

### Step 2: Detect Intake Path

Check what's already in the folder:

**Path A: SDR files found (`.docx`, `.md`, `.pdf` files that look like customer docs)**
```
Found SDR files in Build-Guides/[ProjectName]/:
- [list files]

Next step: Run `/mcs-architect ProjectName` to analyze SDR and generate agent-spec.md
```

If `.docx` files exist, convert them to `.md` using pandoc:
```
pandoc "file.docx" -t gfm -o "file.md"
```
Note: pandoc may be at `C:\Users\kimdennis\AppData\Local\Pandoc\pandoc.exe` on this machine.

**Path B: No SDR files, start from scratch**
Copy `templates/agent-spec.md` → Project folder.
Replace `[Agent Name]` with the project name.

### Step 3: Guide User

**If SDR files detected:**
```
## Project Initialized: [ProjectName]

**Location:** Build-Guides/[ProjectName]/

**SDR Files Found:**
- [list of converted .md files]

**Workflow:**
1. Run `/mcs-architect [ProjectName]` → Analyzes SDR, generates agent-spec.md
2. Review agent-spec.md, fill any gaps
3. Run `/mcs-build-agent` or `/mcs-build-specialist` + `/mcs-build-orchestrator`
4. Run `/mcs-eval [ProjectName]` → Generate and upload evals
```

**If starting from scratch:**
```
## Project Initialized: [ProjectName]

**Location:** Build-Guides/[ProjectName]/

**Files Created:**
- agent-spec.md - The build blueprint (fill out or paste requirements)

**Workflow:**
1. Paste SDR/requirements into chat, or fill out agent-spec.md directly
2. Run `/mcs-architect [ProjectName]` to design architecture
3. Run `/mcs-build-agent` or `/mcs-build-specialist` + `/mcs-build-orchestrator`
4. Run `/mcs-eval [ProjectName]` → Generate and upload evals
```

## Output

Creates project folder, detects intake path, and guides user to next step.
