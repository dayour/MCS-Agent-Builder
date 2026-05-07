import { AgentConfig, ConfigSnapshot, ConfigDiffEntry } from '../types';

/** Capture a point-in-time snapshot of the fields relevant for eval context. */
export function snapshotConfig(config: AgentConfig): ConfigSnapshot {
  return {
    name: config.name,
    channel: config.channel,
    knowledge: {
      webSearch: config.knowledge.webSearch,
      specificSources: config.knowledge.specificSources,
      referenceOrgChart: config.knowledge.referenceOrgChart,
      fileCount: config.knowledge.files.length,
      fileNames: config.knowledge.files.map(f => f.name),
    },
    capabilities: (config.capabilities || []).map(c => c.name),
    guidelines: [...config.guidelines],
    skills: [...config.skills],
    hasInstructions: !!config.instructions,
    instructionLength: config.instructions.length,
  };
}

/** Return the fields that changed between two config snapshots. */
export function computeConfigDiff(
  before: ConfigSnapshot,
  after: ConfigSnapshot,
): ConfigDiffEntry[] {
  const diffs: ConfigDiffEntry[] = [];

  if (before.name !== after.name) {
    diffs.push({ field: 'name', label: 'Name', before: before.name, after: after.name });
  }
  if ((before.channel ?? '') !== (after.channel ?? '')) {
    diffs.push({ field: 'channel', label: 'Channel', before: before.channel || '', after: after.channel || '' });
  }
  if (before.knowledge.webSearch !== after.knowledge.webSearch) {
    diffs.push({ field: 'webSearch', label: 'Web Search', before: String(before.knowledge.webSearch), after: String(after.knowledge.webSearch) });
  }
  if (before.knowledge.specificSources !== after.knowledge.specificSources) {
    diffs.push({ field: 'specificSources', label: 'Specific Sources', before: String(before.knowledge.specificSources), after: String(after.knowledge.specificSources) });
  }
  if (before.knowledge.fileCount !== after.knowledge.fileCount) {
    diffs.push({ field: 'fileCount', label: 'Files', before: String(before.knowledge.fileCount), after: String(after.knowledge.fileCount) });
  }
  if (JSON.stringify(before.capabilities) !== JSON.stringify(after.capabilities)) {
    diffs.push({ field: 'capabilities', label: 'Capabilities', before: before.capabilities.join(', '), after: after.capabilities.join(', ') });
  }
  if (JSON.stringify(before.guidelines) !== JSON.stringify(after.guidelines)) {
    diffs.push({ field: 'guidelines', label: 'Guidelines', before: before.guidelines.join('; '), after: after.guidelines.join('; ') });
  }
  if (before.instructionLength !== after.instructionLength) {
    diffs.push({ field: 'instructions', label: 'Instructions', before: `${before.instructionLength} chars`, after: `${after.instructionLength} chars` });
  }

  return diffs;
}
