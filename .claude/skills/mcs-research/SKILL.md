---
name: mcs-research
description: Research Microsoft Copilot Studio components, connectors, or capabilities using MS Learn MCP. Use when planning architecture or evaluating options.

---

# MCS Component Research

Research the requested component/capability for Microsoft Copilot Studio.

## Process

1. **Search MS Learn** for current documentation:
   ```
   mcp__microsoft-learn__microsoft_docs_search(query="Copilot Studio $ARGUMENTS")
   ```

2. **If code samples needed**, search for examples:
   ```
   mcp__microsoft-learn__microsoft_code_sample_search(query="Copilot Studio $ARGUMENTS")
   ```

3. **Fetch full docs** if search results are incomplete:
   ```
   mcp__microsoft-learn__microsoft_docs_fetch(url="[relevant URL from search]")
   ```

## Output Format

Provide a structured summary:

### [Component Name]

**What it does:** [One-line description]

**When to use:**
- [Use case 1]
- [Use case 2]

**Prerequisites:**
- [Prerequisite 1]
- [Prerequisite 2]

**Limitations:**
- [Limitation 1]
- [Limitation 2]

**Alternatives:**
| Alternative | When to prefer |
|-------------|----------------|
| [Option] | [Scenario] |

**Sources:**
- [URL 1]
- [URL 2]

## Important

- Always cite sources with URLs
- Note if documentation seems outdated
- Highlight preview/GA status
- Flag any recent changes or deprecations
