# MCS Component Reference Guide

This document provides a research-based reference of Microsoft Copilot Studio components. **Always verify current capabilities via Microsoft Learn MCP before recommending components.**

## Component Categories

### 1. Orchestration & AI

#### Generative Orchestration
- **What it does:** LLM-driven planning layer that interprets user intent, breaks down complex requests, selects tools/topics/knowledge automatically
- **Key benefits:**
  - Reduces topic sprawl through composing reusable building blocks
  - Automates slot filling based on input definitions
  - Adapts response style and plan structure dynamically
  - Handles multi-intent queries
- **Requirements:** Must be enabled for agent
- **Research:** `microsoft_docs_search(query="Copilot Studio generative orchestration")`

#### Generative Answers
- **What it does:** Dynamically generates answers by searching knowledge sources
- **Key benefits:**
  - No need to hand-build FAQs
  - Summarizes retrieved content
  - Generates citations
- **Sources supported:** SharePoint, OneDrive, Dataverse, public websites, uploaded files, enterprise connectors
- **Research:** `microsoft_docs_search(query="Copilot Studio generative answers")`

#### AI Prompts
- **What it does:** Custom prompt actions using LLM to generate/transform content
- **Use cases:** Content generation, summarization, translation, analysis
- **Research:** `microsoft_docs_search(query="Copilot Studio AI prompts")`

#### Deep Reasoning Models (Preview)
- **What it does:** Advanced reasoning for complex analytical queries
- **Research:** `microsoft_docs_search(query="Copilot Studio deep reasoning models")`

---

### 2. Automation & Integration

#### Agent Flows (Native to Copilot Studio)
- **What it does:** Automate repetitive tasks directly in Copilot Studio
- **Triggers:**
  - When agent calls the flow
  - Scheduled
  - Event-based
- **Actions:**
  - AI capabilities (generate text, process documents)
  - Human in the loop (approvals)
  - Built-in tools (loops, conditions, data operations)
  - Connectors
- **Benefits over Power Automate:**
  - Native experience, no separate licensing
  - Billed through Copilot Studio consumption
  - Simplified maker experience
- **Research:** `microsoft_docs_search(query="Copilot Studio agent flows")`

#### Power Automate Flows (Cloud Flows)
- **What it does:** Enterprise automation with extensive connector ecosystem
- **When to use:**
  - Need specific connectors not available in agent flows
  - Complex multi-step automation
  - Enterprise-wide workflows
- **Trigger:** "Run a flow from Copilot"
- **Research:** `microsoft_docs_search(query="Copilot Studio Power Automate integration")`

#### HTTP Requests
- **What it does:** Direct REST API calls from topics
- **Configuration:**
  - URL, Method (GET, POST, PATCH, PUT, DELETE)
  - Headers, Body
  - Response data type
- **When to use:**
  - Simple API integration
  - Less setup than custom connector
- **Research:** `microsoft_docs_search(query="Copilot Studio HTTP request node")`

#### Custom Connectors
- **What it does:** Reusable wrapper around REST APIs
- **Authentication supported:**
  - OAuth 2.0 (including Microsoft Entra ID)
  - Basic authentication
  - API Key
- **Research:** `microsoft_docs_search(query="Power Platform custom connectors")`

#### Model Context Protocol (MCP)
- **What it does:** Standardized way to connect with external tools and data sources
- **Components:**
  - Tools: Functions the agent can call
  - Resources: File-like data for context
- **Key benefits:**
  - Standardized context for AI models
  - Tools/resources auto-discovered from server
  - Updates on server reflected automatically
- **Requirements:** Generative orchestration must be enabled
- **Research:** `microsoft_docs_search(query="Copilot Studio MCP Model Context Protocol")`

#### Computer Use (Preview)
- **What it does:** AI-driven automation of web and desktop apps via screen interaction
- **How it works:**
  - Captures screenshots to understand screen state
  - Performs clicks, typing, scrolling
  - Adapts to interface changes
- **When to use:**
  - No API available for the system
  - Legacy application automation
  - Multi-application processes
- **Machine options:**
  - Hosted browser (quick start, limited)
  - Bring-your-own-machine (Power Automate for desktop)
- **Research:** `microsoft_docs_search(query="Copilot Studio computer use")`

---

### 3. Conversation Design

#### Topics
- **What it does:** Deterministic conversation pathways
- **Structure:**
  - Trigger phrases → Nodes → Actions → Responses
- **Node types:**
  - **Message:** Display text or adaptive card
  - **Question:** Collect user input with entity recognition
  - **Condition:** Branch based on variable values
  - **Action:** Call flows, set variables
  - **Redirect:** Go to another topic
  - **End:** End conversation/topic
- **When to use:**
  - Specific, predictable conversation flows
  - Override generative AI for certain intents
  - Multi-step data collection
- **Research:** `microsoft_docs_search(query="Copilot Studio topics authoring")`

#### Adaptive Cards
- **What it does:** Platform-agnostic rich UI components
- **Schema versions:** 1.6 and earlier (varies by channel)
- **Elements:**
  - TextBlock, Image, Media
  - ColumnSet, Container
  - Input.Text, Input.ChoiceSet, Input.Toggle, Input.Date
  - Action.Submit, Action.OpenUrl
- **Dynamic content:** Use Power Fx formulas for dynamic data binding
- **Built-in designer:** Available in Copilot Studio
- **Research:** `microsoft_docs_search(query="Copilot Studio adaptive cards")`

#### Question Node Properties
- **Skip behavior:** Skip if variable already has value
- **Reprompt:** Retry on invalid response (1-2 times)
- **Entity recognition:** Additional validation
- **Interruption:** Allow/prevent topic switching
- **Research:** `microsoft_docs_search(query="Copilot Studio question node")`

#### Condition Nodes
- **Simple conditions:** Variable comparisons
- **Power Fx formulas:** Complex logic (`Topic.var1 > DateAdd(Now(), 14)`)
- **Research:** `microsoft_docs_search(query="Copilot Studio conditions Power Fx")`

---

### 4. Knowledge & Data

#### Knowledge Sources Summary
| Source | Type | Auth Required | Synced |
|--------|------|---------------|--------|
| SharePoint | Internal | User's Entra ID | Yes |
| OneDrive | Internal | User's Entra ID | Yes |
| File Upload | Internal | None | No (static) |
| Dataverse | Internal | User's Entra ID | Yes |
| Public Websites | External | None | No |
| Enterprise Connectors | Internal | User's Entra ID | Yes |

#### SharePoint/OneDrive
- **Benefits:** User-permissioned, auto-synced, supports folders
- **File types:** Word, PowerPoint, PDF, Excel
- **Max file size:** 512 MB
- **Limitations:** Protected/password docs not indexed
- **Research:** `microsoft_docs_search(query="Copilot Studio SharePoint knowledge")`

#### Dataverse
- **Uses:**
  - As knowledge source (AI can query)
  - For data persistence (via flows)
  - Direct queries in topics (limited)
- **Benefits:** Queryable, structured, persistent
- **Research:** `microsoft_docs_search(query="Copilot Studio Dataverse knowledge")`

#### Enterprise Data Connectors
- **What it does:** Connect to data indexed by Microsoft Search
- **Examples:** Salesforce, ServiceNow, Confluence, ZenDesk
- **Research:** `microsoft_docs_search(query="Copilot Studio enterprise data connectors")`

---

### 5. Triggers & Autonomy

#### Conversation Triggers (Standard)
- **What it does:** Topic activated by user phrases
- **Best practice:** 5-10 trigger phrase variations

#### Autonomous Agent Triggers
- **Event Triggers:**
  - React to external events (database update, email received)
  - Agent acts without user prompt
- **Scheduled Triggers:**
  - Time-based activation
  - Periodic tasks

#### Custom Orchestration Triggers
| Trigger | When | Purpose |
|---------|------|---------|
| On Knowledge Requested | Before knowledge query | Intercept/modify search |
| AI Response Generated | After AI drafts response | Modify before sending |
| On Plan Complete | After plan executes | Cleanup, redirect to survey |

- **Research:** `microsoft_docs_search(query="Copilot Studio autonomous agents triggers")`

---

### 6. Variables & State

#### Variable Scopes
| Scope | Lifetime | Use Case |
|-------|----------|----------|
| Topic | Single topic execution | Temporary calculations |
| Global | Entire conversation session | User preferences, state |
| System | Built-in | User.DisplayName, User.Email, etc. |

#### System Variables
- `System.User.DisplayName` - User's name
- `System.User.Email` - User's email
- `System.Conversation.Id` - Session ID
- `System.Activity.Text` - Last user message

#### Power Fx
- **Use in:** Conditions, variable values, adaptive cards
- **Common functions:** `Upper()`, `DateAdd()`, `If()`, `IsMatch()`
- **Research:** `microsoft_docs_search(query="Copilot Studio Power Fx formulas")`

---

## Decision Framework

### When evaluating which components to use, ask:

**Data Persistence:**
- Does it need to survive session end? → Dataverse or external system
- Is it user-specific? → Per-user records with authentication
- Session-only? → Global variables

**Integration:**
- Simple API call? → HTTP Request
- Reusable across agents? → Custom connector or MCP
- No API exists? → Computer use
- Complex automation? → Agent flow or Power Automate

**Conversation:**
- Predictable flow? → Topic
- Open-ended Q&A? → Generative answers + knowledge
- Rich UI needed? → Adaptive cards

**Autonomy:**
- User-initiated only? → Conversation triggers
- React to events? → Event triggers
- Proactive? → Scheduled triggers

---

## Research Commands

Always verify capabilities before recommending:

```
# General capability research
mcp__microsoft-learn__microsoft_docs_search(query="Copilot Studio [component name]")

# Latest features
mcp__microsoft-learn__microsoft_docs_search(query="Copilot Studio what's new 2024 2025")

# Implementation details
mcp__microsoft-learn__microsoft_docs_fetch(url="[specific doc URL]")

# Code samples
mcp__microsoft-learn__microsoft_code_sample_search(query="[topic]", language="powerfx")
```
