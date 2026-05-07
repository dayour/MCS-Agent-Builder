/**
 * Document conversion module.
 *
 * Replaces Python MarkItDown with pure-JS alternatives:
 * - docx → markdown: mammoth + turndown
 * - xlsx/xls → csv: xlsx (SheetJS)
 * - Encrypted detection: ZIP header check
 */

const fs = require("fs");
const path = require("path");

// Lazy-load heavy modules only when needed
let _mammoth, _TurndownService, _XLSX;

function getMammoth() {
  if (!_mammoth) _mammoth = require("mammoth");
  return _mammoth;
}

function getTurndown() {
  if (!_TurndownService) _TurndownService = require("turndown");
  return _TurndownService;
}

function getXLSX() {
  if (!_XLSX) _XLSX = require("xlsx");
  return _XLSX;
}

// ---------------------------------------------------------------------------
// Encrypted file detection
// ---------------------------------------------------------------------------

/**
 * Check if a file is a valid ZIP archive (docx/pptx/xlsx are ZIP-based).
 * Encrypted Office files are OLE2 containers, not ZIP.
 */
function isZipFile(filePath) {
  let fd;
  try {
    fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    // ZIP magic number: PK\x03\x04
    return buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
  } catch {
    return false;
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch {}
  }
}

/**
 * Check if an Office file is encrypted/protected.
 * Returns true if the file extension suggests ZIP but the content is not ZIP.
 */
function isEncryptedOfficeFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if ([".docx", ".pptx", ".xlsx"].includes(ext)) {
    return !isZipFile(filePath);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Conversion functions
// ---------------------------------------------------------------------------

/**
 * Convert a .docx file to markdown.
 * Returns the markdown text, or null on failure.
 */
async function docxToMarkdown(filePath) {
  const mammoth = getMammoth();
  const TurndownService = getTurndown();

  const result = await mammoth.convertToHtml({ path: filePath });
  if (!result.value || !result.value.trim()) return null;

  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });
  return turndown.turndown(result.value);
}

/**
 * Convert an .xlsx/.xls file to CSV.
 * Returns the CSV text, or null on failure.
 */
function excelToCsv(filePath) {
  const XLSX = getXLSX();
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return null;
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_csv(sheet);
}

// ---------------------------------------------------------------------------
// Main conversion entry point
// ---------------------------------------------------------------------------

/** File extensions that need conversion */
const NEEDS_CONVERSION = new Set([".docx", ".pptx", ".xlsx", ".xls"]);

/**
 * Convert a binary Office file to a readable format.
 *
 * @param {string} filePath - Path to the uploaded file
 * @param {string} docsDir - Directory where converted file should be saved
 * @returns {{ convertedName: string|null, error: string|null }}
 */
async function convertDocument(filePath, docsDir) {
  const ext = path.extname(filePath).toLowerCase();
  const baseName = path.basename(filePath, path.extname(filePath));

  if (!NEEDS_CONVERSION.has(ext)) {
    return { convertedName: null, error: null };
  }

  // Check for encrypted files
  if (isEncryptedOfficeFile(filePath)) {
    return {
      convertedName: null,
      error:
        "This file appears to be encrypted or protected (e.g. Microsoft Information " +
        "Protection). Please remove the protection in the original application and " +
        "re-upload, or paste the content as text instead.",
    };
  }

  try {
    if (ext === ".xlsx" || ext === ".xls") {
      const csv = excelToCsv(filePath);
      if (csv && csv.trim()) {
        const outName = `${baseName}.csv`;
        fs.writeFileSync(path.join(docsDir, outName), csv, "utf-8");
        // Delete original binary
        fs.unlinkSync(filePath);
        return { convertedName: outName, error: null };
      }
      return { convertedName: null, error: "No data extracted from spreadsheet" };
    }

    if (ext === ".docx") {
      const md = await docxToMarkdown(filePath);
      if (md && md.trim()) {
        const outName = `${baseName}.md`;
        fs.writeFileSync(path.join(docsDir, outName), md, "utf-8");
        // Delete original binary
        fs.unlinkSync(filePath);
        return { convertedName: outName, error: null };
      }
      return {
        convertedName: null,
        error: "No text extracted (file may be empty or password-protected)",
      };
    }

    if (ext === ".pptx") {
      // mammoth doesn't support pptx — keep original
      // Future: could use a pptx-specific library
      return {
        convertedName: null,
        error: "PowerPoint conversion not yet supported — file kept as-is",
      };
    }
  } catch (e) {
    return {
      convertedName: null,
      error: `Text extraction failed: ${String(e).slice(0, 200)}`,
    };
  }

  return { convertedName: null, error: null };
}

/**
 * Extract text content from a document for preview (on-demand).
 *
 * @param {string} filePath - Path to the document
 * @returns {{ content: string, error: string|null }}
 */
async function extractContent(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  // Text files: read directly
  if ([".md", ".csv", ".txt", ".json"].includes(ext)) {
    const content = fs.readFileSync(filePath, "utf-8");
    return { content, error: null };
  }

  // Binary Office docs: extract on demand
  if ([".docx", ".pptx", ".xlsx", ".xls"].includes(ext)) {
    if (isEncryptedOfficeFile(filePath)) {
      return {
        content: "",
        error: "This file is encrypted or protected and cannot be previewed.",
      };
    }

    try {
      if (ext === ".docx") {
        const md = await docxToMarkdown(filePath);
        return { content: md || "", error: null };
      }
      if (ext === ".xlsx" || ext === ".xls") {
        const csv = excelToCsv(filePath);
        return { content: csv || "", error: null };
      }
    } catch (e) {
      return { content: "", error: `Extraction failed: ${String(e).slice(0, 200)}` };
    }
  }

  return { content: "", error: null };
}

// ---------------------------------------------------------------------------
// Transcript Summarization — runs at upload time, replaces raw with digest
// ---------------------------------------------------------------------------

const TRANSCRIPT_SUMMARIZE_THRESHOLD = 50_000; // Only summarize transcripts > 50K chars

// Global queue — only one transcript summarization at a time to avoid rate limits
let _summarizeQueue = Promise.resolve();

/**
 * Summarize a transcript file into a structured digest.
 * Replaces the file in-place. If summarization fails, keeps the original.
 *
 * @param {string} filePath - Path to the transcript file in docs/
 * @returns {{ summarized: boolean, error: string|null, originalSize: number, digestSize: number }}
 */
async function summarizeTranscript(filePath) {
  // Serialize — only one transcript at a time to respect rate limits
  const result = await new Promise((resolve) => {
    _summarizeQueue = _summarizeQueue.then(() => _doSummarizeTranscript(filePath)).then(resolve, resolve);
  });
  return result;
}

async function _doSummarizeTranscript(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const originalSize = content.length;

  if (originalSize < TRANSCRIPT_SUMMARIZE_THRESHOLD) {
    return { summarized: false, error: null, originalSize, digestSize: originalSize };
  }

  // Lazy-load anthropic API (avoid circular deps at module level)
  let anthropicApi;
  try {
    anthropicApi = require("../../tools/lib/anthropic");
  } catch {
    return { summarized: false, error: "Anthropic API not available", originalSize, digestSize: originalSize };
  }

  if (!anthropicApi.isConfigured()) {
    return { summarized: false, error: "Claude API not configured", originalSize, digestSize: originalSize };
  }

  const systemPrompt = `You are an expert at extracting structured, actionable information from meeting transcripts for Microsoft Copilot Studio agent design.

Your job: transform a raw meeting transcript into a structured digest that captures EVERY piece of useful information while removing all noise (greetings, small talk, filler words, repetition, off-topic tangents, "um/uh", screen-sharing narration).

Output format — use these exact markdown sections. Include ALL items found, not just highlights:

# Transcript Digest
**Meeting:** [topic/title if mentioned]
**Participants:** [names/roles if identifiable]
**Date:** [if mentioned]

## Decisions Made
- [DECIDED] statement — Speaker: name (if known)

## Capability Requests
- "verbatim or near-verbatim quote of what they want the agent to do" — Speaker, timestamp if available
- Include implicit requests (pain points that imply a capability)

## Requirements
- Explicit requirement or constraint mentioned
- Include compliance, security, process, approval requirements

## Integration & System Mentions
- System name — what role it plays, how it connects
- Include APIs, databases, existing tools, manual processes to replace

## Boundaries & Scope
- What the agent should handle
- What it should NOT handle (explicit exclusions)
- Handoff points (agent → human)

## Pain Points & Motivations
- "quote or paraphrase of the problem" — Speaker
- Include time/cost impact if mentioned

## Open Questions & Ambiguities
- Question or unresolved point — context
- Include disagreements between participants

## Action Items
- Action — Owner (if assigned), deadline (if mentioned)

Rules:
- Be EXHAUSTIVE — every decision, requirement, capability request, system mention matters
- Preserve speaker attribution where possible
- Preserve approximate timestamps or sequence ("early in call", "after demo")
- If something is uncertain or disputed, note it in Open Questions
- Do NOT invent information not in the transcript
- Do NOT summarize into high-level bullet points — keep the detail
- Output should be 2000-6000 words depending on transcript richness`;

  // For very large transcripts, chunk and process sequentially
  // Copilot passthrough has strict TPM limits — keep chunks small and pace requests
  const MAX_CHUNK = 200_000; // ~50K tokens per chunk — safe for Copilot rate limits
  const DELAY_BETWEEN_CHUNKS_MS = 5000; // 5s cooldown between calls
  const chunks = [];
  for (let i = 0; i < content.length; i += MAX_CHUNK) {
    chunks.push(content.slice(i, i + MAX_CHUNK));
  }

  console.log(`[transcript] ${(content.length / 1024).toFixed(0)}KB → ${chunks.length} chunk(s) of ~${(MAX_CHUNK / 1024).toFixed(0)}KB`);

  // Retry wrapper with long backoff for rate limits (Copilot TPM is strict)
  async function callWithRetry(msgs, attempt = 0) {
    const MAX_RETRIES = 4;
    const BACKOFF = [15_000, 30_000, 60_000, 90_000]; // 15s, 30s, 60s, 90s
    try {
      return await anthropicApi.chatCompletion(msgs, { model: "opus", maxTokens: 16384, timeout: 300_000, cacheSystem: true });
    } catch (err) {
      if (attempt < MAX_RETRIES && (err.message?.includes("429") || err.message?.includes("rate_limit"))) {
        const delay = BACKOFF[attempt];
        console.log(`[transcript] Rate limited — waiting ${delay / 1000}s before retry ${attempt + 1}/${MAX_RETRIES}...`);
        await new Promise(r => setTimeout(r, delay));
        return callWithRetry(msgs, attempt + 1);
      }
      throw err;
    }
  }

  try {
    let digest;
    if (chunks.length === 1) {
      // Single pass
      const result = await callWithRetry([
        { role: "system", content: systemPrompt },
        { role: "user", content: `Summarize this meeting transcript into a structured digest:\n\n${chunks[0]}` },
      ]);
      digest = result.content;
    } else {
      // Multi-pass — sequential with cooldown, then merge
      const chunkDigests = [];

      for (let i = 0; i < chunks.length; i++) {
        console.log(`[transcript] Processing chunk ${i + 1}/${chunks.length}...`);
        if (i > 0) await new Promise(r => setTimeout(r, DELAY_BETWEEN_CHUNKS_MS));

        const result = await callWithRetry([
          { role: "system", content: systemPrompt },
          { role: "user", content: `Summarize this section (part ${i + 1}/${chunks.length}) of a meeting transcript:\n\n${chunks[i]}` },
        ]);
        chunkDigests.push(result.content);
      }

      console.log(`[transcript] All ${chunks.length} chunks done — merging...`);

      // Merge pass
      const mergeResult = await callWithRetry([
        { role: "system", content: `You are merging multiple partial transcript digests into one cohesive structured digest. Deduplicate items, resolve contradictions, maintain chronological order. Use the same output format (Decisions, Capability Requests, Requirements, etc.). Be exhaustive — include everything from all parts.` },
        { role: "user", content: `Merge these ${chunkDigests.length} partial digests into one:\n\n${chunkDigests.join("\n\n---\n\n")}` },
      ]);
      digest = mergeResult.content;
    }

    if (!digest || digest.length < 500) {
      return { summarized: false, error: "Digest too short — keeping original", originalSize, digestSize: originalSize };
    }

    // Add provenance header
    const header = `<!-- Structured digest generated from raw transcript (${(originalSize / 1024).toFixed(0)}KB → ${(digest.length / 1024).toFixed(0)}KB) -->\n<!-- Generated: ${new Date().toISOString()} | Chunks: ${chunks.length} -->\n\n`;

    fs.writeFileSync(filePath, header + digest, "utf-8");
    return { summarized: true, error: null, originalSize, digestSize: digest.length };
  } catch (err) {
    return { summarized: false, error: `Summarization failed: ${err.message}`, originalSize, digestSize: originalSize };
  }
}

module.exports = {
  NEEDS_CONVERSION,
  isZipFile,
  isEncryptedOfficeFile,
  convertDocument,
  extractContent,
  docxToMarkdown,
  excelToCsv,
  summarizeTranscript,
};
