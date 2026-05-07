/**
 * Shared utilities for extracting and applying spec-patch blocks.
 * Used by both the SpecChatPane and the HelperAgent response parser.
 *
 * Spec-patch format (emitted by LLM inside markdown code fences):
 * ```spec-patch
 * { "sectionKey": { ...fields to merge... } }
 * ```
 *
 * Merge rules:
 * - Arrays are REPLACED (send the complete array)
 * - Objects are MERGED (only include fields to add/update)
 * - Scalars are set directly
 */

/** Extract spec-patch JSON blocks from assistant response text */
export function extractSpecPatches(text: string): Record<string, any>[] {
  const patches: Record<string, any>[] = [];
  const regex = /```spec-patch\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed && typeof parsed === 'object') {
        patches.push(parsed);
      }
    } catch {
      // Malformed JSON — skip silently
    }
  }
  return patches;
}

/** Remove spec-patch blocks from display text */
export function stripSpecPatches(text: string): string {
  return text.replace(/```spec-patch\s*\n[\s\S]*?```/g, '').trim();
}

/** Deep merge a patch into a spec object: arrays replace, objects merge */
export function applyPatch(spec: any, patch: Record<string, any>): any {
  const result = { ...(spec || {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'conversations' && value && typeof value === 'object') {
      // conversations has nested topics — merge at the conversations level
      result.conversations = { ...(result.conversations || {}), ...value };
    } else if (Array.isArray(value)) {
      result[key] = value;
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = { ...(result[key] || {}), ...value };
    } else {
      result[key] = value;
    }
  }
  return result;
}

/** Apply multiple patches sequentially */
export function applyPatches(spec: any, patches: Record<string, any>[]): any {
  let result = spec;
  for (const patch of patches) {
    result = applyPatch(result, patch);
  }
  return result;
}
