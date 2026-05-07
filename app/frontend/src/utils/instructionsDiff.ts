/**
 * LCS-based line diff + word-level character diff for HA review highlights.
 *
 * computeInstructionsDiff(oldText, newText) returns a DiffLine[] where:
 *   - 'keep'  lines are unchanged
 *   - 'add'   lines are new/modified (charSegments present when paired with a del)
 *   - 'del'   lines were removed (shown as strikethrough)
 *
 * Pairing strategy: for each del/add run, lines are paired positionally up to
 * min(dels, adds). Pairs with Jaccard token similarity >= MIN_PAIR_SIMILARITY
 * get word-level charDiff (del absorbed into charSegments). Dissimilar pairs
 * and unmatched lines are emitted as standalone del/add entries.
 */

export type CharSegment = { type: 'keep' | 'add' | 'del'; text: string };

export type DiffLine =
  | { type: 'keep'; text: string }
  | { type: 'add'; text: string; charSegments?: CharSegment[] }
  | { type: 'del'; text: string };

// ─── LCS DP table ─────────────────────────────────────────────────────────────

function lcsMatrix(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp;
}

type RawOp = { op: 'keep' | 'add' | 'del'; text: string };

function backtrace(dp: number[][], a: string[], b: string[]): RawOp[] {
  const result: RawOp[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.push({ op: 'keep', text: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ op: 'add', text: b[j - 1] });
      j--;
    } else {
      result.push({ op: 'del', text: a[i - 1] });
      i--;
    }
  }
  return result.reverse();
}

// ─── Word-level char diff ─────────────────────────────────────────────────────

function charDiff(oldLine: string, newLine: string): CharSegment[] {
  // Split by whitespace boundaries, preserving the whitespace tokens themselves.
  const oldTokens = oldLine.split(/(\s+)/);
  const newTokens = newLine.split(/(\s+)/);
  const dp = lcsMatrix(oldTokens, newTokens);
  const ops = backtrace(dp, oldTokens, newTokens);
  // Pass 1: merge consecutive same-type segments from the raw token ops.
  const merged: CharSegment[] = [];
  for (const op of ops) {
    const last = merged[merged.length - 1];
    if (last && last.type === op.op) {
      merged[merged.length - 1] = { type: last.type, text: last.text + op.text };
    } else {
      merged.push({ type: op.op, text: op.text });
    }
  }
  // Pass 2: absorb whitespace-only 'keep' segments sandwiched between two non-keep
  // segments. This merges fragmented highlights like [del:"old"] [keep:" "] [del:"words"]
  // into [del:"old words"] instead of showing gaps between highlighted words.
  // The normal same-type merge handles any adjacency created by absorption.
  const result: CharSegment[] = [];
  for (let i = 0; i < merged.length; i++) {
    const seg = merged[i];
    const last = result[result.length - 1];
    if (
      seg.type === 'keep' &&
      /^\s+$/.test(seg.text) &&
      last && last.type !== 'keep' &&
      i + 1 < merged.length && merged[i + 1].type !== 'keep'
    ) {
      // Absorb whitespace into preceding segment.
      result[result.length - 1] = { type: last.type, text: last.text + seg.text };
    } else if (last && last.type === seg.type) {
      // Normal merge — also handles post-absorption adjacency.
      result[result.length - 1] = { type: last.type, text: last.text + seg.text };
    } else {
      result.push(seg);
    }
  }
  return result;
}

// ─── Similarity ───────────────────────────────────────────────────────────────

// Minimum Jaccard token similarity to pair a del line with an add line for
// word-level diff. Below this threshold the lines are treated as unrelated
// and emitted as separate del + add (whole-line highlight).
const MIN_PAIR_SIMILARITY = 0.15;

// Minimum fraction of non-space characters that must be unchanged for
// word-level charSegments to be worth showing. Below this the line is so
// thoroughly rewritten that fragmented individual-word highlights are worse
// than a single whole-line highlight.
const MIN_KEEP_CHAR_RATIO = 0.35;

function isMeaningfulCharDiff(segments: CharSegment[]): boolean {
  let keepChars = 0;
  let totalChars = 0;
  for (const seg of segments) {
    const nonSpace = seg.text.replace(/\s/g, '').length;
    if (seg.type === 'keep') keepChars += nonSpace;
    totalChars += nonSpace;
  }
  if (totalChars === 0) return false;
  return keepChars / totalChars >= MIN_KEEP_CHAR_RATIO;
}

function tokenSimilarity(a: string, b: string): number {
  const tokA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const tokB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (tokA.size === 0 && tokB.size === 0) return 1;
  if (tokA.size === 0 || tokB.size === 0) return 0;
  let intersect = 0;
  tokA.forEach(t => { if (tokB.has(t)) intersect++; });
  return intersect / (tokA.size + tokB.size - intersect);
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function computeInstructionsDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const dp = lcsMatrix(oldLines, newLines);
  const raw = backtrace(dp, oldLines, newLines);

  const result: DiffLine[] = [];
  let i = 0;
  while (i < raw.length) {
    if (raw[i].op === 'del') {
      // Collect consecutive del run.
      const delStart = i;
      while (i < raw.length && raw[i].op === 'del') i++;
      const delRun = raw.slice(delStart, i);

      // Collect consecutive add run (may be empty).
      const addStart = i;
      while (i < raw.length && raw[i].op === 'add') i++;
      const addRun = raw.slice(addStart, i);

      // Pair positionally up to min(del, add) length.
      const pairCount = Math.min(delRun.length, addRun.length);

      for (let p = 0; p < pairCount; p++) {
        const sim = tokenSimilarity(delRun[p].text, addRun[p].text);
        if (sim >= MIN_PAIR_SIMILARITY) {
          // Similar enough: try word-level diff, but fall back to whole-line
          // highlight if shared non-space content is too sparse (e.g. heavily
          // rewritten line where only spaces are in common).
          const segments = charDiff(delRun[p].text, addRun[p].text);
          if (isMeaningfulCharDiff(segments)) {
            result.push({ type: 'add', text: addRun[p].text, charSegments: segments });
          } else {
            // Too heavily rewritten for word-level diff — whole-line highlight.
            result.push({ type: 'del', text: delRun[p].text });
            result.push({ type: 'add', text: addRun[p].text });
          }
        } else {
          // Unrelated lines: keep as separate del + add (whole-line highlight).
          // Pushing del immediately before its add means the renderer shows the
          // deleted line just above the corresponding added line.
          result.push({ type: 'del', text: delRun[p].text });
          result.push({ type: 'add', text: addRun[p].text });
        }
      }

      // Unpaired adds (more adds than dels) — pure additions.
      for (let p = pairCount; p < addRun.length; p++) {
        result.push({ type: 'add', text: addRun[p].text });
      }

      // Unpaired dels (more dels than adds) — emitted after the add block so
      // the renderer attaches them to the next keep/add line, preserving their
      // approximate position relative to the surrounding content.
      for (let p = pairCount; p < delRun.length; p++) {
        result.push({ type: 'del', text: delRun[p].text });
      }
    } else if (raw[i].op === 'add') {
      result.push({ type: 'add', text: raw[i].text });
      i++;
    } else {
      result.push({ type: 'keep', text: raw[i].text });
      i++;
    }
  }

  return result;
}

// ─── Streaming highlight (no LCS) ─────────────────────────────────────────────
// During the streaming animation the full target text isn't visible yet, and
// edits scattered in the middle produce virtually no animation frames anyway
// (charsToAdd ≈ 0). For the common case — new content appended at the end —
// we just mark everything beyond startText.length as 'add'. No O(n*m) cost.
export function buildStreamingDiff(startText: string, newText: string): DiffLine[] {
  const keepPart = newText.slice(0, startText.length);
  const addPart = newText.slice(startText.length);

  const keepLines = keepPart.split('\n');
  const addLines = addPart.split('\n');

  const result: DiffLine[] = keepLines.slice(0, -1).map(t => ({ type: 'keep' as const, text: t }));

  // The boundary: last keep segment + first add segment may share a line.
  const boundaryLine = keepLines[keepLines.length - 1] + addLines[0];
  result.push(
    addLines[0].length > 0
      ? { type: 'add' as const, text: boundaryLine }
      : { type: 'keep' as const, text: boundaryLine }
  );

  for (let i = 1; i < addLines.length; i++) {
    result.push({ type: 'add' as const, text: addLines[i] });
  }

  return result;
}
