import { Skill } from '../types';

/**
 * Converts a kebab-case or snake_case skill name to display sentence case.
 * Preserves acronyms and proper nouns already in the original name.
 * e.g. "send-candidate-decline-email" → "Send candidate decline email"
 *      "process_SharePoint_data"      → "Process SharePoint data"
 */
export function toSentenceCase(name: string): string {
  const words = name.split(/[-_]+/);
  if (words.length === 0) return name;
  // Only lowercase the first token so that words like "SharePoint" stay intact
  const first = words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase();
  return [first, ...words.slice(1)].join(' ');
}

/**
 * Sanitizes a script file name to prevent path traversal.
 * Strips leading separators, collapses ../ segments, and ensures
 * the result stays within the skill folder.
 */
export function sanitizeScriptName(name: string): string {
  // Normalize separators, collapse dot-dot segments, strip leading slashes
  const parts = name.replace(/\\/g, '/').split('/').filter(Boolean);
  const safe: string[] = [];
  for (const part of parts) {
    if (part === '..') continue; // drop traversal
    if (part === '.') continue;
    safe.push(part);
  }
  return safe.join('/') || 'script.txt';
}

/**
 * Safely quotes a value for inclusion as a YAML scalar or key.
 * Uses JSON stringification, which produces a valid double-quoted scalar in YAML.
 */
function yamlQuote(value: unknown): string {
  return JSON.stringify(String(value));
}

/**
 * Generates the SKILL.md content string for a skill,
 * following the Anthropic skill protocol format.
 */
export function generateSkillMarkdown(skill: Skill): string {
  const lines: string[] = ['---'];
  lines.push(`name: ${yamlQuote(skill.name)}`);
  lines.push(`description: ${yamlQuote(skill.description)}`);
  if (skill.license) lines.push(`license: ${yamlQuote(skill.license)}`);
  if (skill.allowedTools) lines.push(`allowed-tools: ${yamlQuote(skill.allowedTools)}`);
  if (skill.dependencies) lines.push(`dependencies: ${yamlQuote(skill.dependencies)}`);
  if (skill.metadata && Object.keys(skill.metadata).length > 0) {
    lines.push('metadata:');
    for (const [key, value] of Object.entries(skill.metadata)) {
      lines.push(`  ${yamlQuote(key)}: ${yamlQuote(value)}`);
    }
  }
  lines.push('---');
  lines.push('');
  lines.push(skill.body);
  return lines.join('\n');
}

/**
 * Downloads the skill as a ZIP archive containing the skill folder
 * with SKILL.md at the root, following the Anthropic packaging spec.
 *
 * Uses a pure-JS approach (no external dependencies) by constructing
 * a minimal ZIP file manually.
 */
export async function downloadSkillZip(skill: Skill): Promise<void> {
  const markdown = generateSkillMarkdown(skill);
  const folderName = skill.name;
  const encoder = new TextEncoder();

  const files: Array<{ path: string; data: Uint8Array }> = [
    { path: `${folderName}/SKILL.md`, data: encoder.encode(markdown) },
  ];

  // Bundle any scripts as sibling files inside the skill folder
  if (skill.scripts?.length) {
    for (const script of skill.scripts) {
      files.push({ path: `${folderName}/${sanitizeScriptName(script.name)}`, data: encoder.encode(script.content) });
    }
  }

  // Build a minimal ZIP file manually (no external lib needed)
  const zip = buildZip(files);
  const blob = new Blob([zip], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${folderName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// ── Minimal ZIP builder ────────────────────────────────────────────────────
// Implements just enough of the ZIP spec (PKWARE v2.0, stored/no compression)
// to produce a valid single-file ZIP that Claude.ai and Claude Code can unzip.

function buildZip(files: Array<{ path: string; data: Uint8Array }>): Uint8Array {
  const localHeaders: Uint8Array[] = [];
  const centralHeaders: Uint8Array[] = [];
  const offsets: number[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.path);
    const crc = crc32(file.data);
    const size = file.data.length;
    const date = dosDateTime(new Date());

    // Local file header
    const local = new Uint8Array(30 + nameBytes.length + size);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);  // signature
    lv.setUint16(4, 20, true);           // version needed
    lv.setUint16(6, 0, true);            // flags
    lv.setUint16(8, 0, true);            // compression: stored
    lv.setUint16(10, date.time, true);
    lv.setUint16(12, date.date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);        // compressed size
    lv.setUint32(22, size, true);        // uncompressed size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);           // extra field length
    local.set(nameBytes, 30);
    local.set(file.data, 30 + nameBytes.length);

    offsets.push(offset);
    offset += local.length;
    localHeaders.push(local);

    // Central directory header
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);  // signature
    cv.setUint16(4, 20, true);           // version made by
    cv.setUint16(6, 20, true);           // version needed
    cv.setUint16(8, 0, true);            // flags
    cv.setUint16(10, 0, true);           // compression
    cv.setUint16(12, date.time, true);
    cv.setUint16(14, date.date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);           // extra
    cv.setUint16(32, 0, true);           // comment
    cv.setUint16(34, 0, true);           // disk start
    cv.setUint16(36, 0, true);           // internal attr
    cv.setUint32(38, 0, true);           // external attr
    cv.setUint32(42, offsets[offsets.length - 1], true); // local header offset
    central.set(nameBytes, 46);
    centralHeaders.push(central);
  }

  const centralSize = centralHeaders.reduce((s, h) => s + h.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);   // end of central dir signature
  ev.setUint16(4, 0, true);             // disk number
  ev.setUint16(6, 0, true);             // disk with central dir
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);       // central dir offset
  ev.setUint16(20, 0, true);            // comment length

  const parts = [...localHeaders, ...centralHeaders, eocd];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) { out.set(p, pos); pos += p.length; }
  return out;
}

function dosDateTime(d: Date): { date: number; time: number } {
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  return { date, time };
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let j = 0; j < data.length; j++) {
    crc ^= data[j];
    for (let i = 0; i < 8; i++) {
      crc = (crc & 1) ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
