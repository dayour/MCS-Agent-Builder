# Elevate Upstream Digest (Read-Only Monitoring)

> **Source**: bap-microsoft/Elevate (Copilot Studio product UX research).
> **Policy**: READ-ONLY. Never auto-merge, rebase, or check out upstream files.
> **Legal**: Review Microsoft IP, license, and attribution policy BEFORE cherry-picking.
> **Safety**: Local `pushURL=DISABLED` + pre-push hook block accidental pushes.
>   These are discipline aids — true enforcement requires server-side org policy.

Newest entries at top. Each section is keyed by upstream commit SHA so re-runs
dedup naturally. Classify each commit as ADOPT / REPLACE / IGNORE after review.

---

## Run 2026-04-27 — 50 new commit(s)

- Tracking tip before: `5c03a29c`
- Upstream tip after:  `a1a2fbc8`
- Commits processed:   50 (capped from 100)
### 05771574 — fix(workflow): restore free-position node drag on canvas

- Author: Tyler Wain · Date: 2026-04-21 14:23:44 -0700
- Files: 1 · Categories: domains(1)
- Overlaps with our repo (1):
  - `src/domains/workflow/components/useWorkflowCanvas.tsx` ↔ `app/frontend/src/domains/workflow/components/useWorkflowCanvas.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 87a88f6f — fix(workflow): canvas interaction improvements and label cleanup

- Author: Tyler Wain · Date: 2026-04-22 11:21:16 -0700
- Files: 7 · Categories: components(1), domains(6)
- Overlaps with our repo (7):
  - `src/components/WorkflowCanvas.tsx` ↔ `app/frontend/src/components/WorkflowCanvas.tsx`
  - `src/domains/workflow/components/WorkflowNodeCard.tsx` ↔ `app/frontend/src/domains/workflow/components/WorkflowNodeCard.tsx`
  - `src/domains/workflow/components/WorkflowNodeDetails.tsx` ↔ `app/frontend/src/domains/workflow/components/WorkflowNodeDetails.tsx`
  - `src/domains/workflow/components/WorkflowOverviewPanel.tsx` ↔ `app/frontend/src/domains/workflow/components/WorkflowOverviewPanel.tsx`
  - `src/domains/workflow/components/WorkflowPalette.tsx` ↔ `app/frontend/src/domains/workflow/components/WorkflowPalette.tsx`
  - `src/domains/workflow/components/useWorkflowCanvas.tsx` ↔ `app/frontend/src/domains/workflow/components/useWorkflowCanvas.tsx`
  - ...and 1 more

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### ec6f9a1f — Merge pull request #770 from bap-microsoft/feature/canvas-interactions

- Author: Nitish Kumar Meena · Date: 2026-04-23 08:56:54 -0700
- Files: 0 · Categories: none

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### a2cfc4c6 — feat(workflow): multistage approval polish and canvas collapse improvements

- Author: Tyler Wain · Date: 2026-04-23 10:29:06 -0700
- Files: 6 · Categories: components(2), domains(4)
- Overlaps with our repo (6):
  - `src/components/WorkflowCanvas.tsx` ↔ `app/frontend/src/components/WorkflowCanvas.tsx`
  - `src/components/ui/SubHeader.tsx` ↔ `app/frontend/src/components/ui/SubHeader.tsx`
  - `src/domains/workflow/components/WorkflowNodeCard.tsx` ↔ `app/frontend/src/domains/workflow/components/WorkflowNodeCard.tsx`
  - `src/domains/workflow/components/WorkflowNodeDetails.tsx` ↔ `app/frontend/src/domains/workflow/components/WorkflowNodeDetails.tsx`
  - `src/domains/workflow/components/WorkflowPalette.tsx` ↔ `app/frontend/src/domains/workflow/components/WorkflowPalette.tsx`
  - `src/domains/workflow/components/workflowConstants.ts` ↔ `app/frontend/src/domains/workflow/components/workflowConstants.ts`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 35b3e141 — Merge pull request #794 from bap-microsoft/feature/multistage-approval-updates

- Author: Nitish Kumar Meena · Date: 2026-04-23 10:37:55 -0700
- Files: 0 · Categories: none

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### a5b7ce99 — fix(eval-hub): add missing useTableExpand hook

- Author: Your Name · Date: 2026-04-23 14:10:05 -0700
- Files: 1 · Categories: hooks(1)
- New paths we do not have (1):
  - `src/hooks/useTableExpand.ts` → would map to `app/frontend/src/hooks/useTableExpand.ts`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### a43336a5 — fix(disambig): add hideToolbar and hideDisclaimer props to CopilotChatInput

- Author: Your Name · Date: 2026-04-23 14:12:11 -0700
- Files: 1 · Categories: components(1)
- Overlaps with our repo (1):
  - `src/components/ui/CopilotChatInput.tsx` ↔ `app/frontend/src/components/ui/CopilotChatInput.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 8d35a732 — fix(eval-hub): add missing TableExpandButton, PageHeader, ArrowFitIcons components

- Author: Your Name · Date: 2026-04-23 14:30:55 -0700
- Files: 3 · Categories: components(3)
- New paths we do not have (3):
  - `src/components/ui/ArrowFitIcons.tsx` → would map to `app/frontend/src/components/ui/ArrowFitIcons.tsx`
  - `src/components/ui/PageHeader.tsx` → would map to `app/frontend/src/components/ui/PageHeader.tsx`
  - `src/components/ui/TableExpandButton.tsx` → would map to `app/frontend/src/components/ui/TableExpandButton.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### a6f6cecd — Revert "fix(eval-hub): add missing TableExpandButton, PageHeader, ArrowFitIcons components"

- Author: Your Name · Date: 2026-04-23 14:34:08 -0700
- Files: 3 · Categories: components(3)
- New paths we do not have (3):
  - `src/components/ui/ArrowFitIcons.tsx` → would map to `app/frontend/src/components/ui/ArrowFitIcons.tsx`
  - `src/components/ui/PageHeader.tsx` → would map to `app/frontend/src/components/ui/PageHeader.tsx`
  - `src/components/ui/TableExpandButton.tsx` → would map to `app/frontend/src/components/ui/TableExpandButton.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 965ce4c2 — fix(eval-hub): add missing TableExpandButton, PageHeader, ArrowFitIcons components

- Author: Your Name · Date: 2026-04-23 14:34:57 -0700
- Files: 3 · Categories: components(3)
- New paths we do not have (3):
  - `src/components/ui/ArrowFitIcons.tsx` → would map to `app/frontend/src/components/ui/ArrowFitIcons.tsx`
  - `src/components/ui/PageHeader.tsx` → would map to `app/frontend/src/components/ui/PageHeader.tsx`
  - `src/components/ui/TableExpandButton.tsx` → would map to `app/frontend/src/components/ui/TableExpandButton.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 487a04e8 — fix(cluster-f): add missing dwCreation util and fix TS errors in ported pages

- Author: Your Name · Date: 2026-04-23 14:37:42 -0700
- Files: 5 · Categories: pages(2), utils(3)
- Overlaps with our repo (2):
  - `src/utils/fileCapabilities.ts` ↔ `app/frontend/src/utils/fileCapabilities.ts`
  - `src/utils/fuzzyCreateAgent.ts` ↔ `app/frontend/src/utils/fuzzyCreateAgent.ts`
- New paths we do not have (3):
  - `src/pages/AltCreatePage.tsx` → would map to `app/frontend/src/pages/AltCreatePage.tsx`
  - `src/pages/CreatePage.tsx` → would map to `app/frontend/src/pages/CreatePage.tsx`
  - `src/utils/dwCreation.ts` → would map to `app/frontend/src/utils/dwCreation.ts`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### cb06f281 — fix(eval-hub): widen tableRef type to RefObject<HTMLDivElement \| null>

- Author: Your Name · Date: 2026-04-23 16:48:13 -0700
- Files: 1 · Categories: hooks(1)
- New paths we do not have (1):
  - `src/hooks/useTableExpand.ts` → would map to `app/frontend/src/hooks/useTableExpand.ts`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 14df4fff — chore(infra): apply Matthew's feedback from Cluster K review

- Author: Your Name · Date: 2026-04-24 10:05:11 -0700
- Files: 2 · Categories: other(2)

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 618f4b79 — fix(ui): export CopilotCard from ui/index.ts

- Author: Your Name · Date: 2026-04-24 10:15:58 -0700
- Files: 1 · Categories: components(1)
- Overlaps with our repo (1):
  - `src/components/ui/index.ts` ↔ `app/frontend/src/components/ui/index.ts`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### c96d87d0 — fix(ui): export PublishDialog from ui/index.ts

- Author: Your Name · Date: 2026-04-24 10:19:28 -0700
- Files: 1 · Categories: components(1)
- Overlaps with our repo (1):
  - `src/components/ui/index.ts` ↔ `app/frontend/src/components/ui/index.ts`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### a2e309ae — fix(preview): replace raw Fluent Button with CopilotButton in PreviewPage

- Author: Your Name · Date: 2026-04-24 10:22:39 -0700
- Files: 1 · Categories: pages(1)
- Overlaps with our repo (1):
  - `src/pages/PreviewPage.tsx` ↔ `app/frontend/src/pages/PreviewPage.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 1419bf3a — Merge pull request #777: [PORT] Cluster K — Infrastructure & Deployment

- Author: Asa Pefferman (HE/HIM) · Date: 2026-04-24 10:38:37 -0700
- Files: 0 · Categories: none

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 11f2ddf0 — Merge pull request #779: [PORT] Cluster A — Eval Hub

- Author: Asa Pefferman (HE/HIM) · Date: 2026-04-24 10:39:15 -0700
- Files: 0 · Categories: none

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 9f7c9246 — chore(deps-dev): bump postcss from 8.5.6 to 8.5.10

- Author: dependabot[bot] · Date: 2026-04-24 17:41:00 +0000
- Files: 2 · Categories: config(2)

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 29f99dea — merge: resolve NavigationRail deps conflict between F and main (A)

- Author: Your Name · Date: 2026-04-24 10:43:06 -0700
- Files: 2 · Categories: components(1), context(1)
- Overlaps with our repo (2):
  - `src/components/nav/NavigationRail.tsx` ↔ `app/frontend/src/components/nav/NavigationRail.tsx`
  - `src/context/FeatureToggleContext.tsx` ↔ `app/frontend/src/context/FeatureToggleContext.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 47c252ef — Merge pull request #783: [PORT] Cluster F — Disambiguation & Create Flows

- Author: Asa Pefferman (HE/HIM) · Date: 2026-04-24 10:49:54 -0700
- Files: 0 · Categories: none

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 05320ff8 — merge: resolve D vs main conflicts in CopilotChatInput + useTableExpand

- Author: Your Name · Date: 2026-04-24 11:00:07 -0700
- Files: 3 · Categories: components(2), other(1)
- Overlaps with our repo (2):
  - `src/components/ui/CopilotChatInput.tsx` ↔ `app/frontend/src/components/ui/CopilotChatInput.tsx`
  - `src/components/ui/SubHeader.tsx` ↔ `app/frontend/src/components/ui/SubHeader.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 485baf52 — fix(ui): remove stray } after toolbar div in CopilotChatInput

- Author: Your Name · Date: 2026-04-24 11:09:47 -0700
- Files: 1 · Categories: components(1)
- Overlaps with our repo (1):
  - `src/components/ui/CopilotChatInput.tsx` ↔ `app/frontend/src/components/ui/CopilotChatInput.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 70ce8dd5 — merge: resolve B vs main (K+A+F) flag conflicts

- Author: Your Name · Date: 2026-04-24 11:24:38 -0700
- Files: 1 · Categories: components(1)
- Overlaps with our repo (1):
  - `src/components/nav/NavigationRail.tsx` ↔ `app/frontend/src/components/nav/NavigationRail.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### b2a51110 — Merge pull request #778 from bap-microsoft/port/cluster-d-ui-components

- Author: Asa Pefferman (HE/HIM) · Date: 2026-04-24 11:41:15 -0700
- Files: 0 · Categories: none

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 02982db3 — merge: pull D's changes into B (Dialog.noScroll, new UI components)

- Author: Your Name · Date: 2026-04-24 11:51:01 -0700
- Files: 0 · Categories: none

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 39b08c84 — merge: resolve E vs D conflict in PublishDialog.tsx

- Author: Your Name · Date: 2026-04-24 12:04:39 -0700
- Files: 1 · Categories: components(1)
- New paths we do not have (1):
  - `src/components/ui/PublishDialog.tsx` → would map to `app/frontend/src/components/ui/PublishDialog.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### d22a6b6d — merge: resolve J vs main (K+A+F+D) flag conflicts in FeatureToggleContext

- Author: Your Name · Date: 2026-04-24 12:06:08 -0700
- Files: 3 · Categories: context(1), domains(2)
- Overlaps with our repo (3):
  - `src/context/FeatureToggleContext.tsx` ↔ `app/frontend/src/context/FeatureToggleContext.tsx`
  - `src/domains/workflow/components/WorkflowOverviewPanel.tsx` ↔ `app/frontend/src/domains/workflow/components/WorkflowOverviewPanel.tsx`
  - `src/domains/workflow/components/WorkflowPalette.tsx` ↔ `app/frontend/src/domains/workflow/components/WorkflowPalette.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 77d6de24 — merge: resolve C vs main (K+A+F+D) conflicts

- Author: Your Name · Date: 2026-04-24 12:07:23 -0700
- Files: 2 · Categories: components(1), context(1)
- Overlaps with our repo (2):
  - `src/components/nav/NavigationRail.tsx` ↔ `app/frontend/src/components/nav/NavigationRail.tsx`
  - `src/context/FeatureToggleContext.tsx` ↔ `app/frontend/src/context/FeatureToggleContext.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 0c0a55fa — Merge pull request #782 from bap-microsoft/port/cluster-b-monitor-v2

- Author: Asa Pefferman (HE/HIM) · Date: 2026-04-24 13:42:48 -0700
- Files: 0 · Categories: none

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### c340ae9a — fix(e): re-export PublishState/NotReadyReason from PublishDialog

- Author: Your Name · Date: 2026-04-24 13:53:33 -0700
- Files: 1 · Categories: components(1)
- New paths we do not have (1):
  - `src/components/ui/PublishDialog.tsx` → would map to `app/frontend/src/components/ui/PublishDialog.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 01700b39 — fix(j): update DAActivityCoTv2 import path for daCoTGenerator

- Author: Your Name · Date: 2026-04-24 13:54:04 -0700
- Files: 1 · Categories: components(1)
- New paths we do not have (1):
  - `src/components/ui/DAActivityCoTv2.tsx` → would map to `app/frontend/src/components/ui/DAActivityCoTv2.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 6257cb66 — fix(c): remove duplicate isActivityCoTv2/activityCoTv2Concept declarations

- Author: Your Name · Date: 2026-04-24 13:55:37 -0700
- Files: 1 · Categories: context(1)
- Overlaps with our repo (1):
  - `src/context/FeatureToggleContext.tsx` ↔ `app/frontend/src/context/FeatureToggleContext.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 9689b985 — merge: resolve C vs main (B) NavigationRail deps conflict

- Author: Your Name · Date: 2026-04-24 13:59:10 -0700
- Files: 1 · Categories: components(1)
- Overlaps with our repo (1):
  - `src/components/nav/NavigationRail.tsx` ↔ `app/frontend/src/components/nav/NavigationRail.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 360664ed — fix(e): split PublishState re-export into import+export so type is available in-file

- Author: Your Name · Date: 2026-04-24 14:01:04 -0700
- Files: 1 · Categories: components(1)
- New paths we do not have (1):
  - `src/components/ui/PublishDialog.tsx` → would map to `app/frontend/src/components/ui/PublishDialog.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### c9755f47 — fix(j): add user_message and agent_response to DANodeType

- Author: Your Name · Date: 2026-04-24 14:01:36 -0700
- Files: 1 · Categories: domains(1)
- Overlaps with our repo (1):
  - `src/domains/agent/utils/daCoTGenerator.ts` ↔ `app/frontend/src/domains/agent/utils/daCoTGenerator.ts`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 1ed7641e — fix(j): add status field to DACoTStep used by DAActivityCoTv2

- Author: Your Name · Date: 2026-04-24 14:10:11 -0700
- Files: 1 · Categories: domains(1)
- Overlaps with our repo (1):
  - `src/domains/agent/utils/daCoTGenerator.ts` ↔ `app/frontend/src/domains/agent/utils/daCoTGenerator.ts`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 038006dc — feat(slake): add Slake Sync feature toggle and integrate into NavigationRail and App components

- Author: Robert Taft · Date: 2026-04-24 14:19:24 -0700
- Files: 4 · Categories: components(1), context(1), other(2)
- Overlaps with our repo (2):
  - `src/components/nav/NavigationRail.tsx` ↔ `app/frontend/src/components/nav/NavigationRail.tsx`
  - `src/context/FeatureToggleContext.tsx` ↔ `app/frontend/src/context/FeatureToggleContext.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 9dc890af — Merge pull request #802 from bap-microsoft/dependabot/npm_and_yarn/postcss-8.5.10

- Author: Robert Taft · Date: 2026-04-24 14:22:40 -0700
- Files: 0 · Categories: none

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 5a013e73 — Merge pull request #792 from bap-microsoft/chore/remove-individual-users

- Author: Robert Taft · Date: 2026-04-24 14:23:29 -0700
- Files: 0 · Categories: none

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 305a99a2 — fix(j): add all missing types to daCoTGenerator for DAActivityCoTv2

- Author: Your Name · Date: 2026-04-24 14:24:02 -0700
- Files: 1 · Categories: domains(1)
- Overlaps with our repo (1):
  - `src/domains/agent/utils/daCoTGenerator.ts` ↔ `app/frontend/src/domains/agent/utils/daCoTGenerator.ts`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 867ceb8e — Merge pull request #769 from bap-microsoft/rename-my-stuff-to-my-work

- Author: Robert Taft · Date: 2026-04-24 14:26:36 -0700
- Files: 2 · Categories: components(1), pages(1)
- Overlaps with our repo (2):
  - `src/components/nav/NavigationRail.tsx` ↔ `app/frontend/src/components/nav/NavigationRail.tsx`
  - `src/pages/MyStuffPage.tsx` ↔ `app/frontend/src/pages/MyStuffPage.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 8ed8333b — feat(slake): initialize isSlakeEnabled flag without default value

- Author: Robert Taft · Date: 2026-04-24 14:27:02 -0700
- Files: 1 · Categories: context(1)
- Overlaps with our repo (1):
  - `src/context/FeatureToggleContext.tsx` ↔ `app/frontend/src/context/FeatureToggleContext.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 7b15b2cf — fix(c): remove merge duplicates and fix daCoTGenerator types

- Author: Your Name · Date: 2026-04-24 14:33:03 -0700
- Files: 4 · Categories: components(2), context(1), domains(1)
- Overlaps with our repo (3):
  - `src/components/nav/NavigationRail.tsx` ↔ `app/frontend/src/components/nav/NavigationRail.tsx`
  - `src/context/FeatureToggleContext.tsx` ↔ `app/frontend/src/context/FeatureToggleContext.tsx`
  - `src/domains/agent/utils/daCoTGenerator.ts` ↔ `app/frontend/src/domains/agent/utils/daCoTGenerator.ts`
- New paths we do not have (1):
  - `src/components/ui/DAActivityCoTv2.tsx` → would map to `app/frontend/src/components/ui/DAActivityCoTv2.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 905425a7 — fix(c): replace ChatInput with CopilotChatInput in PreviewPage

- Author: Your Name · Date: 2026-04-24 14:40:10 -0700
- Files: 1 · Categories: pages(1)
- Overlaps with our repo (1):
  - `src/pages/PreviewPage.tsx` ↔ `app/frontend/src/pages/PreviewPage.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### dc94c5f1 — Merge pull request #806 from bap-microsoft/chores/place-slake-behind-feature-flag

- Author: Asa Pefferman (HE/HIM) · Date: 2026-04-24 14:47:52 -0700
- Files: 1 · Categories: components(1)
- Overlaps with our repo (1):
  - `src/components/nav/NavigationRail.tsx` ↔ `app/frontend/src/components/nav/NavigationRail.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### a3d0af38 — Merge pull request #785 from bap-microsoft/port/cluster-e-port

- Author: Asa Pefferman (HE/HIM) · Date: 2026-04-24 14:48:19 -0700
- Files: 0 · Categories: none

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### a1ed2c20 — Merge pull request #781 from bap-microsoft/port/cluster-j-workflow

- Author: Asa Pefferman (HE/HIM) · Date: 2026-04-24 14:48:27 -0700
- Files: 1 · Categories: context(1)
- Overlaps with our repo (1):
  - `src/context/FeatureToggleContext.tsx` ↔ `app/frontend/src/context/FeatureToggleContext.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 85bd4f31 — merge: resolve C vs main (E+J) conflicts

- Author: Your Name · Date: 2026-04-24 14:51:48 -0700
- Files: 3 · Categories: components(1), context(1), domains(1)
- Overlaps with our repo (3):
  - `src/components/nav/NavigationRail.tsx` ↔ `app/frontend/src/components/nav/NavigationRail.tsx`
  - `src/context/FeatureToggleContext.tsx` ↔ `app/frontend/src/context/FeatureToggleContext.tsx`
  - `src/domains/agent/utils/daCoTGenerator.ts` ↔ `app/frontend/src/domains/agent/utils/daCoTGenerator.ts`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### a1a2fbc8 — Merge pull request #784 from bap-microsoft/port/cluster-c-port

- Author: Asa Pefferman (HE/HIM) · Date: 2026-04-24 15:03:22 -0700
- Files: 0 · Categories: none

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_
## Run 2026-04-23 — 21 new commit(s)

- Tracking tip before: `0dca520a`
- Upstream tip after:  `5c03a29c`
- Commits processed:   21
### f5144b8e — feat(whats-new): implement 'What's New' panel to display AI-generated PR summaries

- Author: asa pefferman · Date: 2026-04-17 11:07:44 -0700
- Files: 6 · Categories: components(3), other(3)
- Overlaps with our repo (2):
  - `src/components/nav/NavFeatureFlagsPanel.tsx` ↔ `app/frontend/src/components/nav/NavFeatureFlagsPanel.tsx`
  - `src/components/nav/NavTypes.ts` ↔ `app/frontend/src/components/nav/NavTypes.ts`
- New paths we do not have (1):
  - `src/components/nav/WhatsNewPanel.tsx` → would map to `app/frontend/src/components/nav/WhatsNewPanel.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### e46c3879 — feat(whats-new): enhance 'What's New' panel with manual refresh functionality and update PR summary format

- Author: asa pefferman · Date: 2026-04-17 12:01:48 -0700
- Files: 2 · Categories: components(1), other(1)
- New paths we do not have (1):
  - `src/components/nav/WhatsNewPanel.tsx` → would map to `app/frontend/src/components/nav/WhatsNewPanel.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### f1a16b01 — feat(whats-new): improve layout of 'What's New' panel with grid structure for day navigation and fetch button

- Author: asa pefferman · Date: 2026-04-17 12:16:19 -0700
- Files: 1 · Categories: components(1)
- New paths we do not have (1):
  - `src/components/nav/WhatsNewPanel.tsx` → would map to `app/frontend/src/components/nav/WhatsNewPanel.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 308906ee — fix(workflow): icon and label cleanup for trigger picker and right panel

- Author: Tyler Wain · Date: 2026-04-20 11:14:31 -0700
- Files: 3 · Categories: components(1), domains(2)
- Overlaps with our repo (3):
  - `src/components/WorkflowCanvas.tsx` ↔ `app/frontend/src/components/WorkflowCanvas.tsx`
  - `src/domains/workflow/components/WorkflowNodeCard.tsx` ↔ `app/frontend/src/domains/workflow/components/WorkflowNodeCard.tsx`
  - `src/domains/workflow/components/workflowConstants.ts` ↔ `app/frontend/src/domains/workflow/components/workflowConstants.ts`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### d147c170 — feat(workflow): clicking empty canvas deselects active node

- Author: Tyler Wain · Date: 2026-04-20 11:16:28 -0700
- Files: 2 · Categories: components(1), domains(1)
- Overlaps with our repo (2):
  - `src/components/WorkflowCanvas.tsx` ↔ `app/frontend/src/components/WorkflowCanvas.tsx`
  - `src/domains/workflow/components/useWorkflowCanvas.tsx` ↔ `app/frontend/src/domains/workflow/components/useWorkflowCanvas.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### e2b82ca0 — chore(deploy): support dual Azure App Service targets per release

- Author: Matthew LeHew · Date: 2026-04-20 16:16:40 -0400
- Files: 2 · Categories: other(2)

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### babcd5a3 — chore(deploy): restrict FORCE_HAIKU to the Anthropic target

- Author: Matthew LeHew · Date: 2026-04-20 16:37:47 -0400
- Files: 2 · Categories: other(2)

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 5e2a0830 — feat(workflow): Variable step — full implementation

- Author: Tyler Wain · Date: 2026-04-20 13:38:08 -0700
- Files: 5 · Categories: components(1), domains(4)
- Overlaps with our repo (5):
  - `src/components/WorkflowCanvas.tsx` ↔ `app/frontend/src/components/WorkflowCanvas.tsx`
  - `src/domains/workflow/components/WorkflowNodeCard.tsx` ↔ `app/frontend/src/domains/workflow/components/WorkflowNodeCard.tsx`
  - `src/domains/workflow/components/WorkflowNodeDetails.tsx` ↔ `app/frontend/src/domains/workflow/components/WorkflowNodeDetails.tsx`
  - `src/domains/workflow/components/useWorkflowCanvas.tsx` ↔ `app/frontend/src/domains/workflow/components/useWorkflowCanvas.tsx`
  - `src/domains/workflow/components/workflowConstants.ts` ↔ `app/frontend/src/domains/workflow/components/workflowConstants.ts`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 98fa15f9 — chore(deploy): drop instance auto-prefix and clean temp files on failure

- Author: Matthew LeHew · Date: 2026-04-20 16:59:15 -0400
- Files: 1 · Categories: other(1)

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### e246fc13 — fix(workflow): address code review issues in Variable step

- Author: Tyler Wain · Date: 2026-04-20 13:59:23 -0700
- Files: 1 · Categories: domains(1)
- Overlaps with our repo (1):
  - `src/domains/workflow/components/WorkflowNodeDetails.tsx` ↔ `app/frontend/src/domains/workflow/components/WorkflowNodeDetails.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### d6834252 — feat(workflow): surface inline buttons in Variable empty state

- Author: Tyler Wain · Date: 2026-04-20 14:01:04 -0700
- Files: 1 · Categories: domains(1)
- Overlaps with our repo (1):
  - `src/domains/workflow/components/WorkflowNodeDetails.tsx` ↔ `app/frontend/src/domains/workflow/components/WorkflowNodeDetails.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 30920d52 — Merge pull request #747 from bap-microsoft/feature/node-alignment

- Author: Nitish Kumar Meena · Date: 2026-04-20 18:13:51 -0700
- Files: 0 · Categories: none

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 241cb554 — Add derahonuorah as contributor to access list (#751)

- Author: Jared Lambert · Date: 2026-04-21 07:11:18 -0700
- Files: 18 · Categories: other(18)

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 96c5ba3f — Merge pull request #737 from bap-microsoft/whats-new-system

- Author: Robert Taft · Date: 2026-04-21 09:09:54 -0700
- Files: 0 · Categories: none

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 1291e716 — chore(workflow): remove unused ALL_STEPS import from WorkflowNodeDetails (#746)

- Author: Robert Taft · Date: 2026-04-21 11:01:16 -0700
- Files: 1 · Categories: domains(1)
- Overlaps with our repo (1):
  - `src/domains/workflow/components/WorkflowNodeDetails.tsx` ↔ `app/frontend/src/domains/workflow/components/WorkflowNodeDetails.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 5b8aef23 — feat(audit): add token violations auditing script and output report (#754)

- Author: Robert Taft · Date: 2026-04-21 11:29:02 -0700
- Files: 3 · Categories: config(1), other(2)

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### bf6a5c8d — fix(workflow): Human Review modal consistency

- Author: Tyler Wain · Date: 2026-04-21 12:03:19 -0700
- Files: 4 · Categories: components(1), domains(3)
- Overlaps with our repo (4):
  - `src/components/WorkflowCanvas.tsx` ↔ `app/frontend/src/components/WorkflowCanvas.tsx`
  - `src/domains/workflow/components/WorkflowPalette.tsx` ↔ `app/frontend/src/domains/workflow/components/WorkflowPalette.tsx`
  - `src/domains/workflow/components/useWorkflowCanvas.tsx` ↔ `app/frontend/src/domains/workflow/components/useWorkflowCanvas.tsx`
  - `src/domains/workflow/components/workflowConstants.ts` ↔ `app/frontend/src/domains/workflow/components/workflowConstants.ts`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 78645120 — Merge pull request #748 from bap-microsoft/chore/dual-target-deploy-main

- Author: Matthew LeHew · Date: 2026-04-21 17:39:23 -0400
- Files: 0 · Categories: none

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 7724db56 — Enhance token auditing with improved detection and reporting (#761)

- Author: Robert Taft · Date: 2026-04-21 15:31:18 -0700
- Files: 4 · Categories: config(2), other(2)

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 65146369 — Merge pull request #756 from bap-microsoft/feature/human-review-fixes

- Author: Nitish Kumar Meena · Date: 2026-04-21 22:39:04 -0700
- Files: 0 · Categories: none

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 5c03a29c — feat(pr): update open-pr command to include screenshot capture instructions (#774)

- Author: Robert Taft · Date: 2026-04-22 14:28:24 -0700
- Files: 2 · Categories: other(2)

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

<!-- Prune note 2026-05-04: removed 3 unclassified runs (2026-04-18, 2026-04-16 ×2 with duplicate header) — 1098 lines, 0 entries classified, all >14 days stale per learnings-system.md. -->


## Run 2026-05-04 — 50 new commit(s)

- Tracking tip before: `a1a2fbc8`
- Upstream tip after:  `9d55460f`
- Commits processed:   50 (capped from 342)
### 8fe9dab8 — docs: update no-unused-vars verification to use npm run lint

- Author: Robert Taft · Date: 2026-04-30 12:34:35 -0700
- Files: 2 · Categories: other(2)

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 798c8bf8 — docs: refine explanations in react-hooks-deps.md and update ESLint configuration comments

- Author: Robert Taft · Date: 2026-04-30 13:20:06 -0700
- Files: 2 · Categories: other(2)

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 2b9df773 — docs: update button component usage guidelines in CLAUDE.md

- Author: Robert Taft · Date: 2026-04-30 14:54:04 -0700
- Files: 1 · Categories: other(1)

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### dbee4552 — docs: clarify permissions for actions in PR validation workflow

- Author: Robert Taft · Date: 2026-04-30 14:55:17 -0700
- Files: 1 · Categories: other(1)

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 0cca4ae8 — docs: add reference to no-fake-anchors rule in Copilot instructions

- Author: Robert Taft · Date: 2026-04-30 14:56:05 -0700
- Files: 1 · Categories: other(1)

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 2a889400 — ci: add linting step to CI workflow

- Author: Robert Taft · Date: 2026-04-30 14:56:54 -0700
- Files: 1 · Categories: other(1)

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 77e0283b — docs: update linting documentation and configuration for ESLint rules

- Author: Robert Taft · Date: 2026-04-30 15:15:18 -0700
- Files: 4 · Categories: config(1), other(3)

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 38c116ea — docs: update no-unused-vars rule description and add eslintignore file

- Author: Robert Taft · Date: 2026-04-30 15:16:42 -0700
- Files: 3 · Categories: other(3)

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### b307b9ae — fix(lint): resolve import/first and jsx-no-undef errors in monitor

- Author: Robert Taft · Date: 2026-04-30 17:32:53 -0700
- Files: 2 · Categories: pages(2)
- Overlaps with our repo (2):
  - `src/pages/monitor/MonitorApp.tsx` ↔ `app/frontend/src/pages/monitor/MonitorApp.tsx`
  - `src/pages/monitor/components/AutonomousAgentPage.tsx` ↔ `app/frontend/src/pages/monitor/components/AutonomousAgentPage.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### affec3ba — docs: consolidate react-hooks-deps notes and add stable-values rule to CLAUDE.md

- Author: copilot-swe-agent[bot] · Date: 2026-04-30 22:22:20 +0000
- Files: 2 · Categories: other(2)

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### ad97f004 — Merge branch 'chore/eslint-infrastructure' of https://github.com/bap-microsoft/Elevate into chore/eslint-infrastructure

- Author: Robert Taft · Date: 2026-05-01 08:36:29 -0700
- Files: 0 · Categories: none

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 44863927 — refactor: remove unnecessary global declaration in MonitorApp

- Author: Robert Taft · Date: 2026-05-01 08:37:10 -0700
- Files: 1 · Categories: pages(1)
- Overlaps with our repo (1):
  - `src/pages/monitor/MonitorApp.tsx` ↔ `app/frontend/src/pages/monitor/MonitorApp.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### b59cc8f6 — Merge remote-tracking branch 'origin/main' into feat/version-history-v2

- Author: copilot-swe-agent[bot] · Date: 2026-05-01 15:37:39 +0000
- Files: 5 · Categories: components(2), pages(1), domains(2)
- Overlaps with our repo (5):
  - `src/components/Layout.tsx` ↔ `app/frontend/src/components/Layout.tsx`
  - `src/components/WorkflowCanvas.tsx` ↔ `app/frontend/src/components/WorkflowCanvas.tsx`
  - `src/domains/workflow/components/WorkflowNodeCard.tsx` ↔ `app/frontend/src/domains/workflow/components/WorkflowNodeCard.tsx`
  - `src/domains/workflow/components/WorkflowOverviewPanel.tsx` ↔ `app/frontend/src/domains/workflow/components/WorkflowOverviewPanel.tsx`
  - `src/pages/ComponentShowcaseWeb.tsx` ↔ `app/frontend/src/pages/ComponentShowcaseWeb.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### e11a8108 — chore: update .gitignore to include lint error logs and modify CLAUDE.md for lint error clarification

- Author: Robert Taft · Date: 2026-05-01 08:43:26 -0700
- Files: 2 · Categories: other(2)

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 488f4536 — refactor: rename destructured variables for clarity and update import paths in WorkflowSharePanel

- Author: Robert Taft · Date: 2026-05-01 08:52:06 -0700
- Files: 3 · Categories: components(1), domains(2)
- Overlaps with our repo (2):
  - `src/components/Layout.tsx` ↔ `app/frontend/src/components/Layout.tsx`
  - `src/domains/workflow/components/WorkflowOverviewPanel.tsx` ↔ `app/frontend/src/domains/workflow/components/WorkflowOverviewPanel.tsx`
- New paths we do not have (1):
  - `src/domains/workflow/components/WorkflowSharePanel.tsx` → would map to `app/frontend/src/domains/workflow/components/WorkflowSharePanel.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 77e27ab2 — chore(flags): remove dead isWorkflowTestingV2, document isAiTeammateHomePage (#839)

- Author: Asa Pefferman (HE/HIM) · Date: 2026-05-01 09:13:10 -0700
- Files: 3 · Categories: context(1), domains(1), other(1)
- Overlaps with our repo (2):
  - `src/context/FeatureToggleContext.tsx` ↔ `app/frontend/src/context/FeatureToggleContext.tsx`
  - `src/domains/workflow/components/useWorkflowCanvas.tsx` ↔ `app/frontend/src/domains/workflow/components/useWorkflowCanvas.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### d6ac27b9 — Merge pull request #856 from bap-microsoft/chore/eslint-infrastructure

- Author: Robert Taft · Date: 2026-05-01 09:14:34 -0700
- Files: 0 · Categories: none

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### dc156a90 — Merge pull request #870 from bap-microsoft/feat/version-history-v2

- Author: Robert Taft · Date: 2026-05-01 09:16:49 -0700
- Files: 2 · Categories: components(1), domains(1)
- Overlaps with our repo (2):
  - `src/components/Layout.tsx` ↔ `app/frontend/src/components/Layout.tsx`
  - `src/domains/workflow/components/WorkflowOverviewPanel.tsx` ↔ `app/frontend/src/domains/workflow/components/WorkflowOverviewPanel.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 0bdca8ad — fix(ha): open helper agent by default on workflow creation (#873)

- Author: Mark Wheeler · Date: 2026-05-01 09:37:11 -0700
- Files: 2 · Categories: components(1), context(1)
- Overlaps with our repo (2):
  - `src/components/Layout.tsx` ↔ `app/frontend/src/components/Layout.tsx`
  - `src/context/AgentContext.tsx` ↔ `app/frontend/src/context/AgentContext.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 20512c0b — refactor(audience): remove personal agent option and feature flag (#878)

- Author: Mark Wheeler · Date: 2026-05-01 11:03:39 -0700
- Files: 12 · Categories: components(3), pages(3), hooks(2), context(2), utils(1), other(1)
- Overlaps with our repo (11):
  - `src/components/HelperAgent.tsx` ↔ `app/frontend/src/components/HelperAgent.tsx`
  - `src/components/SnapshotToggleDialog.tsx` ↔ `app/frontend/src/components/SnapshotToggleDialog.tsx`
  - `src/components/nav/NavigationRail.tsx` ↔ `app/frontend/src/components/nav/NavigationRail.tsx`
  - `src/context/AgentContext.tsx` ↔ `app/frontend/src/context/AgentContext.tsx`
  - `src/context/FeatureToggleContext.tsx` ↔ `app/frontend/src/context/FeatureToggleContext.tsx`
  - `src/hooks/useHomeCreateFlow.ts` ↔ `app/frontend/src/hooks/useHomeCreateFlow.ts`
  - ...and 5 more

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 09a6da18 — Merge pull request #859 from bap-microsoft/feat/skills-markdown-edit

- Author: Matthew Lawson · Date: 2026-05-01 14:12:44 -0400
- Files: 0 · Categories: none

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 3426ac26 — chore: add ESLint configuration and tasks for linting (#877)

- Author: Robert Taft · Date: 2026-05-01 14:00:54 -0700
- Files: 19 · Categories: components(2), pages(2), context(1), domains(2), other(12)
- Overlaps with our repo (7):
  - `src/components/Layout.tsx` ↔ `app/frontend/src/components/Layout.tsx`
  - `src/components/nav/NavigationRail.tsx` ↔ `app/frontend/src/components/nav/NavigationRail.tsx`
  - `src/context/FeatureToggleContext.tsx` ↔ `app/frontend/src/context/FeatureToggleContext.tsx`
  - `src/domains/agent/pages/AgentBuildPage.tsx` ↔ `app/frontend/src/domains/agent/pages/AgentBuildPage.tsx`
  - `src/domains/workflow/components/WorkflowOverviewPanel.tsx` ↔ `app/frontend/src/domains/workflow/components/WorkflowOverviewPanel.tsx`
  - `src/pages/HomeLandingView.tsx` ↔ `app/frontend/src/pages/HomeLandingView.tsx`
  - ...and 1 more

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### daeecb98 — feat(knowledge): separate Attachments and Websites tabs (#880)

- Author: Mike Faudel · Date: 2026-05-01 17:23:51 -0400
- Files: 9 · Categories: components(1), pages(2), hooks(2), context(1), domains(2), other(1)
- Overlaps with our repo (8):
  - `src/components/shared/InstructionsEditor.tsx` ↔ `app/frontend/src/components/shared/InstructionsEditor.tsx`
  - `src/context/AgentContext.tsx` ↔ `app/frontend/src/context/AgentContext.tsx`
  - `src/domains/agent/components/ComponentsPanel.tsx` ↔ `app/frontend/src/domains/agent/components/ComponentsPanel.tsx`
  - `src/domains/agent/pages/AgentBuildPage.tsx` ↔ `app/frontend/src/domains/agent/pages/AgentBuildPage.tsx`
  - `src/hooks/useComponentsPanel.ts` ↔ `app/frontend/src/hooks/useComponentsPanel.ts`
  - `src/hooks/useHomeCreateFlow.ts` ↔ `app/frontend/src/hooks/useHomeCreateFlow.ts`
  - ...and 2 more

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 5a5f86f2 — refactor(publish): modular per-agent-type publish architecture (#867)

- Author: Christian Sadak · Date: 2026-05-01 15:49:29 -0700
- Files: 21 · Categories: components(5), hooks(1), context(2), utils(1), other(12)
- Overlaps with our repo (8):
  - `src/components/HelperAgent.tsx` ↔ `app/frontend/src/components/HelperAgent.tsx`
  - `src/components/Layout.tsx` ↔ `app/frontend/src/components/Layout.tsx`
  - `src/components/SnapshotToggleDialog.tsx` ↔ `app/frontend/src/components/SnapshotToggleDialog.tsx`
  - `src/components/nav/NavigationRail.tsx` ↔ `app/frontend/src/components/nav/NavigationRail.tsx`
  - `src/context/AgentContext.tsx` ↔ `app/frontend/src/context/AgentContext.tsx`
  - `src/context/FeatureToggleContext.tsx` ↔ `app/frontend/src/context/FeatureToggleContext.tsx`
  - ...and 2 more
- New paths we do not have (1):
  - `src/components/ui/PublishDialog.tsx` → would map to `app/frontend/src/components/ui/PublishDialog.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### abf695b2 — fix(ci): run checks on draft PRs; fix draft-guard FORBIDDEN crash (#882)

- Author: Asa Pefferman (HE/HIM) · Date: 2026-05-01 15:53:12 -0700
- Files: 4 · Categories: other(4)

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### f1ed1ac1 — Chore/dedupe utilities (#883)

- Author: Robert Taft · Date: 2026-05-01 15:59:53 -0700
- Files: 41 · Categories: components(8), pages(3), hooks(3), utils(12), domains(10), other(5)
- Overlaps with our repo (29):
  - `src/components/HelperAgent.tsx` ↔ `app/frontend/src/components/HelperAgent.tsx`
  - `src/components/nav/NavFeatureFlagsPanel.tsx` ↔ `app/frontend/src/components/nav/NavFeatureFlagsPanel.tsx`
  - `src/components/publish/postPublish/PostPublishCopyFields.tsx` ↔ `app/frontend/src/components/publish/postPublish/PostPublishCopyFields.tsx`
  - `src/components/ui/DAActivityCoT.tsx` ↔ `app/frontend/src/components/ui/DAActivityCoT.tsx`
  - `src/components/ui/InstructionPill.tsx` ↔ `app/frontend/src/components/ui/InstructionPill.tsx`
  - `src/components/ui/PublishSuccessDialog.tsx` ↔ `app/frontend/src/components/ui/PublishSuccessDialog.tsx`
  - ...and 23 more
- New paths we do not have (7):
  - `src/components/AiTeammateHomePage.tsx` → would map to `app/frontend/src/components/AiTeammateHomePage.tsx`
  - `src/domains/dw/components/DWSettingsDialog.tsx` → would map to `app/frontend/src/domains/dw/components/DWSettingsDialog.tsx`
  - `src/domains/workflow/components/WorkflowShareModal.tsx` → would map to `app/frontend/src/domains/workflow/components/WorkflowShareModal.tsx`
  - `src/utils/__tests__/jsonParsing.test.ts` → would map to `app/frontend/src/utils/__tests__/jsonParsing.test.ts`
  - `src/utils/clipboard.ts` → would map to `app/frontend/src/utils/clipboard.ts`
  - `src/utils/dwCreation.ts` → would map to `app/frontend/src/utils/dwCreation.ts`
  - ...and 1 more

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 3ceba303 — feat(workiq): port BUILD26-WORKIQ-feedback UX improvements to main (#860)

- Author: Izzy Quesada · Date: 2026-05-01 16:00:48 -0700
- Files: 13 · Categories: components(3), pages(1), utils(1), domains(5), other(3)
- Overlaps with our repo (9):
  - `src/components/build/index.ts` ↔ `app/frontend/src/components/build/index.ts`
  - `src/components/ui/CopilotToggle.tsx` ↔ `app/frontend/src/components/ui/CopilotToggle.tsx`
  - `src/components/ui/WorkIQCard.tsx` ↔ `app/frontend/src/components/ui/WorkIQCard.tsx`
  - `src/domains/agent/components/ComponentsPanel.tsx` ↔ `app/frontend/src/domains/agent/components/ComponentsPanel.tsx`
  - `src/domains/agent/components/McpDetailPanel.tsx` ↔ `app/frontend/src/domains/agent/components/McpDetailPanel.tsx`
  - `src/domains/agent/components/WorkIQDetailPanel.tsx` ↔ `app/frontend/src/domains/agent/components/WorkIQDetailPanel.tsx`
  - ...and 3 more
- New paths we do not have (1):
  - `src/domains/agent/components/CCDetailPanel.tsx` → would map to `app/frontend/src/domains/agent/components/CCDetailPanel.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### e3db4667 — feat(dexter): add blueprint provisioning admin controls + align model/provider defaults (#818)

- Author: Jared Lambert · Date: 2026-05-01 16:01:58 -0700
- Files: 5 · Categories: domains(5)
- Overlaps with our repo (5):
  - `src/domains/dw/pages/dexter/CreateWorkerDialog.tsx` ↔ `app/frontend/src/domains/dw/pages/dexter/CreateWorkerDialog.tsx`
  - `src/domains/dw/pages/dexter/DexterMachinesPage.tsx` ↔ `app/frontend/src/domains/dw/pages/dexter/DexterMachinesPage.tsx`
  - `src/domains/dw/pages/dexter/DexterWorkerOverviewTab.tsx` ↔ `app/frontend/src/domains/dw/pages/dexter/DexterWorkerOverviewTab.tsx`
  - `src/domains/dw/pages/dexter/dexterUtils.ts` ↔ `app/frontend/src/domains/dw/pages/dexter/dexterUtils.ts`
  - `src/domains/dw/services/dexterWorkerService.ts` ↔ `app/frontend/src/domains/dw/services/dexterWorkerService.ts`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### f332844b — feat(instructions): add formatting toolbar behind Instructions Formatting feature flag

- Author: Shiva Neiman Firoozi · Date: 2026-05-01 16:03:09 -0700
- Files: 6 · Categories: components(3), context(2), domains(1)
- Overlaps with our repo (5):
  - `src/components/build/index.ts` ↔ `app/frontend/src/components/build/index.ts`
  - `src/components/nav/NavigationRail.tsx` ↔ `app/frontend/src/components/nav/NavigationRail.tsx`
  - `src/context/AgentContext.tsx` ↔ `app/frontend/src/context/AgentContext.tsx`
  - `src/context/FeatureToggleContext.tsx` ↔ `app/frontend/src/context/FeatureToggleContext.tsx`
  - `src/domains/agent/pages/AgentBuildPage.tsx` ↔ `app/frontend/src/domains/agent/pages/AgentBuildPage.tsx`
- New paths we do not have (1):
  - `src/components/build/InstructionsFormattingBar.tsx` → would map to `app/frontend/src/components/build/InstructionsFormattingBar.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### be5c0854 — fix(instructions): fix JSX closing tag in dropdown, default formatting flag to on

- Author: Shiva Neiman Firoozi · Date: 2026-05-01 16:06:01 -0700
- Files: 2 · Categories: components(1), context(1)
- Overlaps with our repo (1):
  - `src/context/FeatureToggleContext.tsx` ↔ `app/frontend/src/context/FeatureToggleContext.tsx`
- New paths we do not have (1):
  - `src/components/build/InstructionsFormattingBar.tsx` → would map to `app/frontend/src/components/build/InstructionsFormattingBar.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 74338f5e — fix(instructions): move formatting buttons into header row next to expand button

- Author: Shiva Neiman Firoozi · Date: 2026-05-01 16:14:40 -0700
- Files: 3 · Categories: components(2), domains(1)
- Overlaps with our repo (2):
  - `src/components/shared/InstructionsEditor.tsx` ↔ `app/frontend/src/components/shared/InstructionsEditor.tsx`
  - `src/domains/agent/pages/AgentBuildPage.tsx` ↔ `app/frontend/src/domains/agent/pages/AgentBuildPage.tsx`
- New paths we do not have (1):
  - `src/components/build/InstructionsFormattingBar.tsx` → would map to `app/frontend/src/components/build/InstructionsFormattingBar.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 6579b27c — refactor: implement stripCodeFences utility for cleaner JSON parsing (#881)

- Author: Robert Taft · Date: 2026-05-01 16:18:54 -0700
- Files: 2 · Categories: utils(2)
- Overlaps with our repo (2):
  - `src/utils/previewPromptGenerator.ts` ↔ `app/frontend/src/utils/previewPromptGenerator.ts`
  - `src/utils/workflowGeneration.ts` ↔ `app/frontend/src/utils/workflowGeneration.ts`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 2c772ba3 — feat(instructions): update formatting bar — icon+chevron trigger, reorder buttons, redesign dropdown

- Author: Shiva Neiman Firoozi · Date: 2026-05-01 16:28:39 -0700
- Files: 1 · Categories: components(1)
- New paths we do not have (1):
  - `src/components/build/InstructionsFormattingBar.tsx` → would map to `app/frontend/src/components/build/InstructionsFormattingBar.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 1c40b5a3 — chore: merge origin/main — resolve conflicts, add CCDetailPanel import

- Author: Shiva Neiman Firoozi · Date: 2026-05-01 16:30:44 -0700
- Files: 5 · Categories: components(2), context(2), domains(1)
- Overlaps with our repo (5):
  - `src/components/build/index.ts` ↔ `app/frontend/src/components/build/index.ts`
  - `src/components/nav/NavigationRail.tsx` ↔ `app/frontend/src/components/nav/NavigationRail.tsx`
  - `src/context/AgentContext.tsx` ↔ `app/frontend/src/context/AgentContext.tsx`
  - `src/context/FeatureToggleContext.tsx` ↔ `app/frontend/src/context/FeatureToggleContext.tsx`
  - `src/domains/agent/pages/AgentBuildPage.tsx` ↔ `app/frontend/src/domains/agent/pages/AgentBuildPage.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 03f1ef5c — fix(instructions): replace execCommand lists with manual DOM toggle, fix selection restore, Fluent heading styles

- Author: Shiva Neiman Firoozi · Date: 2026-05-01 16:49:00 -0700
- Files: 1 · Categories: components(1)
- New paths we do not have (1):
  - `src/components/build/InstructionsFormattingBar.tsx` → would map to `app/frontend/src/components/build/InstructionsFormattingBar.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### dbdfc476 — fix(feature-toggle): update initialization of isInstructionsFormatting flag

- Author: Robert Taft · Date: 2026-05-04 09:14:41 -0700
- Files: 1 · Categories: context(1)
- Overlaps with our repo (1):
  - `src/context/FeatureToggleContext.tsx` ↔ `app/frontend/src/context/FeatureToggleContext.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 5764e86a — feat(instructions): add Instructions Formatting toggle to feature list

- Author: Robert Taft · Date: 2026-05-04 09:15:33 -0700
- Files: 1 · Categories: other(1)

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 90f8eb2c — fix(instructions): update keyboard shortcut handling for block formatting

- Author: Robert Taft · Date: 2026-05-04 09:16:21 -0700
- Files: 1 · Categories: components(1)
- New paths we do not have (1):
  - `src/components/build/InstructionsFormattingBar.tsx` → would map to `app/frontend/src/components/build/InstructionsFormattingBar.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### ef3a5243 — fix(instructions): correct heading styles and update type ramp in InstructionsFormattingBar

- Author: Robert Taft · Date: 2026-05-04 09:23:10 -0700
- Files: 2 · Categories: components(1), domains(1)
- Overlaps with our repo (1):
  - `src/domains/agent/pages/AgentBuildPage.tsx` ↔ `app/frontend/src/domains/agent/pages/AgentBuildPage.tsx`
- New paths we do not have (1):
  - `src/components/build/InstructionsFormattingBar.tsx` → would map to `app/frontend/src/components/build/InstructionsFormattingBar.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 899d94ac — fix(instructions): add allowHeadingSizes prop to MainContentEditable for dynamic heading styles

- Author: Robert Taft · Date: 2026-05-04 09:29:39 -0700
- Files: 1 · Categories: components(1)
- Overlaps with our repo (1):
  - `src/components/shared/InstructionsEditor.tsx` ↔ `app/frontend/src/components/shared/InstructionsEditor.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 29bd575a — fix(instructions): standardize label casing for Instructions Formatting

- Author: Robert Taft · Date: 2026-05-04 09:53:44 -0700
- Files: 2 · Categories: components(2)
- Overlaps with our repo (1):
  - `src/components/nav/NavigationRail.tsx` ↔ `app/frontend/src/components/nav/NavigationRail.tsx`
- New paths we do not have (1):
  - `src/components/build/InstructionsFormattingBar.tsx` → would map to `app/frontend/src/components/build/InstructionsFormattingBar.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 7b6fda55 — Merge pull request #885 from bap-microsoft/pr/Instructions-Formatting

- Author: Robert Taft · Date: 2026-05-04 09:58:02 -0700
- Files: 0 · Categories: none

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### a700f7f9 — Merge branch 'main' into fix/copilot-model-ids

- Author: Robert Taft · Date: 2026-05-04 10:19:30 -0700
- Files: 1 · Categories: config(1)
- Overlaps with our repo (1):
  - `src/config/endpointConfig.ts` ↔ `app/frontend/src/config/endpointConfig.ts`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 1c5ed0b9 — feat: enhance copilot model ID validation and migration logic

- Author: Robert Taft · Date: 2026-05-04 10:27:45 -0700
- Files: 2 · Categories: context(1), other(1)
- Overlaps with our repo (1):
  - `src/context/FeatureToggleContext.tsx` ↔ `app/frontend/src/context/FeatureToggleContext.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 65db513b — Merge pull request #701 from bap-microsoft/fix/copilot-model-ids

- Author: Robert Taft · Date: 2026-05-04 10:30:41 -0700
- Files: 1 · Categories: context(1)
- Overlaps with our repo (1):
  - `src/context/FeatureToggleContext.tsx` ↔ `app/frontend/src/context/FeatureToggleContext.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### e4013df5 — feat(home): replace fuzzy card images with crisp Agent, Copilot, Flow PNGs (#884)

- Author: Shiva Neiman · Date: 2026-05-04 10:37:09 -0700
- Files: 4 · Categories: pages(1), other(3)
- Overlaps with our repo (1):
  - `src/pages/HomeLandingView.tsx` ↔ `app/frontend/src/pages/HomeLandingView.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 1525eb82 — Merge branch 'main' into docs/component-sync-workflow

- Author: Robert Taft · Date: 2026-05-04 10:38:48 -0700
- Files: 0 · Categories: none

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### dbcf1d1f — fix: correct link reference to component sync workflow in documentation

- Author: Robert Taft · Date: 2026-05-04 10:40:51 -0700
- Files: 1 · Categories: other(1)

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 7fccb57d — Merge pull request #659 from bap-microsoft/docs/component-sync-workflow

- Author: Robert Taft · Date: 2026-05-04 10:43:58 -0700
- Files: 0 · Categories: none

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_

### 9d55460f — fix(header): restore BUILD26 agent header parity on main (#874)

- Author: Asa Pefferman (HE/HIM) · Date: 2026-05-04 10:48:13 -0700
- Files: 8 · Categories: components(4), pages(2), other(2)
- Overlaps with our repo (5):
  - `src/components/Layout.tsx` ↔ `app/frontend/src/components/Layout.tsx`
  - `src/components/nav/NavAccountRow.tsx` ↔ `app/frontend/src/components/nav/NavAccountRow.tsx`
  - `src/components/nav/NavigationRail.tsx` ↔ `app/frontend/src/components/nav/NavigationRail.tsx`
  - `src/pages/HomePage.tsx` ↔ `app/frontend/src/pages/HomePage.tsx`
  - `src/pages/MyStuffPage.tsx` ↔ `app/frontend/src/pages/MyStuffPage.tsx`
- New paths we do not have (1):
  - `src/components/nav/WhatsNewDialog.tsx` → would map to `app/frontend/src/components/nav/WhatsNewDialog.tsx`

- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_
