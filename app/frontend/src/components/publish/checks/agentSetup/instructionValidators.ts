import { AgentConfig } from '../../../../types';
import { CheckDetail } from '../../types';
import { MAX_INSTRUCTION_LENGTH, PLACEHOLDER_PATTERNS } from './constants';
import { getInstructionSyntaxErrors, getMissingInstructionReferences } from './instructionParsing';

const HTML_TAG_RE = /<\s*\/?\s*[a-z][^>]*>/i;

export function validateInstructionPresence(agent: AgentConfig): CheckDetail {
  const text = (agent.instructions ?? '').trim();

  if (!text) {
    return {
      label: 'Instructions present',
      status: 'failed',
      message: 'Instructions are empty — add operating instructions before publishing',
    };
  }

  return { label: 'Instructions present', status: 'passed' };
}

export function validateInstructionPlaceholderText(agent: AgentConfig): CheckDetail {
  const text = (agent.instructions ?? '').trim();
  if (!text) return { label: 'Instruction content', status: 'passed' };

  const firstLine = text.split('\n')[0].trim();
  const looksLikePlaceholder = PLACEHOLDER_PATTERNS.some(pattern => pattern.test(firstLine))
    || PLACEHOLDER_PATTERNS.some(pattern => pattern.test(text));

  if (looksLikePlaceholder) {
    return {
      label: 'Instruction content',
      status: 'warning',
      message: 'Instructions appear to contain placeholder or accidental text',
    };
  }

  return { label: 'Instruction content', status: 'passed' };
}

export function validateInstructionCharacters(agent: AgentConfig): CheckDetail {
  const text = agent.instructions ?? '';
  if (!text) return { label: 'Instruction characters', status: 'passed' };

  if (HTML_TAG_RE.test(text)) {
    return {
      label: 'Instruction characters',
      status: 'failed',
      message: 'Instructions contain unsupported HTML-like tags',
    };
  }

  return { label: 'Instruction characters', status: 'passed' };
}

export function validateInstructionSyntax(agent: AgentConfig): CheckDetail {
  const text = agent.instructions ?? '';
  if (!text.trim()) return { label: 'Instruction syntax', status: 'passed' };

  const syntaxErrors = getInstructionSyntaxErrors(text);
  if (syntaxErrors.length > 0) {
    return {
      label: 'Instruction syntax',
      status: 'failed',
      message: syntaxErrors[0],
    };
  }

  return { label: 'Instruction syntax', status: 'passed' };
}

export function validateInstructionReferences(agent: AgentConfig): CheckDetail {
  const text = agent.instructions ?? '';
  if (!text.trim()) return { label: 'Instruction references', status: 'passed' };

  const missingReferences = getMissingInstructionReferences(agent);
  if (missingReferences.length > 0) {
    return {
      label: 'Instruction references',
      status: 'failed',
      message: `Instructions reference components that are not configured: ${missingReferences.join(', ')}`,
    };
  }

  return { label: 'Instruction references', status: 'passed' };
}

export function validateInstructionLength(agent: AgentConfig): CheckDetail {
  const text = agent.instructions ?? '';
  if (text.length > MAX_INSTRUCTION_LENGTH) {
    return {
      label: 'Instruction length',
      status: 'failed',
      message: `Instructions exceed the publish safety limit of ${MAX_INSTRUCTION_LENGTH} characters`,
    };
  }

  return { label: 'Instruction length', status: 'passed' };
}
