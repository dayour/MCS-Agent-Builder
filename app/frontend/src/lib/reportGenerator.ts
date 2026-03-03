import { BRIEF_SECTIONS } from "@/config/briefSections";
import type { Agent } from "@/types";
import { sectionGuidelines } from "@/config/sectionGuidelines";

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
    const ov = briefData["overview"];
    if (ov?.problemStatement) {
      lines.push(`${ov.problemStatement}\n`);
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

  // Overview
  const ov = briefData["overview"];
  if (ov) {
    lines.push("## Overview\n");
    lines.push(`**Name:** ${ov.name}\n`);
    lines.push(`**Description:** ${ov.description}\n`);
    if (ov.problemStatement) {
      lines.push(`### Problem Statement\n${ov.problemStatement}\n`);
    }
    if (ov.targetUsers?.length) {
      lines.push("### Target Users");
      ov.targetUsers.forEach((u: string) => lines.push(`- ${u}`));
      lines.push("");
    }
    if (ov.challenges?.length) {
      lines.push("### Key Challenges");
      ov.challenges.forEach((c: string) => lines.push(`- ${c}`));
      lines.push("");
    }
    if (ov.benefits?.length) {
      lines.push("### Expected Benefits");
      ov.benefits.forEach((b: string) => lines.push(`- ${b}`));
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
    if (arch.channels?.length) {
      lines.push("### Channels");
      lines.push("| Channel | Reason |");
      lines.push("|---------|--------|");
      arch.channels.forEach((c: any) => lines.push(`| ${c.name} | ${c.reason || "\u2014"} |`));
      lines.push("");
    }
    if (arch.childAgents?.length) {
      lines.push("### Child Agents");
      lines.push("| Agent | Role | Routing Rule |");
      lines.push("|-------|------|--------------|");
      arch.childAgents.forEach((c: any) => lines.push(`| ${c.name} | ${c.role} | ${c.routingRule || "\u2014"} |`));
      lines.push("");
    }
    if (arch.scoring?.length) {
      const total = arch.scoring.reduce((s: number, f: any) => s + (f.score || 0), 0);
      lines.push(`### Architecture Score (${total}/6)`);
      lines.push("| Factor | Score | Notes |");
      lines.push("|--------|-------|-------|");
      arch.scoring.forEach((f: any) => lines.push(`| ${f.factor} | ${f.score ? "Yes" : "No"} | ${f.notes || "\u2014"} |`));
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

  // Decisions
  const decisions = briefData["decisions"];
  if (decisions?.items?.length) {
    lines.push("## Decisions\n");
    const pending = decisions.items.filter((d: any) => d.status === "pending");
    const resolved = decisions.items.filter((d: any) => d.status !== "pending");

    if (pending.length > 0) {
      lines.push(`> **${pending.length} pending decision${pending.length > 1 ? "s" : ""}** require resolution before build.\n`);
    }

    decisions.items.forEach((d: any) => {
      const statusIcon = d.status === "pending" ? "\u{1F7E1}" : d.status === "overridden" ? "\u{1F7E0}" : "\u2705";
      lines.push(`### ${statusIcon} ${d.title}`);
      lines.push(`**Category:** ${d.category} · **Status:** ${d.status}${d.capability ? ` · **Capability:** ${d.capability}` : ""}\n`);
      if (d.context) lines.push(`${d.context}\n`);

      lines.push("| Option | Summary | Confidence | Cost | Effort |");
      lines.push("|--------|---------|------------|------|--------|");
      (d.options ?? []).forEach((o: any) => {
        const selected = o.id === d.selectedOptionId ? " **\u2190 Selected**" : "";
        const recommended = o.id === d.recommendedOptionId ? " *(Recommended)*" : "";
        lines.push(`| ${o.label}${recommended}${selected} | ${o.summary} | ${o.confidence} | ${o.cost || "\u2014"} | ${o.effort || "\u2014"} |`);
      });
      lines.push("");

      // Show pros/cons for selected option
      const selected = (d.options ?? []).find((o: any) => o.id === d.selectedOptionId);
      if (selected) {
        if (selected.pros?.length) {
          lines.push("**Pros:** " + selected.pros.join(" · "));
        }
        if (selected.cons?.length) {
          lines.push("**Cons:** " + selected.cons.join(" · "));
        }
        if (selected.requirements?.length) {
          lines.push("**Requirements:** " + selected.requirements.join(" · "));
        }
        lines.push("");
      }
    });
    lines.push(hr);
  }

  // ── Best Practices & Guidelines ──────────────────────────────
  {
    lines.push("## Best Practices & Guidelines\n");

    // Map section IDs to human-readable titles
    const sectionTitles: Record<string, string> = {};
    for (const s of BRIEF_SECTIONS) sectionTitles[s.id] = s.title;

    for (const [sectionId, guide] of Object.entries(sectionGuidelines)) {
      const title = sectionTitles[sectionId] ?? sectionId;
      lines.push(`### ${title}`);
      for (const bp of guide.bestPractices) {
        lines.push(`- ${bp}`);
      }
      if (guide.tip) {
        lines.push(`\n> **Tip:** ${guide.tip}`);
      }
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
