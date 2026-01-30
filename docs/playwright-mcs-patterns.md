# Playwright MCP Patterns for Microsoft Copilot Studio

## Overview

This guide documents strategies, tricks, and hacks for reliable automation of Microsoft Copilot Studio (MCS) using Playwright MCP. MCS has a dynamic UI that can make element refs unstable - these patterns help work around that.

---

## ⚠️ CRITICAL: Always Verify Environment First

**Before ANY operation in Copilot Studio, ALWAYS verify you are in the correct environment.**

MCS sessions can persist in wrong environments, and working in the wrong environment will create/modify resources in the wrong place.

### Environment Verification Pattern

```
1. Navigate to copilotstudio.microsoft.com
2. Wait for page to load
3. Take snapshot
4. CHECK the environment name in the header (button showing "Environment: [name]")
5. If wrong environment:
   - Click the environment selector button
   - Select the correct environment from the list
   - Wait for page to reload
   - Snapshot again to confirm
6. Only then proceed with operations
```

### Environment Selector Location

The environment is shown in the top header bar as a button like:
```
Environment
[Environment Name]
```

Click this button to see all available environments and switch.

### Common Environments

| Environment | Purpose |
|-------------|---------|
| Onboarding Environment | Production/demo environment for Onboarding Agent |
| Test_Test_TOL_Test | Test environment |
| [Name] (default) | Default environment for the tenant |

**NEVER assume you're in the correct environment - always verify!**

---

## Strategy 1: Use Code/YAML Views Instead of UI Clicks

### Topics - YAML Code Editor

**Instead of clicking through the visual topic editor, use the code editor:**

1. Navigate to any topic
2. Click **"..." More** on the toolbar
3. Select **"Open code editor"**
4. Read/write YAML directly

**Benefits:**
- Complete topic configuration in one view
- Copy/paste nodes between topics
- Easier to update Power Automate flow IDs
- Clone and modify Question/Message nodes
- Faster than clicking through UI nodes

**YAML Structure Example:**
```yaml
kind: AdaptiveDialog
beginDialog:
  kind: OnUnknownIntent
  id: main
  priority: -1
  actions:
    - kind: SearchAndSummarizeContent
      id: search-content
      userInput: =System.Activity.Text
      variable: Topic.Answer
      moderationLevel: Medium
      additionalInstructions: Your instructions here
      publicDataSource:
        sites:
          - "example.com/"

    - kind: ConditionGroup
      id: has-answer-conditions
      conditions:
        - id: has-answer
          condition: =!IsBlank(Topic.Answer)
          actions:
            - kind: SendActivity
              id: sendMessage_1
              activity: Here's what I found...
```

**Common Node Types:**
| Kind | Purpose |
|------|---------|
| `Question` | Collect user input with entity |
| `SendActivity` | Send message/card |
| `ConditionGroup` | Branch logic |
| `SearchAndSummarizeContent` | Generative answers |
| `InvokeFlowAction` | Call Power Automate |
| `SetVariable` | Set variable value |
| `RedirectToTopic` | Go to another topic |
| `EndDialog` | End conversation |

### Agent Flows - JSON View

Agent flows can be viewed as JSON:
1. Open an agent flow
2. Look for "View code" or JSON toggle option
3. Read the flow definition directly

---

## Strategy 2: VS Code Extension (Recommended for Complex Work)

**Microsoft's official VS Code extension allows:**
- Clone agents to local filesystem
- Edit YAML with IntelliSense
- Sync changes back to Copilot Studio
- Git version control
- Use Claude Code to edit agent definitions!

**Installation:**
```bash
# In VS Code, search for "Copilot Studio" extension
# Or: code --install-extension microsoft.copilotstudio
```

**Workflow:**
1. Install extension
2. Clone agent from Copilot Studio
3. Edit YAML files locally
4. Apply changes back to environment

**Directory Structure After Clone:**
```
agent-name/
├── agent.yaml           # Main agent definition
├── topics/
│   ├── Greeting.yaml
│   ├── Escalate.yaml
│   └── custom-topic.yaml
├── actions/             # Tools (flows, prompts, etc.)
├── triggers/
├── knowledge/
└── settings/
```

---

## Strategy 3: Playwright MCP Reliability Patterns

### Pattern 1: Always Snapshot Before Actions

```
# WRONG - refs might be stale
mcp__playwright__browser_click(ref="button[1]")

# RIGHT - get fresh refs first
mcp__playwright__browser_snapshot()
# Then use refs from the new snapshot
mcp__playwright__browser_click(ref="<current-ref>")
```

### Pattern 2: Wait for Loading States

```
# After any action that triggers loading:
mcp__playwright__browser_wait_for(text="Ready")
# OR
mcp__playwright__browser_wait_for(time=3)
# Then snapshot to get stable refs
mcp__playwright__browser_snapshot()
```

### Pattern 3: Wait for Text to Disappear

```
# Wait for loading spinner to go away
mcp__playwright__browser_wait_for(textGone="Loading...")
mcp__playwright__browser_snapshot()
```

### Pattern 4: Use Unique Text as Anchors

Instead of relying on element position (which changes), find elements by their unique text:

```
# Look for button by its label text in snapshot
# Rather than assuming button[3] is correct
```

### Pattern 5: Handle Dynamic Dialogs

MCS frequently shows dialogs. Pattern for handling:

```
1. mcp__playwright__browser_snapshot()
2. Look for dialog indicators in snapshot
3. If dialog present, find close/dismiss button ref
4. Click to dismiss
5. Snapshot again to continue
```

### Pattern 6: Retry on Stale Refs

If a click fails, the ref probably went stale:

```
1. Snapshot
2. Attempt action
3. If fails, snapshot again
4. Re-identify element
5. Retry action
```

---

## Strategy 4: MCS-Specific UI Patterns

### Provisioning Waits

When creating agents or adding features, MCS provisions resources:

```
# After clicking "Create agent":
mcp__playwright__browser_wait_for(time=5)
mcp__playwright__browser_snapshot()
# Check if "Edit" button is enabled
# If not, wait more
```

### Knowledge Source Status

Knowledge sources show status indicators:
- "Adding..." - still processing
- "Ready" - can proceed
- Error icons - need attention

```
# Wait for knowledge to be ready
mcp__playwright__browser_wait_for(text="Ready")
```

### Topic Trigger Phrases

MCS needs multiple trigger phrases (5-10 recommended):

```yaml
# In YAML code editor, add trigger phrases as list
triggers:
  - kind: OnRecognizedIntent
    intent: MyIntent
    triggerQueries:
      - phrase one
      - phrase two
      - phrase three
```

### Navigation Patterns

**Main navigation:**
- Agents list: `copilotstudio.microsoft.com`
- Agent overview: Click agent name
- Topics: Click "Topics" in left nav
- Knowledge: Click "Knowledge" in left nav
- Flows: Click "Flows" in left nav

**Always snapshot after navigation.**

---

## Strategy 5: Hybrid Approach (Best Practice)

**Use Playwright MCP for:**
- Initial agent creation
- Adding knowledge sources (UI-only for some types)
- Publishing
- Testing in the test panel
- Simple configuration changes

**Use VS Code Extension / YAML for:**
- Complex topic logic
- Multiple nodes with conditions
- Bulk changes across topics
- Version control and collaboration
- Detailed variable configuration

**Use PAC CLI for:**
- CI/CD deployment
- Environment migration
- Extracting templates
- Listing/managing agents programmatically

---

## Common MCS Element Patterns

### Button States
- Enabled: Normal appearance, clickable
- Disabled: Grayed out, not in snapshot as interactive
- Loading: May show spinner

### Form Fields
- Text inputs: Look for `textbox` in snapshot
- Dropdowns: Look for `combobox`
- Toggles: Look for `switch` or `checkbox`

### Cards and Panels
- Side panels: Usually slide in from right
- Dialogs: Modal overlays
- Cards: Expandable sections

---

## Troubleshooting

### Browser launch fails - "Opening in existing browser session"
Chrome is already running with the same user profile.

**Solutions:**
1. Close all Chrome windows and try again
2. Or use a different Chrome profile for Playwright
3. Or kill Chrome processes: `taskkill /F /IM chrome.exe`

### "Element not found" errors
1. Take fresh snapshot
2. Search for element by text
3. Element might be in different container/panel

### "Click had no effect"
1. Element might need to be visible (scroll)
2. Dialog might be blocking
3. Element might be disabled
4. Take screenshot to see actual state

### Slow UI response
1. Increase wait times
2. Wait for specific text instead of time
3. MCS can be slow during first load

### Refs changing constantly
1. MCS rebuilds DOM during operations
2. Always snapshot right before action
3. Use text-based identification

---

## Quick Reference: MCS Automation Checklist

```
□ Navigate to copilotstudio.microsoft.com
□ Wait for page load (look for environment name)
□ Snapshot to get current state
□ Identify target by text/label
□ Perform action
□ Wait for UI to stabilize
□ Snapshot to verify result
□ Repeat for next action
```

---

## Example: Complete Topic Creation via YAML

Instead of clicking through UI to create a topic with multiple nodes:

1. Create blank topic via UI (one click)
2. Open code editor (click "..." → "Open code editor")
3. Paste complete YAML:

```yaml
kind: AdaptiveDialog
beginDialog:
  kind: OnRecognizedIntent
  id: main
  priority: 0
  intent:
    displayName: OrderStatus
    triggerQueries:
      - where is my order
      - track my order
      - order status
      - check my order
      - when will my order arrive

  actions:
    - kind: Question
      id: question_orderId
      variable: init:Topic.OrderId
      prompt: What's your order number?
      entity: StringPrebuiltEntity

    - kind: InvokeFlowAction
      id: invokeFlow_1
      input:
        binding:
          orderId: =Topic.OrderId
      output:
        binding:
          status: Topic.OrderStatus
          eta: Topic.DeliveryETA
      flowId: YOUR-FLOW-ID-HERE

    - kind: ConditionGroup
      id: condition_status
      conditions:
        - id: condition_shipped
          condition: =Topic.OrderStatus = "Shipped"
          actions:
            - kind: SendActivity
              id: message_shipped
              activity: |
                Your order has shipped!
                Expected delivery: {Topic.DeliveryETA}

        - id: condition_processing
          condition: =Topic.OrderStatus = "Processing"
          actions:
            - kind: SendActivity
              id: message_processing
              activity: Your order is being processed. We'll notify you when it ships.

      elseActions:
        - kind: SendActivity
          id: message_unknown
          activity: I couldn't find that order. Please check the order number and try again.
```

4. Save (one click)

**This replaces 15+ clicks with 3 clicks + paste.**

---

## Resources

- [YAML Code Editor Docs](https://learn.microsoft.com/en-us/microsoft-copilot-studio/guidance/topics-code-editor)
- [VS Code Extension](https://learn.microsoft.com/en-us/microsoft-copilot-studio/visual-studio-code-extension-overview)
- [YAML Syntax Validator](https://yamlchecker.com/)
- [YAML to JSON Converter](https://jsonformatter.org/yaml-to-json)
