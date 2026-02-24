import { BRIEF_SECTIONS } from "@/config/briefSections";
import type { Agent } from "@/types";

/**
 * Generates a clean markdown report from brief data.
 */
export function generateBriefReport(agent: Agent, briefData: Record<string, any>): string {
  const lines: string[] = [];
  const hr = "\n---\n";

  lines.push(`# ${agent.name} — Agent Brief`);
  lines.push(`> ${agent.description}`);
  lines.push(`> **Status:** ${agent.status} · **Readiness:** ${agent.readiness}%`);
  lines.push(hr);

  // ── Executive Summary ─────────────────────────────────────────
  {
    lines.push("## Executive Summary\n");
    const bc = briefData["business-context"];
    if (bc?.problemStatement) {
      lines.push(`${bc.problemStatement}\n`);
    }

    const caps = briefData["capabilities"]?.items ?? [];
    const tools = briefData["tools"]?.items ?? [];
    const ks = briefData["knowledge-sources"]?.items ?? [];
    const evalSets = briefData["eval-sets"]?.sets ?? [];
    const oq = briefData["open-questions"]?.items ?? [];

    const mvpCaps = caps.filter((c: any) => (c.phase || "").toLowerCase() === "mvp");
    const futureCaps = caps.filter((c: any) => (c.phase || "").toLowerCase() === "future");
    const totalTests = evalSets.reduce((s: number, es: any) => s + (es.tests?.length ?? 0), 0);
    const testedTests = evalSets.reduce((s: number, es: any) => s + (es.tests?.filter((t: any) => t.lastResult != null).length ?? 0), 0);
    const passedTests = evalSets.reduce((s: number, es: any) => s + (es.tests?.filter((t: any) => t.lastResult?.pass).length ?? 0), 0);
    const passRate = testedTests > 0 ? Math.round((passedTests / testedTests) * 100) : null;

    lines.push("### Key Metrics\n");
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Capabilities | ${caps.length}${mvpCaps.length > 0 ? ` (${mvpCaps.length} MVP / ${futureCaps.length} Future)` : ""} |`);
    lines.push(`| Integrations | ${tools.length} |`);
    lines.push(`| Knowledge Sources | ${ks.length} |`);
    lines.push(`| Eval Tests | ${totalTests}${passRate !== null ? ` (${passRate}% pass)` : ""} |`);
    lines.push(`| Readiness | ${agent.readiness}% |`);
    lines.push("");

    // Top priorities
    const priorities: string[] = [];
    oq.filter((q: any) => q.status !== "resolved").slice(0, 3).forEach((q: any) => priorities.push(`Resolve: ${q.question}`));
    if (priorities.length > 0) {
      lines.push("### Top Priorities");
      priorities.forEach((p) => lines.push(`- ${p}`));
      lines.push("");
    }
    lines.push(hr);
  }

  // Business Context
  const bc = briefData["business-context"];
  if (bc) {
    lines.push("## Business Context\n");
    lines.push(`### Problem Statement\n${bc.problemStatement}\n`);
    if (bc.challenges?.length) {
      lines.push("### Key Challenges");
      bc.challenges.forEach((c: string) => lines.push(`- ${c}`));
      lines.push("");
    }
    if (bc.benefits?.length) {
      lines.push("### Expected Benefits");
      bc.benefits.forEach((b: string) => lines.push(`- ${b}`));
      lines.push("");
    }
    if (bc.successCriteria?.length) {
      lines.push("### Success Criteria\n");
      lines.push("| Metric | Target | Current |");
      lines.push("|--------|--------|---------|");
      bc.successCriteria.forEach((s: any) => lines.push(`| ${s.metric} | ${s.target} | ${s.current} |`));
      lines.push("");
    }
    if (bc.stakeholders?.length) {
      lines.push("### Stakeholders\n");
      bc.stakeholders.forEach((s: any) => lines.push(`- **${s.name}** — ${s.role} (${s.type})`));
      lines.push("");
    }
    lines.push(hr);
  }

  // Agent Identity
  const ai = briefData["agent-identity"];
  if (ai) {
    lines.push("## Agent Identity\n");
    lines.push(`**Name:** ${ai.name}\n`);
    lines.push(`**Description:** ${ai.description}\n`);
    lines.push(`### Persona\n${ai.persona}\n`);
    if (ai.targetUsers?.length) {
      lines.push("### Target Users");
      ai.targetUsers.forEach((u: string) => lines.push(`- ${u}`));
      lines.push("");
    }
    lines.push(hr);
  }

  // Architecture
  const arch = briefData["architecture"];
  if (arch) {
    lines.push("## Architecture\n");
    lines.push(`**Pattern:** ${arch.pattern}\n`);
    if (arch.patternReasoning) lines.push(`> ${arch.patternReasoning}\n`);
    if (arch.triggers?.length) {
      lines.push("### Triggers");
      arch.triggers.forEach((t: any) => lines.push(`- **${t.type}:** ${t.description}`));
      lines.push("");
    }
    if (arch.childAgents?.length) {
      lines.push("### Child Agents");
      arch.childAgents.forEach((c: any) => lines.push(`- **${c.name}:** ${c.role}`));
      lines.push("");
    }
    if (arch.scoring?.length) {
      lines.push("### Complexity Scoring\n");
      lines.push("| Factor | Score | Notes |");
      lines.push("|--------|-------|-------|");
      arch.scoring.forEach((s: any) => lines.push(`| ${s.factor} | ${s.score}/10 | ${s.notes} |`));
      lines.push("");
    }
    lines.push(hr);
  }

  // Instructions
  const inst = briefData["instructions"];
  if (inst) {
    lines.push("## Instructions\n");
    lines.push("```");
    lines.push(inst.systemPrompt || "");
    lines.push("```\n");
    lines.push(hr);
  }

  // Capabilities
  const caps = briefData["capabilities"];
  if (caps?.items?.length) {
    lines.push("## Capabilities\n");
    lines.push("| Capability | Description | Phase |");
    lines.push("|------------|-------------|-------|");
    caps.items.forEach((c: any) => {
      const phase = c.phase || "\u2014";
      lines.push(`| ${c.name} | ${c.description} | ${phase} |`);
    });
    lines.push("");
    lines.push(hr);
  }

  // Tools / Integrations — adds phase column if present
  const tools = briefData["tools"];
  if (tools?.items?.length) {
    const hasPhase = tools.items.some((t: any) => t.phase);
    lines.push("## Integrations\n");
    if (hasPhase) {
      lines.push("| Tool | Type | Auth | Phase |");
      lines.push("|------|------|------|-------|");
      tools.items.forEach((t: any) => lines.push(`| ${t.name} | ${t.type} | ${t.auth} | ${t.phase || "\u2014"} |`));
    } else {
      lines.push("| Tool | Type | Auth |");
      lines.push("|------|------|------|");
      tools.items.forEach((t: any) => lines.push(`| ${t.name} | ${t.type} | ${t.auth} |`));
    }
    lines.push("");
    lines.push(hr);
  }

  // Knowledge Sources
  const ks = briefData["knowledge-sources"];
  if (ks?.items?.length) {
    lines.push("## Knowledge Sources\n");
    lines.push("| Source | Purpose | Location | Phase | Status |");
    lines.push("|--------|---------|----------|-------|--------|");
    ks.items.forEach((k: any) => lines.push(`| ${k.name} | ${k.purpose} | ${k.location} | ${k.phase} | ${k.status} |`));
    lines.push("");
    lines.push(hr);
  }

  // Conversation Topics
  const ct = briefData["conversation-topics"];
  if (ct?.items?.length) {
    lines.push("## Conversation Topics\n");
    ct.items.forEach((t: any) => {
      lines.push(`### ${t.name} (${t.type}, ${t.phase})`);
      lines.push(`${t.description}\n`);
      if (t.flowDescription) {
        lines.push("**Flow:**");
        lines.push("```");
        lines.push(t.flowDescription);
        lines.push("```\n");
      }
    });
    lines.push(hr);
  }

  // Scope & Boundaries
  const sb = briefData["scope-boundaries"];
  if (sb) {
    lines.push("## Scope & Boundaries\n");
    if (sb.handles?.length) {
      lines.push("### Handles");
      sb.handles.forEach((h: string) => lines.push(`- ${h}`));
      lines.push("");
    }
    if (sb.politelyDeclines?.length) {
      lines.push("### Politely Declines");
      sb.politelyDeclines.forEach((d: string) => lines.push(`- ${d}`));
      lines.push("");
    }
    if (sb.hardRefuses?.length) {
      lines.push("### Hard Refuses");
      sb.hardRefuses.forEach((r: string) => lines.push(`- ${r}`));
      lines.push("");
    }
    lines.push(hr);
  }

  // Eval Sets
  const es = briefData["eval-sets"];
  if (es?.sets?.length) {
    lines.push("## Eval Sets\n");
    for (const set of es.sets) {
      const tested = set.tests?.filter((t: any) => t.lastResult != null) ?? [];
      const passed = tested.filter((t: any) => t.lastResult?.pass).length;
      const rate = tested.length > 0 ? Math.round((passed / tested.length) * 100) : null;
      const rateStr = rate !== null ? ` — ${rate}% pass rate` : "";

      lines.push(`### ${set.name.charAt(0).toUpperCase() + set.name.slice(1)} (target: ${set.passThreshold}%${rateStr})`);
      lines.push(`> ${set.description}\n`);
      lines.push(`**Methods:** ${(set.methods ?? []).map((m: any) => {
        if (m.score != null) return `${m.type} (${m.score}%)`;
        if (m.mode) return `${m.type} (${m.mode})`;
        return m.type;
      }).join(", ")}\n`);

      if (set.tests?.length) {
        lines.push("| Question | Expected | Capability | Result |");
        lines.push("|----------|----------|------------|--------|");
        set.tests.forEach((t: any) => {
          const result = t.lastResult == null ? "\u2014" : t.lastResult.pass ? "Pass" : "Fail";
          lines.push(`| ${t.question} | ${t.expected || "\u2014"} | ${t.capability || "\u2014"} | ${result} |`);
        });
        lines.push("");
      }
    }
    lines.push(hr);
  }

  // ── Best Practices & Recommendations ──────────────────────────
  {
    const isMultiAgent = briefData["architecture"]?.pattern?.toLowerCase().includes("multi");

    lines.push("## Best Practices & Recommendations\n");
    lines.push("*Industry-proven recommendations for Microsoft Copilot Studio agents.*\n");

    lines.push("### Instructions & Design");
    lines.push("- Keep system instructions under 8,000 characters for optimal generative orchestration");
    lines.push("- Use explicit persona definitions for consistent tone across all responses");
    lines.push("- Define clear scope boundaries \u2014 what the agent handles, declines, and refuses");
    lines.push("- Include example responses for high-stakes scenarios to anchor model behavior");
    lines.push("");

    lines.push("### Knowledge & Grounding");
    lines.push("- Prefer SharePoint or Dataverse knowledge sources over uploaded files for automatic refresh");
    lines.push("- Use descriptive file names that help the retrieval engine find the right content");
    lines.push("- Test with edge-case queries that probe content boundaries and gaps");
    lines.push("- Enable strict grounding for factual or regulated content domains");
    lines.push("");

    lines.push("### Evaluation & Testing");
    lines.push("- Maintain 100% pass rate on critical (boundary) tests before expanding scope");
    lines.push("- Include at least 3 test cases per capability for adequate coverage");
    lines.push("- Run regression tests after every instruction or topic change");
    lines.push("- Use semantic matching (Compare meaning 70%+) for conversational responses");
    lines.push("");

    lines.push("### Deployment & Operations");
    lines.push("- Publish to a test environment before production to validate end-to-end behavior");
    lines.push("- Monitor conversation logs for the first 2 weeks post-launch to catch drift");
    lines.push("- Set up fallback topics for unrecognized intents to prevent dead-ends");
    lines.push("- Review knowledge sources quarterly to ensure content stays current");
    lines.push("");

    if (isMultiAgent) {
      lines.push("### Multi-Agent Architecture");
      lines.push("- Keep specialist agents focused on a single domain for clearer routing");
      lines.push("- Define explicit routing rules with unambiguous trigger phrases");
      lines.push("- Test cross-agent handoff scenarios in the integration eval set");
      lines.push("");
    }

    lines.push(hr);
  }

  // Open Questions — uses notes (from assignee field), not "Assignee"
  const oq = briefData["open-questions"];
  if (oq?.items?.length) {
    lines.push("## Open Questions\n");
    oq.items.forEach((q: any) => {
      const resolved = q.status === "resolved" ? ` *${q.resolution}*` : "";
      const notes = q.notes || q.assignee || "";
      const notesStr = notes ? ` — Notes: ${notes}` : "";
      lines.push(`- **[${q.status === "resolved" ? "Resolved" : "Open"}]** ${q.question}${notesStr}${resolved}`);
    });
    lines.push("");
  }

  // Footer
  lines.push(hr);
  lines.push(`*Generated on ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}*`);

  return lines.join("\n");
}

/**
 * Downloads a string as a file.
 */
export function downloadFile(content: string, filename: string, mimeType = "text/markdown") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
