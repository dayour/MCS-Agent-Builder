import { AgentConfig } from '../../../../types';

export interface InstructionReferenceToken {
  raw: string;
  value: string;
  isTool: boolean;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function countMatches(text: string, pattern: RegExp): number {
  return Array.from(text.matchAll(pattern)).length;
}

export function extractInstructionReferences(text: string): InstructionReferenceToken[] {
  return Array.from(text.matchAll(/\[\[([^\]]+)\]\]/g)).map(match => {
    const value = match[1].trim();
    return {
      raw: match[0],
      value: value.startsWith('Tool: ') ? value.slice(6).trim() : value,
      isTool: value.startsWith('Tool: '),
    };
  });
}

export function getInstructionSyntaxErrors(text: string): string[] {
  const errors: string[] = [];

  if (countMatches(text, /\{\{/g) !== countMatches(text, /\}\}/g)) {
    errors.push('Instructions contain unclosed curly braces');
  }

  if (countMatches(text, /\[\[/g) !== countMatches(text, /\]\]/g)) {
    errors.push('Instructions contain unclosed double-bracket references');
  }

  if (/\{\{icon:\s*\}\}/i.test(text)) {
    errors.push('A trigger icon token is missing its icon key');
  }

  if (/\{\{icon:[^}]+\}\}(?!\s*\[\[)/i.test(text)) {
    errors.push('A trigger icon token must be followed by a trigger reference');
  }

  const unsupportedVariable = Array.from(text.matchAll(/\{\{([^}]+)\}\}/g)).find(match => !match[1].trim().toLowerCase().startsWith('icon:'));
  if (unsupportedVariable) {
    errors.push(`Unsupported variable syntax found in instructions: {{${unsupportedVariable[1].trim()}}}`);
  }

  return errors;
}

export function getMissingInstructionReferences(agent: AgentConfig): string[] {
  const references = extractInstructionReferences(agent.instructions ?? '');
  if (references.length === 0) return [];

  // TODO: Remove the placeholder-trigger exemption below (hasPendingPlaceholderTrigger +
  // triggerRefValues) once triggers are fully implemented by the triggers team. At that
  // point real trigger nodes will have resolved labels that match instruction references
  // through the normal configuredTriggers set, and no exemption is needed.
  // Also verify that the {{icon:...}} [[...]] instruction pattern is still the canonical
  // format for trigger tokens — if the syntax changes, update or remove the regex.
  //
  // If a placeholder trigger is pending, trigger-type references in instructions cannot
  // be resolved yet (the real channel label is unknown until confirmed). To avoid a
  // false-positive error, we identify trigger references by the {{icon:...}} [[...]]
  // pattern that the instruction editor enforces for trigger tokens — only those are
  // excused. Capability and knowledge references are still validated normally.
  // validateComponentConfiguration already flags the placeholder trigger separately.
  const hasPendingPlaceholderTrigger = (agent.workflowNodes ?? []).some(
    node => node.type === 'trigger' && node.placeholder,
  );
  const triggerRefValues: Set<string> = hasPendingPlaceholderTrigger
    ? new Set(
        Array.from((agent.instructions ?? '').matchAll(/\{\{icon:[^}]+\}\}\s*\[\[([^\]]+)\]\]/gi)).map(m =>
          normalize(m[1].trim()),
        ),
      )
    : new Set();

  const configuredCapabilities = new Set((agent.capabilities ?? []).map(capability => normalize(capability.name)));
  const configuredTools = new Set(
    (agent.capabilities ?? [])
      .filter(capability => capability.type === 'action' || capability.type === 'connector')
      .map(capability => normalize(capability.name)),
  );
  const configuredTriggers = new Set(
    [
      ...(agent.capabilities ?? [])
        .filter(capability => capability.type === 'trigger')
        .map(capability => capability.name),
      ...(agent.workflowNodes ?? [])
        .filter(node => node.type === 'trigger' && !node.placeholder)
        .map(node => node.label),
    ].map(normalize),
  );
  const configuredWorkflowNodes = new Set((agent.workflowNodes ?? []).map(node => normalize(node.label)));

  const missing = new Set<string>();
  references.forEach(reference => {
    const normalized = normalize(reference.value);
    if (!normalized || normalized === 'add a trigger') {
      missing.add(reference.value || reference.raw);
      return;
    }

    if (reference.isTool) {
      if (!configuredTools.has(normalized)) {
        missing.add(reference.value);
      }
      return;
    }

    if (configuredCapabilities.has(normalized) || configuredTriggers.has(normalized) || configuredWorkflowNodes.has(normalized)) {
      return;
    }

    // Reference is missing from all configured sources. If it is a trigger-typed
    // reference (identified by the {{icon:...}} [[...]] pattern) and a placeholder
    // trigger is pending, excuse it — the real trigger name is not yet resolvable.
    if (triggerRefValues.has(normalized)) return;

    missing.add(reference.value);
  });

  return Array.from(missing);
}
