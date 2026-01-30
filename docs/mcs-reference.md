# Microsoft Copilot Studio Reference

This document contains UI selectors, workflow patterns, and best practices for automating Microsoft Copilot Studio via Playwright.

## URLs

| Service | URL |
|---------|-----|
| Copilot Studio | https://copilotstudio.microsoft.com |
| Power Automate | https://make.powerautomate.com |
| Power Platform Admin | https://admin.powerplatform.microsoft.com |

## UI Selectors

### Navigation & Account
```
account_manager_btn:      [aria-label="Account manager"]
account_email:            [data-testid="account-email"]
environment_selector:     [aria-label="Environment"]
environment_name:         [data-testid="environment-name"]
sign_out_btn:             button:has-text("Sign out")
```

### Agent Creation
```
create_agent_btn:         [aria-label="Create"]
new_agent_option:         button:has-text("New agent")
agent_name_input:         [aria-label="Name"]
agent_description_input:  [aria-label="Description"]
instructions_input:       [aria-label="Instructions"]
skip_to_configure:        button:has-text("Skip to configure")
```

### Knowledge Sources
```
add_knowledge_btn:        [aria-label="Add knowledge"]
knowledge_sharepoint:     button:has-text("SharePoint")
knowledge_dataverse:      button:has-text("Dataverse")
knowledge_files:          button:has-text("Files")
knowledge_website:        button:has-text("Public websites")
knowledge_url_input:      [aria-label="URL"]
add_source_btn:           button:has-text("Add")
```

### Topics
```
topics_tab:               [aria-label="Topics"]
add_topic_btn:            [aria-label="Add a topic"]
from_blank_option:        button:has-text("From blank")
topic_name_input:         [aria-label="Name"]
trigger_phrases_input:    [aria-label="Add phrases"]
add_node_btn:             [aria-label="Add node"]
message_node:             button:has-text("Send a message")
question_node:            button:has-text("Ask a question")
condition_node:           button:has-text("Add a condition")
```

### Actions & Flows
```
actions_tab:              [aria-label="Actions"]
add_action_btn:           [aria-label="Add an action"]
flow_action:              button:has-text("Run a flow")
connector_action:         button:has-text("Use a connector")
http_action:              button:has-text("HTTP request")
```

### Testing
```
test_panel_btn:           [aria-label="Test"]
test_chat_input:          [aria-label="Type your message"]
test_send_btn:            [aria-label="Send"]
test_refresh_btn:         [aria-label="Refresh"]
```

### Common Controls
```
save_btn:                 button:has-text("Save")
publish_btn:              button:has-text("Publish")
close_btn:                button:has-text("Close")
cancel_btn:               button:has-text("Cancel")
confirm_btn:              button:has-text("Confirm")
```

## Workflow Patterns

### 1. Session Validation
Always validate the MCS session before operations:
```
1. browser_navigate → copilotstudio.microsoft.com
2. browser_snapshot → capture accessibility tree
3. Extract account email and environment name
4. Confirm with user before proceeding
```

### 2. Create New Agent
```
1. Click "Create" button
2. Select "New agent"
3. Enter agent name and description
4. Skip to configure (or use wizard)
5. Navigate to Overview tab
6. Fill in Instructions field
7. Save changes
```

### 3. Add Knowledge Source (SharePoint)
```
1. Navigate to Knowledge tab
2. Click "Add knowledge"
3. Select "SharePoint"
4. Enter SharePoint site URL
5. Select specific folders/libraries
6. Click "Add"
7. Wait for indexing confirmation
```

### 4. Add Knowledge Source (Dataverse)
```
1. Navigate to Knowledge tab
2. Click "Add knowledge"
3. Select "Dataverse"
4. Select environment (if prompted)
5. Select table(s)
6. Configure column mappings
7. Click "Add"
```

### 5. Create Topic
```
1. Navigate to Topics tab
2. Click "Add a topic" → "From blank"
3. Enter topic name
4. Add trigger phrases (one per line)
5. Add nodes (Message, Question, Condition, Action)
6. Configure each node
7. Save topic
```

### 6. Add Power Automate Flow Action
```
1. In topic editor, click "Add node"
2. Select "Call an action" → "Run a flow"
3. Select existing flow OR create new
4. Map input/output variables
5. Save
```

### 7. Test Agent
```
1. Open test panel (bottom-right or sidebar)
2. Click refresh to reload agent
3. Enter test prompt
4. Send and observe response
5. Check conversation trace for errors
```

### 8. Publish Agent
```
1. Ensure all changes are saved
2. Click "Publish" button
3. Confirm publish dialog
4. Wait for publishing to complete
5. Note the publish timestamp
```

## Common Patterns

### Handling Dialogs
MCS may show confirmation dialogs. Use `browser_handle_dialog(accept=true)` or look for confirmation buttons in the snapshot.

### Waiting for Loading
After navigation or form submission, use `browser_wait_for(time=2)` or wait for specific text to appear/disappear.

### Error Recovery
If an element isn't found:
1. Take a screenshot for debugging
2. Try browser_snapshot to see current state
3. Check if a dialog or overlay is blocking
4. Try scrolling the element into view

## Power Automate Integration

### Creating Agent Flows
Agent flows are triggered by Copilot Studio topics:
```
1. In topic editor, add "Call an action" node
2. Select "Create a new flow"
3. Flow opens in Power Automate
4. Trigger: "When an agent calls a flow"
5. Add actions (HTTP, Dataverse, etc.)
6. Return response to agent
7. Save and return to Copilot Studio
```

### Common Flow Actions
- **Dataverse**: List rows, Get row, Create row, Update row
- **HTTP**: Make external API calls
- **SharePoint**: Get items, Create item, Get file content
- **Office 365**: Send email, Get user profile

## Best Practices

### 1. Selector Strategy
- Prefer `aria-label` selectors (accessibility-friendly)
- Use `button:has-text("...")` for buttons
- Use `ref` from browser_snapshot for precise targeting
- Avoid CSS class selectors (change frequently)

### 2. Reliability
- Always snapshot before interaction
- Use explicit waits after navigation
- Handle loading states and spinners
- Capture screenshots on errors

### 3. Agent Design
- Keep instructions clear and specific
- Use knowledge sources for factual grounding
- Design topics for specific user intents
- Test with diverse prompts

### 4. Knowledge Configuration
- SharePoint: Best for documents (PDF, Word, etc.)
- Dataverse: Best for structured data (tables)
- Public websites: Best for public documentation
- Files: Best for quick demos with uploaded files

## Troubleshooting

### Agent Not Responding
1. Check if agent is published
2. Verify knowledge sources are indexed
3. Check topic trigger phrases match input
4. Review conversation trace for errors

### Knowledge Not Working
1. Confirm indexing is complete
2. Check access permissions
3. Verify content is in supported format
4. Try re-adding the knowledge source

### Flow Not Triggering
1. Verify flow is published
2. Check connection authentication
3. Review flow run history for errors
4. Ensure input/output mappings are correct
