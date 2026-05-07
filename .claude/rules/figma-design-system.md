# Figma Design System Rule (Auto-Trigger on Frontend Edits)

When editing any file in `app/frontend/src/`, follow the Figma-first design workflow. The Elevate design system in Figma is the source of truth for all UI decisions.

## Core Principle

**Only create new UI patterns if they don't exist in Figma.** Before designing any new component, card, layout, dialog, or interaction:

1. Check `knowledge/figma-reference.json` for existing components
2. If the component exists in Figma, pull its design and match it
3. If the component doesn't exist in Figma, follow the closest existing pattern
4. Never invent new visual patterns that diverge from the Elevate design language

## Figma Reference File

`knowledge/figma-reference.json` contains:
- **componentSets**: All published Figma components grouped by area
- **componentMapping**: Maps Figma component names → React file paths
- **styles**: Named color/text styles from the library
- **libraryPages**: Page structure of the Elevate Library file

Refresh with: `node tools/figma-pull.js`
Check staleness: `node tools/figma-pull.js --check`
Audit mapping: `node tools/figma-pull.js --audit`

## When to Pull Figma Designs

Before implementing or modifying any of these:
- **New page/route**: Pull the page design from the relevant Figma file
- **New component**: Check if it exists in the Figma library first
- **Dialog/modal**: Pull the dialog pattern from Figma (Publish dialogs, RAI dialogs are reference)
- **Data table/grid**: Match the DataGrid cell variants in Figma
- **Navigation change**: Match the L1 navigation and Rail item components
- **Card/tile**: Match the existing card patterns (Summary card, Component pill, etc.)

## How to Pull a Figma Design

```bash
# 1. Export a specific component image
node tools/figma-pull.js --component <nodeId>

# 2. Export from a different file (not the library)
node tools/figma-pull.js --component <nodeId> --file <fileId>

# 3. Use curl directly for any frame
curl -s -H "X-Figma-Token: $(grep FIGMA_API_TOKEN .env | cut -d= -f2)" \
  "https://api.figma.com/v1/images/<fileId>?ids=<nodeId>&format=png&scale=2"
```

Key Figma file IDs (from `knowledge/figma-reference.json`._meta.fileMap):
| Area | File ID | File Name |
|------|---------|-----------|
| Design system | DLSFFsesGJRdAEi1CWGIdE | Project Elevate Library |
| Test/Eval | e4GtJkPZyA99waxAw19Kmj | Test and debug playground |
| Build/Components | tztlPiawmj4iP4jfGCMG2O | Elevate-Post March |
| Homepage | WewOn8XOrS3cegWTlxJjCK | Homepage |
| My Stuff | 2cpIIHEdnSpYqG943cCBg1 | Elevate: My Stuff |
| Agent Details | KkSDnBxOOJ1eXxioUMumlY | Capabilities+AgentDetails |
| Skills | ThhYyBQ3JR9RdDnIwEchTt | Skills |
| Helper Agent | N49awrA7v9zTssYWcW8cDQ | Elevate Helper Agent |
| Workflows | rVOKkBSr3q0p0ABUECD8vd | Workflows |

## Design Tokens (from Figma + index.css)

Always use CSS variables from `app/frontend/src/index.css`, not hardcoded values:

| Token | Variable | Value |
|-------|----------|-------|
| Brand | `hsl(var(--primary))` | #464FEB |
| Text primary | `hsl(var(--text-primary))` | #242424 |
| Text subtle | `hsl(var(--text-subtle))` | — |
| Success | `var(--status-success)` | #0E700E |
| Warning | `var(--status-warning)` | — |
| Error | `var(--status-error)` | — |
| Card radius | `var(--radius-xl)` | 16px |
| Dialog radius | `var(--radius-4xl)` | 32px |

## Component Mapping Status

- **mapped** (42): Figma component has a matching React component
- **review** (15): Figma component exists but React mapping needs verification
- **figma-only** (8): Figma component not yet implemented in code
- **code-only**: React component that has no Figma equivalent (custom to our app)

## Decision Flow for New UI Work

```
Is this component in the Figma library?
├── YES → Pull the Figma design, match it exactly
├── PARTIALLY → Pull the closest match, extend for our needs, note deviation
└── NO → Is there a similar pattern in Figma?
    ├── YES → Follow that pattern's visual language (spacing, colors, radius, typography)
    └── NO → Use the Copilot UI component library (components/ui/*) with design tokens
```

## Staleness

- Reference is fresh if < 3 days old AND library hasn't been modified since pull
- Run `node tools/figma-pull.js --check` to verify
- Refresh manually via `/mcs-sync` (the figma-reference adapter surfaces drift as a triage card)
- After any design-heavy work, re-pull to catch library updates
