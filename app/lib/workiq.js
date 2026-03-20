/**
 * WorkIQ CLI wrapper — pulls M365 customer context via WorkIQ.
 *
 * Spawns `workiq ask -q "..."` child processes to query emails, meetings,
 * Teams, SharePoint, and people. Assembles results into a consolidated
 * markdown file with a document version map for deduplication.
 */

const { spawn, execSync } = require("child_process");

// ───────────────────────────────────────────────────────────────────────────
// Availability check
// ───────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the `workiq` CLI is installed and responds to --version.
 */
async function isWorkIQAvailable() {
  try {
    const bin = process.platform === "win32"
      ? require("path").join(process.env.APPDATA || "", "npm", "workiq.cmd")
      : "workiq";
    execSync(`"${bin}" --version`, { stdio: "ignore", timeout: 5000, shell: true });
    return true;
  } catch {
    return false;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Query execution
// ───────────────────────────────────────────────────────────────────────────

/**
 * Run a single WorkIQ query. Returns { content, error }.
 * @param {string} question  Natural language question
 * @param {number} timeoutMs Kill the process after this many ms (default 120s)
 */
function runWorkIQQuery(question, timeoutMs = 120_000) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let killed = false;

    // Use execFile-style spawn (no shell) to avoid command injection from question text.
    // On Windows, resolve the full path to the workiq binary via npm prefix.
    const workiqBin = process.platform === "win32"
      ? require("path").join(process.env.APPDATA || "", "npm", "workiq.cmd")
      : "workiq";

    const child = spawn(workiqBin, ["ask", "-q", question], {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      killed = true;
      try { child.kill("SIGTERM"); } catch {}
      resolve({ content: "", error: `Query timed out after ${Math.round(timeoutMs / 1000)}s` });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ content: "", error: `Spawn error: ${err.message}` });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (killed) return; // already resolved via timeout

      const lower = (stderr + stdout).toLowerCase();
      if (lower.includes("sign in") || lower.includes("not authenticated") || lower.includes("authentication")) {
        resolve({
          content: "",
          error: "WorkIQ not authenticated. Run `workiq ask -q \"test\"` in a terminal to sign in.",
        });
        return;
      }

      if (code !== 0 && !stdout.trim()) {
        resolve({ content: "", error: `WorkIQ exited with code ${code}: ${stderr.trim().slice(0, 200)}` });
        return;
      }

      resolve({ content: stdout.trim(), error: null });
    });
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Query templates
// ───────────────────────────────────────────────────────────────────────────

const TIME_RANGE_LABELS = {
  "30d": "in the last 30 days",
  "90d": "in the last 90 days",
  "180d": "in the last 6 months",
  "1y": "in the last year",
};

/**
 * Build the 9 query objects for a customer pull.
 * @param {string} customer  Customer/company name
 * @param {string} timeRange "30d" | "90d" | "180d" | "1y"
 * @returns {Array<{id: number, label: string, question: string}>}
 */
function buildQueries(customer, timeRange) {
  const tr = TIME_RANGE_LABELS[timeRange] || TIME_RANGE_LABELS["90d"];

  return [
    {
      id: 1,
      label: "Overview",
      question: `Give me a comprehensive summary of everything related to ${customer} ${tr}. Include projects, discussions, decisions, pain points, and key people involved.`,
    },
    {
      id: 2,
      label: "Emails",
      question: `Find all emails mentioning ${customer} ${tr}. For each: date, participants, summary of decisions and action items. IMPORTANT: If any email has document attachments (SDR, specs, presentations), list the attachment name, date sent, and how it differs from or updates previous versions.`,
    },
    {
      id: 3,
      label: "Meetings",
      question: `Find all meetings about ${customer} or with ${customer} participants ${tr}. Summarize outcomes, decisions, action items, and technical discussions. Include dates and attendees. Note any documents or files shared during meetings.`,
    },
    {
      id: 4,
      label: "SharePoint SDR",
      question: `Find all Solution Discovery Reports and customer documents for ${customer} in the SharePoint site teams/CLSCMS/account. For each document list: exact file name, last modified date, modified by, version number if available, and a brief content summary. Sort by most recently modified first.`,
    },
    {
      id: 5,
      label: "Documents (broad)",
      question: `Find all documents, presentations, and files about ${customer} in SharePoint and OneDrive ${tr}, excluding the CLSCMS/account site. List each with: exact file name, location, last modified date, and brief content description.`,
    },
    {
      id: 6,
      label: "Teams",
      question: `Find all Teams messages and channel discussions mentioning ${customer} ${tr}. Summarize key conversations, decisions, and blockers. Note any shared file links with dates.`,
    },
    {
      id: 7,
      label: "People",
      question: `Who are the key people working with ${customer}? Include internal team members and external contacts. List their roles, involvement level, and how recently they've been active.`,
    },
    {
      id: 8,
      label: "Requirements",
      question: `Find any Solution Discovery Report, requirements document, use case document, or agent specification related to ${customer} ${tr}. Summarize key requirements, use cases, and technical details. If multiple versions exist, list each version with its date and what changed.`,
    },
    {
      id: 9,
      label: "Recent Activity",
      question: `What has happened with ${customer} in the last 30 days? Include recent emails, meetings, documents, Teams messages, and decisions. Focus on what changed or was decided most recently.`,
    },
  ];
}

// ───────────────────────────────────────────────────────────────────────────
// Deduplication
// ───────────────────────────────────────────────────────────────────────────

// Patterns that indicate a document reference in WorkIQ output
const DOC_PATTERNS = [
  /[\w\s-]+\.(?:docx|pptx|xlsx|pdf)/gi,
  /(?:SDR|Solution Discovery Report)[\w\s.-]*(?:v\d+)?/gi,
  /(?:Requirements|Specification|Use Case)[\w\s.-]*(?:v\d+)?/gi,
];

// Date patterns: 2026-03-15, March 15 2026, 03/15/2026, etc.
const DATE_PATTERN = /(\d{4}-\d{2}-\d{2}|\w+ \d{1,2},?\s*\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/g;

/**
 * Best-effort deduplication of document mentions across query results.
 * Scans all result content for document names and dates, builds a version map.
 *
 * @param {Array<{id: number, label: string, content: string, error: string|null}>} results
 * @returns {{ map: Array<{name, latestDate, latestSource, olderVersions: Array}>, annotations: Map<number, string[]> }}
 */
function deduplicateDocuments(results) {
  // Step 1: Extract all document mentions with source and approximate date
  const mentions = []; // { name, source, date, sourceId }

  for (const r of results) {
    if (!r.content) continue;

    for (const pattern of DOC_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(r.content)) !== null) {
        const name = match[0].trim();
        if (name.length < 5) continue; // too short to be meaningful

        // Try to find a date near this mention (within 200 chars)
        const start = Math.max(0, match.index - 200);
        const end = Math.min(r.content.length, match.index + match[0].length + 200);
        const context = r.content.slice(start, end);
        const dates = context.match(DATE_PATTERN);
        const date = dates ? dates[dates.length - 1] : null;

        mentions.push({ name, source: r.label, sourceId: r.id, date });
      }
    }
  }

  if (mentions.length === 0) return { map: [], annotations: new Map() };

  // Step 2: Group by normalized document name (fuzzy match)
  const groups = new Map(); // normalized name → [mentions]

  for (const m of mentions) {
    const key = m.name
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/v\d+/g, "")
      .replace(/\.(?:docx|pptx|xlsx|pdf)$/i, "")
      .trim();

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }

  // Step 3: For each group, determine latest version
  const map = [];
  const annotations = new Map(); // sourceId → [annotation strings]

  for (const [, group] of groups) {
    if (group.length < 2) continue; // no duplicates to resolve

    // Unique sources
    const sources = [...new Set(group.map((g) => g.source))];
    if (sources.length < 2) continue; // same source, not cross-source dup

    // Sort by date (parse best-effort), most recent first
    const sorted = group.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    const latest = sorted[0];
    const older = sorted.slice(1).filter((s) => s.source !== latest.source);

    if (older.length === 0) continue;

    map.push({
      name: latest.name,
      latestDate: latest.date || "unknown",
      latestSource: latest.source,
      olderVersions: older.map((o) => `${o.source} (${o.date || "unknown"})`),
    });

    // Build annotations for older sources
    for (const o of older) {
      if (!annotations.has(o.sourceId)) annotations.set(o.sourceId, []);
      annotations.get(o.sourceId).push(
        `[SUPERSEDED] "${o.name}" — newer version in ${latest.source} (${latest.date || "unknown"})`
      );
    }
  }

  return { map, annotations };
}

// ───────────────────────────────────────────────────────────────────────────
// Assembly
// ───────────────────────────────────────────────────────────────────────────

const SECTION_MAP = {
  1: "Overview",
  2: "Email History",
  3: "Meetings & Transcripts",
  4: "SharePoint SDR (CLSCMS)",
  5: "Documents & Files (Other)",
  6: "Teams Conversations",
  7: "Key People & Stakeholders",
  8: "Requirements & Specifications",
  9: "Recent Activity",
};

/**
 * Assemble the final consolidated markdown context file.
 *
 * @param {string} customer
 * @param {Array<{id, label, content, error}>} results
 * @param {string} timeRange
 * @param {{ map, annotations }} dedup
 * @returns {string} Markdown content
 */
function assembleContextFile(customer, results, timeRange, dedup) {
  const now = new Date().toISOString().slice(0, 10);
  const trLabel = TIME_RANGE_LABELS[timeRange] || timeRange;
  const successCount = results.filter((r) => !r.error && r.content).length;

  const lines = [];
  lines.push(`# Customer Context: ${customer}`);
  lines.push("");
  lines.push(`> Generated on ${now} via WorkIQ M365 search`);
  lines.push(`> Time range: ${trLabel} | Queries: ${successCount}/${results.length} successful`);
  lines.push("");

  // Document Version Map (dedup)
  if (dedup.map.length > 0) {
    lines.push("## Document Version Map");
    lines.push("");
    lines.push("> Multiple versions of some documents exist across SharePoint and email.");
    lines.push("> Use ONLY the latest version listed below.");
    lines.push("");
    lines.push("| Document | Latest Date | Source | Older versions found in |");
    lines.push("|----------|------------|--------|------------------------|");
    for (const entry of dedup.map) {
      lines.push(
        `| ${entry.name} | ${entry.latestDate} | ${entry.latestSource} | ${entry.olderVersions.join(", ")} |`
      );
    }
    lines.push("");
  }

  // Content sections
  const sorted = [...results].sort((a, b) => a.id - b.id);
  for (const r of sorted) {
    const heading = SECTION_MAP[r.id] || r.label;
    lines.push(`## ${heading}`);
    lines.push("");

    if (r.error) {
      lines.push(`> Query failed: ${r.error}`);
    } else if (!r.content) {
      lines.push("*No data found for this category.*");
    } else {
      // Add superseded annotations if any
      const anns = dedup.annotations.get(r.id);
      if (anns && anns.length > 0) {
        lines.push("> **Deduplication notes:**");
        for (const a of anns) lines.push(`> - ${a}`);
        lines.push("");
      }
      lines.push(r.content);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push(`*Pulled from M365 via WorkIQ on ${now}. Re-run "Pull from M365" to refresh.*`);
  lines.push("");

  return lines.join("\n");
}

module.exports = {
  isWorkIQAvailable,
  runWorkIQQuery,
  buildQueries,
  deduplicateDocuments,
  assembleContextFile,
};
