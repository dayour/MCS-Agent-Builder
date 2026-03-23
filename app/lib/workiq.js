/**
 * WorkIQ CLI wrapper — pulls M365 customer context via WorkIQ.
 *
 * Spawns `workiq ask -q "..."` child processes to query emails, meetings,
 * Teams, SharePoint, and people. Assembles results into a consolidated
 * markdown file with a document version map for deduplication.
 */

const { spawn, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { getToken } = require("../../tools/lib/http");
const { downloadFile, GRAPH_BASE } = require("../../tools/lib/graph-sharepoint");

// ───────────────────────────────────────────────────────────────────────────
// Availability check
// ───────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the `workiq` CLI is installed and responds to --version.
 */
async function isWorkIQAvailable() {
  try {
    const bin = process.platform === "win32"
      ? path.join(process.env.APPDATA || "", "npm", "workiq.cmd")
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

    // On Windows, `.cmd` files require shell or `cmd /c` to execute.
    // Using `cmd /c workiq` with question as a separate array element keeps
    // the question out of shell parsing (no injection risk).
    const args = process.platform === "win32"
      ? ["/c", "workiq", "ask", "-q", question]
      : ["ask", "-q", question];
    const cmd = process.platform === "win32" ? "cmd" : "workiq";

    const child = spawn(cmd, args, {
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

// ───────────────────────────────────────────────────────────────────────────
// SharePoint URL extraction
// ───────────────────────────────────────────────────────────────────────────

// Matches SharePoint/OneDrive document URLs in WorkIQ natural-language output.
// Covers standard URLs, sharing links (:w:/, :x:/, :p:/, :b:/), and -df variants.
const SP_URL_PATTERN = /https?:\/\/[\w.-]+\.sharepoint(?:-df)?\.com\/[^\s)>\]"']+/gi;

// File extensions we can download and potentially convert
const DOWNLOADABLE_EXTENSIONS = new Set([
  ".docx", ".xlsx", ".xls", ".pptx", ".pdf", ".csv", ".txt", ".md", ".json",
]);

/**
 * Extract unique SharePoint/OneDrive URLs from WorkIQ query results.
 * Filters to downloadable document types, deduplicates by URL.
 *
 * @param {Array<{id: number, label: string, content: string, error: string|null}>} results
 * @returns {Array<{url: string, source: string}>}
 */
function extractSharePointUrls(results) {
  const seen = new Set();
  const urls = [];

  for (const r of results) {
    if (!r.content) continue;

    SP_URL_PATTERN.lastIndex = 0;
    let match;
    while ((match = SP_URL_PATTERN.exec(r.content)) !== null) {
      let url = match[0];

      // Strip trailing punctuation that leaked from prose
      url = url.replace(/[.,;:!?)]+$/, "");

      if (seen.has(url)) continue;
      seen.add(url);

      // Check if URL points to a downloadable file type
      // SharePoint sharing links encode the extension in the path (:w: = docx, :x: = xlsx, :p: = pptx, :b: = pdf)
      const lower = url.toLowerCase();
      const hasFileExt = [...DOWNLOADABLE_EXTENSIONS].some((ext) => lower.includes(ext));
      const hasSharingCode = /\/:(?:[wxpb]):\//.test(lower);

      if (hasFileExt || hasSharingCode) {
        urls.push({ url, source: r.label });
      }
    }
  }

  return urls;
}

// ───────────────────────────────────────────────────────────────────────────
// Graph API file resolution + download
// ───────────────────────────────────────────────────────────────────────────

/**
 * Encode a SharePoint URL for the Graph /shares endpoint.
 * Format: "u!" + base64url(url)
 */
function encodeShareUrl(url) {
  const base64 = Buffer.from(url, "utf-8").toString("base64");
  const base64url = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `u!${base64url}`;
}

// Known SharePoint hostname → tenant ID map (expand as needed)
const SP_TENANT_MAP = {
  "microsoft.sharepoint.com": "72f988bf-86f1-41af-91ab-2d7cd011db47",
  "microsoft.sharepoint-df.com": "72f988bf-86f1-41af-91ab-2d7cd011db47",
  "microsoftapc.sharepoint.com": "72f988bf-86f1-41af-91ab-2d7cd011db47",
  "microsofteur.sharepoint.com": "72f988bf-86f1-41af-91ab-2d7cd011db47",
  "microsoft-my.sharepoint.com": "72f988bf-86f1-41af-91ab-2d7cd011db47",
  "microsoft-my.sharepoint-df.com": "72f988bf-86f1-41af-91ab-2d7cd011db47",
};

/**
 * Parse a SharePoint URL into components for Graph API resolution.
 *
 * @param {string} url  SharePoint URL
 * @returns {{ hostname, sitePath, filePath, fileName, sourcedocId, isSharingLink }}
 */
function parseSharePointUrl(url) {
  const parsed = new URL(url);
  const hostname = parsed.hostname;
  const pathname = decodeURIComponent(parsed.pathname);

  // Sharing link: /:w:/, /:x:/, /:p:/, /:b:/
  const isSharingLink = /\/:(?:[wxpb]):\//.test(pathname);

  // Doc.aspx with sourcedoc GUID
  const sourcedocMatch = parsed.searchParams.get("sourcedoc");
  const sourcedocId = sourcedocMatch ? sourcedocMatch.replace(/[{}]/g, "") : null;

  // Extract filename from 'file' param or from path
  const fileParam = parsed.searchParams.get("file");
  const fileName = fileParam
    ? decodeURIComponent(fileParam)
    : path.basename(pathname.replace(/\?.*$/, ""));

  // Extract site path — /teams/X, /sites/X, or /personal/X_domain_com
  const siteMatch = pathname.match(/^(\/(?:teams|sites|personal)\/[^/]+)/i);
  const sitePath = siteMatch ? siteMatch[1] : null;

  // Extract file path within the drive (after Shared Documents or similar)
  const drivePathMatch = pathname.match(/\/(?:Shared Documents|Documents|SiteAssets|account)\/(.+?)(?:\?|$)/i);
  const filePath = drivePathMatch ? drivePathMatch[1] : null;

  return { hostname, sitePath, filePath, fileName, sourcedocId, isSharingLink };
}

/**
 * Resolve a SharePoint URL to a Graph driveItem using multiple strategies:
 * 1. Sharing link → /shares endpoint
 * 2. Direct file path → /sites/{siteId}/drive/root:/{filePath}
 * 3. Doc.aspx with filename → /sites/{siteId}/drive/root/search(q='{name}')
 *
 * @param {string} token  Graph API access token
 * @param {string} url    SharePoint document URL
 * @returns {Promise<{id: string, name: string, driveId: string, size: number, mimeType: string}|null>}
 */
async function resolveSharePointUrl(token, url) {
  const { httpRequestWithRetry } = require("../../tools/lib/http");
  const parsed = parseSharePointUrl(url);
  const headers = { Authorization: `Bearer ${token}` };
  const select = "$select=id,name,size,file,parentReference";

  const extractItem = (data) => ({
    id: data.id,
    name: data.name || "unknown",
    driveId: data.parentReference?.driveId || "",
    size: data.size || 0,
    mimeType: data.file?.mimeType || "",
  });

  try {
    // Strategy 1: Sharing links → /shares endpoint
    if (parsed.isSharingLink) {
      const encoded = encodeShareUrl(url);
      const res = await httpRequestWithRetry("GET",
        `${GRAPH_BASE}/shares/${encoded}/driveItem?${select}`,
        headers, null, 2, 15000);
      if (res.status === 200) return extractItem(res.data);
    }

    // Get the site ID (needed for strategies 2 and 3)
    let siteId = null;
    if (parsed.sitePath) {
      // Normalize: microsoft-my.sharepoint.com → microsoft-my.sharepoint.com (personal sites)
      const siteHostname = parsed.hostname.replace("-df", "");
      const siteRes = await httpRequestWithRetry("GET",
        `${GRAPH_BASE}/sites/${siteHostname}:${parsed.sitePath}:`,
        headers, null, 1, 10000);
      if (siteRes.status === 200) siteId = siteRes.data.id;
    }

    // Strategy 2: Direct file path → /sites/{siteId}/drive/root:/{filePath}
    if (siteId && parsed.filePath) {
      const encodedPath = parsed.filePath.split("/").map(encodeURIComponent).join("/");
      const res = await httpRequestWithRetry("GET",
        `${GRAPH_BASE}/sites/${siteId}/drive/root:/${encodedPath}:?${select}`,
        headers, null, 1, 10000);
      if (res.status === 200 && res.data.id) return extractItem(res.data);
    }

    // Strategy 3: Search by filename within site drive
    if (siteId && parsed.fileName && parsed.fileName.length > 3) {
      const searchName = path.basename(parsed.fileName, path.extname(parsed.fileName));
      const res = await httpRequestWithRetry("GET",
        `${GRAPH_BASE}/sites/${siteId}/drive/root/search(q='${encodeURIComponent(searchName)}')?${select}&$top=5`,
        headers, null, 1, 15000);
      if (res.status === 200 && res.data.value?.length > 0) {
        // Prefer exact name match
        const exact = res.data.value.find((item) =>
          item.name?.toLowerCase() === parsed.fileName.toLowerCase()
        );
        return extractItem(exact || res.data.value[0]);
      }
    }

    // Strategy 4: Fallback — try shares endpoint even for non-sharing links
    if (!parsed.isSharingLink) {
      const encoded = encodeShareUrl(url);
      const res = await httpRequestWithRetry("GET",
        `${GRAPH_BASE}/shares/${encoded}/driveItem?${select}`,
        headers, null, 1, 10000);
      if (res.status === 200) return extractItem(res.data);
    }
  } catch {
    // All strategies exhausted
  }

  return null;
}

/**
 * Get a Graph token for a SharePoint hostname.
 * Maps known hostnames to tenant IDs. Only falls back to default tenant
 * for unknown hostnames (known tenants that fail = auth setup issue).
 *
 * @param {string} hostname  SharePoint hostname (e.g., "microsoft.sharepoint.com")
 * @returns {string|null} Access token or null if unavailable
 */
function getGraphTokenForHost(hostname) {
  const tenantId = SP_TENANT_MAP[hostname];

  if (tenantId) {
    // Known tenant — don't fall back to default (which is likely wrong)
    try {
      return getToken("https://graph.microsoft.com", tenantId);
    } catch {
      return null;
    }
  }

  // Unknown hostname — try default tenant (current az-login)
  try {
    return getToken("https://graph.microsoft.com");
  } catch {
    return null;
  }
}

/**
 * Download and convert SharePoint files found in WorkIQ results.
 *
 * @param {Array<{url: string, source: string}>} urls  Extracted SharePoint URLs
 * @param {string} docsDir  Target docs directory
 * @param {function} onProgress  SSE callback: (event) => void
 * @returns {Promise<Array<{name: string, converted: string|null, error: string|null}>>}
 */
async function downloadAndConvertFiles(urls, docsDir, onProgress) {
  if (urls.length === 0) return [];

  const { convertDocument } = require("./documents");

  // Group URLs by hostname and get tokens per host
  const tokenCache = new Map(); // hostname → token|null
  function getTokenForUrl(url) {
    try {
      const hostname = new URL(url).hostname;
      if (tokenCache.has(hostname)) return tokenCache.get(hostname);
      const token = getGraphTokenForHost(hostname);
      tokenCache.set(hostname, token);
      return token;
    } catch {
      return null;
    }
  }

  // Quick check: can we get at least one token?
  const firstToken = getTokenForUrl(urls[0].url);
  if (!firstToken) {
    const hostname = new URL(urls[0].url).hostname;
    const tenantId = SP_TENANT_MAP[hostname];
    onProgress({
      type: "download-skipped",
      reason: tenantId
        ? `Graph API auth needed for ${hostname}. Run: az login --tenant ${tenantId}`
        : `Graph API auth not available. Run \`az login\` to enable file downloads.`,
    });
    return [];
  }

  onProgress({
    type: "download-started",
    total: urls.length,
  });

  const results = [];
  const existingFiles = new Set(fs.readdirSync(docsDir).map((f) => f.toLowerCase()));

  for (let i = 0; i < urls.length; i++) {
    const { url, source } = urls[i];

    // Get token for this URL's host
    const token = getTokenForUrl(url);
    if (!token) {
      const hostname = new URL(url).hostname;
      results.push({ name: url, converted: null, error: `No auth for ${hostname}` });
      onProgress({
        type: "download-progress",
        index: i + 1,
        total: urls.length,
        url,
        status: "error",
        detail: `No auth for ${hostname}`,
      });
      continue;
    }

    onProgress({
      type: "download-progress",
      index: i + 1,
      total: urls.length,
      url,
      status: "resolving",
    });

    // Resolve URL to driveItem
    const item = await resolveSharePointUrl(token, url);
    if (!item || !item.driveId) {
      results.push({ name: url, converted: null, error: "Could not resolve SharePoint URL" });
      onProgress({
        type: "download-progress",
        index: i + 1,
        total: urls.length,
        url,
        status: "error",
        detail: "Could not resolve URL",
      });
      continue;
    }

    // Skip if file already exists in docs/
    const lowerName = item.name.toLowerCase();
    const ext = path.extname(lowerName);
    const baseName = path.basename(item.name, path.extname(item.name));
    const possibleConverted = ext === ".docx" ? `${baseName}.md`.toLowerCase()
      : (ext === ".xlsx" || ext === ".xls") ? `${baseName}.csv`.toLowerCase()
      : lowerName;

    if (existingFiles.has(lowerName) || existingFiles.has(possibleConverted)) {
      results.push({ name: item.name, converted: null, error: "Already exists in docs" });
      onProgress({
        type: "download-progress",
        index: i + 1,
        total: urls.length,
        name: item.name,
        status: "skipped",
        detail: "Already in docs",
      });
      continue;
    }

    // Skip large files (>50MB)
    if (item.size > 50 * 1024 * 1024) {
      results.push({ name: item.name, converted: null, error: `File too large: ${Math.round(item.size / 1024 / 1024)}MB` });
      onProgress({
        type: "download-progress",
        index: i + 1,
        total: urls.length,
        name: item.name,
        status: "skipped",
        detail: "Too large (>50MB)",
      });
      continue;
    }

    // Download
    const tempPath = path.join(docsDir, item.name);
    onProgress({
      type: "download-progress",
      index: i + 1,
      total: urls.length,
      name: item.name,
      status: "downloading",
    });

    try {
      await downloadFile(token, item.id, tempPath, item.driveId);
    } catch (err) {
      results.push({ name: item.name, converted: null, error: `Download failed: ${err.message}` });
      onProgress({
        type: "download-progress",
        index: i + 1,
        total: urls.length,
        name: item.name,
        status: "error",
        detail: `Download failed`,
      });
      continue;
    }

    // Convert if needed
    let convertedName = null;
    let convErr = null;
    try {
      const result = await convertDocument(tempPath, docsDir);
      convertedName = result.convertedName;
      convErr = result.error;
    } catch (convError) {
      convErr = `Conversion failed: ${String(convError).slice(0, 200)}`;
    }
    const finalName = convertedName || item.name;

    // Track the file
    existingFiles.add(finalName.toLowerCase());

    results.push({
      name: item.name,
      converted: convertedName,
      error: convErr,
    });

    onProgress({
      type: "download-progress",
      index: i + 1,
      total: urls.length,
      name: item.name,
      converted: convertedName,
      status: "done",
    });
  }

  const downloaded = results.filter((r) => !r.error || r.error === "Already exists in docs");
  onProgress({
    type: "download-done",
    total: urls.length,
    downloaded: downloaded.length,
    errors: results.filter((r) => r.error && r.error !== "Already exists in docs").length,
  });

  return results;
}

module.exports = {
  isWorkIQAvailable,
  runWorkIQQuery,
  buildQueries,
  deduplicateDocuments,
  assembleContextFile,
  extractSharePointUrls,
  downloadAndConvertFiles,
};
