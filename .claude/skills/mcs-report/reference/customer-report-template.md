# Customer Report Template

**Audience:** Non-technical stakeholders, executives
**When:** Anytime -- for exec updates, customer presentations, decision reviews.

```markdown
# {agent.name} -- Project Summary

**Prepared for:** {business.stakeholders.sponsor}
**Date:** {timestamp}

## What We're Building
{business.useCase}

{business.problemStatement}

## What It Does

{For each MVP capability, write 1-2 plain English sentences:}
- **{capability.name}:** {capability.description in plain language}

## What It Connects To
{For each MVP integration:}
- **{integration.name}:** {integration.purpose -- in plain language}

## Approach
{If architecture.buildPath == "custom-agent":} We're building a custom AI agent tailored to your needs.
{If architecture.buildPath == "declarative-agent":} We're recommending a configuration-based agent that works inside Microsoft 365 Copilot -- no custom development needed.
{If architecture.buildPath == "first-party-only":} Microsoft already offers built-in agents that cover these needs -- we recommend using those directly.

{If architecture.frontierAgentMatch has entries with coverage "full" or "partial":}
### Leveraging Microsoft's Built-In Agents
{For each match:}
- **{agentName}:** Already handles {matchedCapabilities in plain language}. {If coverage == "partial": "We'll build the remaining functionality as a custom addition."}

## Key Design Decisions
{For each confirmed decision:}
- **{decision.title}:** {Selected option -- 1 sentence summary of what was chosen and why}

{For each pending decision:}
- **{decision.title}:** Awaiting your input -- {brief context}

## Current Status
{One of:}
- "Design complete -- ready for build"
- "Built and tested -- {pass rate}% of tests passing"
- "Deployed to {targetEnv}"
- "In progress -- {lastCompletedStep}"

## What's Next
{1-3 bullet points, plain language}

## Planned for Later
{future capabilities -> bullet list with reasons in plain language}

## Open Questions for Your Team
{openQuestions with empty answers -> numbered list}
```
