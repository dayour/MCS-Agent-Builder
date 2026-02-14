import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Agent } from "@/types";

// ── Layout ─────────────────────────────────────────────────
const ML = 22;           // margin left
const MR = 18;           // margin right
const MT = 28;           // margin top (after header)
const PW = 210;          // page width
const PH = 297;          // page height
const CW = PW - ML - MR; // content width

// ── Colors — dark navy / neutral slate ─────────────────────
const C = {
  navy:    [16, 36, 76]    as const,
  navyBg:  [240, 243, 249] as const,
  s900:    [15, 23, 42]    as const,
  s700:    [51, 65, 85]    as const,
  s500:    [100, 116, 139] as const,
  s400:    [148, 163, 184] as const,
  s200:    [226, 232, 240] as const,
  s100:    [241, 245, 249] as const,
  s50:     [248, 250, 252] as const,
  white:   [255, 255, 255] as const,
  green:   [22, 163, 74]   as const,
  amber:   [180, 120, 10]  as const,
  red:     [200, 50, 60]   as const,
};

type RGB = readonly [number, number, number];
const rgb = (c: RGB) => c as unknown as [number, number, number];

// ── Page management ────────────────────────────────────────

function needPage(doc: jsPDF, y: number, need = 12): number {
  if (y + need > PH - 20) { doc.addPage(); return MT; }
  return y;
}

// ── Microsoft logo (tiny 4-color squares) ──────────────────

function drawMiniLogo(doc: jsPDF, x: number, y: number, size = 4) {
  const g = size * 0.18;
  const s = (size - g) / 2;
  doc.setFillColor(243, 83, 37);  doc.rect(x, y, s, s, "F");
  doc.setFillColor(129, 188, 6);  doc.rect(x + s + g, y, s, s, "F");
  doc.setFillColor(5, 166, 240);  doc.rect(x, y + s + g, s, s, "F");
  doc.setFillColor(255, 186, 8);  doc.rect(x + s + g, y + s + g, s, s, "F");
}

// ── Header & Footer on every page ──────────────────────────

function addHeadersFooters(doc: jsPDF, agentName: string) {
  const pages = doc.getNumberOfPages();
  const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);

    // Header: thin navy line + logo + text
    drawMiniLogo(doc, ML, 10, 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...rgb(C.s500));
    doc.text("Microsoft", ML + 8, 14);
    doc.setDrawColor(...rgb(C.s200));
    doc.setLineWidth(0.2);
    doc.line(ML, 19, PW - MR, 19);

    // Right-aligned doc title in header
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...rgb(C.s400));
    doc.text(`${agentName} — Agent Brief`, PW - MR, 14, { align: "right" });

    // Footer
    doc.setDrawColor(...rgb(C.s200));
    doc.line(ML, PH - 14, PW - MR, PH - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...rgb(C.s400));
    doc.text(date, ML, PH - 9);
    doc.text(`${i} / ${pages}`, PW - MR, PH - 9, { align: "right" });
    doc.text("Confidential", PW / 2, PH - 9, { align: "center" });
  }
}

// ── Primitives ─────────────────────────────────────────────

function heading(doc: jsPDF, text: string, y: number, num: number): number {
  y = needPage(doc, y, 18);
  // Section number
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...rgb(C.s400));
  doc.text(String(num).padStart(2, "0"), ML, y);
  // Title
  doc.setFontSize(13);
  doc.setTextColor(...rgb(C.navy));
  doc.text(text, ML + 10, y);
  // Underline
  doc.setDrawColor(...rgb(C.navy));
  doc.setLineWidth(0.4);
  doc.line(ML, y + 3, ML + 45, y + 3);
  return y + 10;
}

function subheading(doc: jsPDF, text: string, y: number): number {
  y = needPage(doc, y, 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...rgb(C.s700));
  doc.text(text, ML, y);
  return y + 5.5;
}

function para(doc: jsPDF, text: string, y: number, opts?: {
  italic?: boolean; bold?: boolean; color?: RGB; size?: number; indent?: number;
}): number {
  const ind = opts?.indent ?? 0;
  const style = opts?.bold ? "bold" : opts?.italic ? "italic" : "normal";
  doc.setFont("helvetica", style);
  doc.setFontSize(opts?.size ?? 9);
  doc.setTextColor(...rgb(opts?.color ?? C.s700));
  for (const line of doc.splitTextToSize(text, CW - ind)) {
    y = needPage(doc, y, 5);
    doc.text(line, ML + ind, y);
    y += 4.2;
  }
  return y + 1.5;
}

function callout(doc: jsPDF, text: string, y: number): number {
  y = needPage(doc, y, 14);
  const lines = doc.setFontSize(8.5).splitTextToSize(text, CW - 14);
  const h = Math.max(10, lines.length * 4 + 6);
  doc.setFillColor(...rgb(C.navyBg));
  doc.roundedRect(ML, y - 2, CW, h, 1.5, 1.5, "F");
  doc.setDrawColor(...rgb(C.navy));
  doc.setLineWidth(0.5);
  doc.line(ML, y - 2, ML, y - 2 + h);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...rgb(C.s700));
  doc.text(doc.splitTextToSize(text, CW - 14), ML + 6, y + 3);
  return y + h + 4;
}

function bullets(doc: jsPDF, items: string[], y: number): number {
  for (const item of items) {
    y = needPage(doc, y, 6);
    doc.setFillColor(...rgb(C.navy));
    doc.circle(ML + 2.5, y - 0.8, 0.8, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...rgb(C.s700));
    for (const line of doc.splitTextToSize(item, CW - 10)) {
      y = needPage(doc, y, 5);
      doc.text(line, ML + 7, y);
      y += 4.2;
    }
    y += 0.8;
  }
  return y + 1;
}

function table(doc: jsPDF, head: string[], body: string[][], y: number): number {
  y = needPage(doc, y, 18);
  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    margin: { left: ML, right: MR },
    styles: { fontSize: 8, cellPadding: 2.5, textColor: rgb(C.s700), lineColor: rgb(C.s200), lineWidth: 0.15 },
    headStyles: { fillColor: rgb(C.navy), textColor: rgb(C.white), fontStyle: "bold", fontSize: 7.5 },
    alternateRowStyles: { fillColor: rgb(C.s50) },
    bodyStyles: { fillColor: rgb(C.white) },
    theme: "grid",
  });
  return (doc as any).lastAutoTable.finalY + 6;
}

function kv(doc: jsPDF, label: string, value: string, y: number): number {
  y = needPage(doc, y, 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...rgb(C.s500));
  doc.text(label.toUpperCase(), ML, y);
  const lw = doc.getTextWidth(label.toUpperCase());
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...rgb(C.s900));
  doc.text(value, ML + lw + 4, y);
  return y + 5.5;
}

function spacer(y: number, h = 4) { return y + h; }

// ── Main export ────────────────────────────────────────────

export function generateBriefPDF(agent: Agent, briefData: Record<string, any>): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MT;
  let n = 0;

  // ── Title block (page 1, no separate cover) ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...rgb(C.navy));
  doc.text(agent.name, ML, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...rgb(C.s500));
  doc.text("Agent Brief", ML, y);
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(...rgb(C.s700));
  const desc = doc.splitTextToSize(agent.description, CW);
  doc.text(desc, ML, y);
  y += desc.length * 4.2 + 3;

  // Status line
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...rgb(C.s500));
  doc.text(`Status: ${agent.status.toUpperCase()}  ·  Readiness: ${agent.readiness}%`, ML, y);
  y += 4;

  doc.setDrawColor(...rgb(C.s200));
  doc.setLineWidth(0.3);
  doc.line(ML, y, PW - MR, y);
  y += 8;

  // 1. Business Context
  const bc = briefData["business-context"];
  if (bc) {
    n++;
    y = heading(doc, "Business Context", y, n);
    if (bc.problemStatement) {
      y = subheading(doc, "Problem Statement", y);
      y = para(doc, bc.problemStatement, y);
      y = spacer(y);
    }
    if (bc.challenges?.length) {
      y = subheading(doc, "Key Challenges", y);
      y = bullets(doc, bc.challenges, y);
    }
    if (bc.benefits?.length) {
      y = subheading(doc, "Expected Benefits", y);
      y = bullets(doc, bc.benefits, y);
    }
    if (bc.successCriteria?.length) {
      y = subheading(doc, "Success Criteria", y);
      y = table(doc, ["Metric", "Target", "Current"],
        bc.successCriteria.map((s: any) => [s.metric, s.target, s.current]), y);
    }
    if (bc.stakeholders?.length) {
      y = subheading(doc, "Stakeholders", y);
      y = table(doc, ["Name", "Role", "Type"],
        bc.stakeholders.map((s: any) => [s.name, s.role, s.type]), y);
    }
    y = spacer(y, 6);
  }

  // 2. Agent Identity
  const ai = briefData["agent-identity"];
  if (ai) {
    n++;
    y = heading(doc, "Agent Identity", y, n);
    y = kv(doc, "Name", ai.name, y);
    y = para(doc, ai.description, y);
    if (ai.persona) {
      y = subheading(doc, "Persona", y);
      y = callout(doc, ai.persona, y);
    }
    if (ai.targetUsers?.length) {
      y = subheading(doc, "Target Users", y);
      y = bullets(doc, ai.targetUsers, y);
    }
    y = spacer(y, 6);
  }

  // 3. Architecture
  const arch = briefData["architecture"];
  if (arch) {
    n++;
    y = heading(doc, "Architecture", y, n);
    y = kv(doc, "Pattern", arch.pattern, y);
    if (arch.patternReasoning) y = callout(doc, arch.patternReasoning, y);
    y = kv(doc, "Model", arch.model, y);
    if (arch.modelRationale) y = callout(doc, arch.modelRationale, y);
    if (arch.triggers?.length) {
      y = subheading(doc, "Triggers", y);
      y = bullets(doc, arch.triggers.map((t: any) => `${t.type}: ${t.description}`), y);
    }
    if (arch.childAgents?.length) {
      y = subheading(doc, "Child Agents", y);
      y = table(doc, ["Agent", "Role"],
        arch.childAgents.map((c: any) => [c.name, c.role]), y);
    }
    if (arch.scoring?.length) {
      y = subheading(doc, "Complexity Scoring", y);
      y = table(doc, ["Factor", "Score", "Notes"],
        arch.scoring.map((s: any) => [s.factor, `${s.score}/10`, s.notes]), y);
    }
    y = spacer(y, 6);
  }

  // 4. Instructions
  const inst = briefData["instructions"];
  if (inst?.systemPrompt) {
    n++;
    y = heading(doc, "Instructions", y, n);
    y = needPage(doc, y, 20);
    const promptLines = doc.setFontSize(7.5).splitTextToSize(inst.systemPrompt, CW - 10);
    const bh = Math.min(promptLines.length * 3.5 + 6, PH - 30 - y);
    doc.setFillColor(...rgb(C.s100));
    doc.roundedRect(ML, y - 2, CW, bh, 1.5, 1.5, "F");
    doc.setFont("courier", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...rgb(C.s700));
    let py = y + 3;
    for (const line of promptLines) {
      py = needPage(doc, py, 4);
      doc.text(line, ML + 5, py);
      py += 3.5;
    }
    y = py + 4;
    y = spacer(y, 4);
  }

  // 5. Capabilities
  const caps = briefData["capabilities"];
  if (caps?.items?.length) {
    n++;
    y = heading(doc, "Capabilities", y, n);
    y = table(doc, ["Capability", "Description", "Phase", "Enabled"],
      caps.items.map((c: any) => [c.name, c.description, c.tag, c.enabled ? "✓" : "—"]), y);
    y = spacer(y, 4);
  }

  // 6. Integrations
  const tools = briefData["tools"];
  if (tools?.items?.length) {
    n++;
    y = heading(doc, "Integrations", y, n);
    y = table(doc, ["Tool", "Type", "Auth"],
      tools.items.map((t: any) => [t.name, t.type, t.auth]), y);
    y = spacer(y, 4);
  }

  // 7. Knowledge Sources
  const ks = briefData["knowledge-sources"];
  if (ks?.items?.length) {
    n++;
    y = heading(doc, "Knowledge Sources", y, n);
    y = table(doc, ["Source", "Purpose", "Location", "Phase", "Status"],
      ks.items.map((k: any) => [k.name, k.purpose, k.location, k.phase, k.status]), y);
    y = spacer(y, 4);
  }

  // 8. Conversation Topics
  const ct = briefData["conversation-topics"];
  if (ct?.items?.length) {
    n++;
    y = heading(doc, "Conversation Topics", y, n);
    for (const t of ct.items) {
      y = subheading(doc, `${t.name}  ·  ${t.type}  ·  ${t.phase}`, y);
      y = para(doc, t.description, y);
      if (t.flowDescription) y = callout(doc, t.flowDescription, y);
      y = spacer(y, 2);
    }
    y = spacer(y, 4);
  }

  // 9. Scope & Boundaries
  const sb = briefData["scope-boundaries"];
  if (sb) {
    n++;
    y = heading(doc, "Scope & Boundaries", y, n);
    if (sb.handles?.length) {
      y = subheading(doc, "Handles", y);
      y = bullets(doc, sb.handles, y);
    }
    if (sb.politelyDeclines?.length) {
      y = subheading(doc, "Politely Declines", y);
      y = bullets(doc, sb.politelyDeclines, y);
    }
    if (sb.hardRefuses?.length) {
      y = subheading(doc, "Hard Refuses", y);
      y = bullets(doc, sb.hardRefuses, y);
    }
    y = spacer(y, 4);
  }

  // 10. Scenarios
  const sc = briefData["scenarios"];
  if (sc?.items?.length) {
    n++;
    y = heading(doc, "Scenarios", y, n);
    for (const [i, s] of sc.items.entries()) {
      y = subheading(doc, `${i + 1}. ${s.title}`, y);
      // Category label
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...rgb(s.category === "Happy Path" ? C.green : s.category === "Edge Case" ? C.amber : C.red));
      doc.text(s.category.toUpperCase(), ML + doc.getTextWidth(`${i + 1}. ${s.title}`) + 14, y - 5.5);
      y = para(doc, `User: "${s.userMessage}"`, y, { bold: true });
      y = para(doc, `Expected: "${s.expectedResponse}"`, y, { italic: true, color: C.s500 });
      y = spacer(y, 3);
    }
    y = spacer(y, 4);
  }

  // 11. Evaluation Tests
  const ev = briefData["evaluation-tests"];
  if (ev?.items?.length) {
    n++;
    y = heading(doc, "Evaluation Tests", y, n);
    y = table(doc, ["Test", "Input", "Expected", "Scoring", "Status"],
      ev.items.map((t: any) => [t.name, t.input, t.expectedOutput, t.scoringMethod, t.status]), y);
    y = spacer(y, 4);
  }

  // 12. Open Questions
  const oq = briefData["open-questions"];
  if (oq?.items?.length) {
    n++;
    y = heading(doc, "Open Questions", y, n);
    for (const q of oq.items) {
      y = needPage(doc, y, 10);
      const resolved = q.status === "resolved";
      doc.setFillColor(...rgb(resolved ? C.navyBg : C.s50));
      doc.roundedRect(ML, y - 3, CW, 14, 1.5, 1.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...rgb(C.s900));
      doc.text(doc.splitTextToSize(q.question, CW - 10)[0], ML + 4, y + 2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...rgb(C.s500));
      doc.text(`${q.assignee}${resolved ? `  ·  ${q.resolution}` : ""}`, ML + 4, y + 7);
      y += 18;
    }
  }

  // ── Headers & footers on all pages ──
  addHeadersFooters(doc, agent.name);

  doc.save(`${agent.name.replace(/\s+/g, "_")}_Brief.pdf`);
}
