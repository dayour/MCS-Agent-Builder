/**
 * Translation layer between agentspec.json (server) and AgentConfig (runtime).
 *
 * specToAgentConfig: Produces a Partial<AgentConfig> from a loaded spec.
 * agentConfigToSpecPatch: Produces a spec-patch object from AgentConfig field changes.
 *
 * These are pure functions with no side effects.
 */

import type { AgentConfig, AgentCapability } from '../types';

// ── Spec → AgentConfig ─────────────────────────────────────────────────────

/**
 * Derive AgentConfig fields from a loaded agentspec.json.
 * Missing spec fields are handled gracefully — this works on partial specs.
 */
export function specToAgentConfig(
  spec: any,
  projectId: string,
  specAgentId: string,
): Partial<AgentConfig> {
  if (!spec) return { projectId, specAgentId, specData: spec };

  // Map capabilities: MVP items → AgentCapability
  const capabilities: AgentCapability[] = [];

  for (const cap of spec.capabilities || []) {
    if (cap.phase && cap.phase !== 'mvp') continue;
    capabilities.push({
      name: cap.name || '',
      description: cap.description || '',
      type: mapImplementationType(cap.implementationType),
    });
  }

  // Map triggers → trigger-type capabilities
  for (const trigger of spec.architecture?.triggers || []) {
    capabilities.push({
      name: trigger.type || trigger.description || 'Trigger',
      description: trigger.description || '',
      type: 'trigger',
    });
  }

  // Map integrations → connector/action capabilities (if not already covered)
  for (const integration of spec.integrations || []) {
    const alreadyCovered = capabilities.some(
      c => c.name === integration.name,
    );
    if (!alreadyCovered) {
      capabilities.push({
        name: integration.name || '',
        description: integration.purpose || '',
        type: integration.type === 'mcp' ? 'connector' : integration.type === 'connector' ? 'connector' : 'action',
      });
    }
  }

  // Map knowledge sources → knowledge config
  const knowledgeFiles = (spec.knowledge || []).map((k: any, i: number) => ({
    id: `spec-knowledge-${i}`,
    name: k.name || `Source ${i + 1}`,
    size: 0,
    type: k.type || 'File',
    uploadedAt: new Date(),
  }));

  // Map audience — prefer inferred top-level field, fall back to primaryUsers heuristic
  let audience: AgentConfig['audience'] = spec.audience ?? undefined;
  if (!audience) {
    const primaryUsers = spec.agent?.primaryUsers;
    if (typeof primaryUsers === 'string') {
      const lower = primaryUsers.toLowerCase();
      if (lower.includes('employee') || lower.includes('internal')) audience = 'employees';
      else if (lower.includes('customer') || lower.includes('external')) audience = 'customers';
      else if (lower.includes('personal')) audience = 'personal';
    }
  }

  // Map agentType (CA | DA | DW) — from inferred field; undefined if absent
  const agentType: AgentConfig['agentType'] =
    spec.agentType === 'CA' || spec.agentType === 'DA' || spec.agentType === 'DW'
      ? spec.agentType
      : undefined;

  // Map top-level type: 'agent' | 'workflow' | 'placeholder'.
  // BuildPageDispatcher routes on this + agentType.
  const topType: AgentConfig['type'] =
    spec.type === 'workflow' || spec.type === 'placeholder' ? spec.type : 'agent';

  return {
    type: topType,
    name: spec.agent?.name || '',
    description: spec.agent?.description || '',
    purpose: '',
    guidelines: [],
    skills: [],
    model: 'sonnet-4.6',
    instructions: spec.instructions || '',
    capabilities,
    channel: (spec.architecture?.channels || [])[0]?.name || undefined,
    audience,
    agentType,
    knowledge: {
      files: knowledgeFiles,
      webSearch: true,
      specificSources: true,
      referenceOrgChart: true,
      customAPIs: [],
    },
    published: false,
    projectId,
    specAgentId,
    specData: spec,
  };
}

function mapImplementationType(implType: string | undefined): AgentCapability['type'] {
  switch (implType) {
    case 'knowledge': return 'knowledge';
    case 'tool': case 'connector': case 'mcp': return 'connector';
    case 'flow': return 'action';
    case 'topic': return 'action';
    default: return 'action';
  }
}

// ── AgentConfig → Spec Patch ────────────────────────────────────────────────

/**
 * Produce a spec-patch object from AgentConfig field changes.
 * Only includes fields that have a spec equivalent.
 * Fields with no spec mapping are silently ignored.
 */
export function agentConfigToSpecPatch(
  updates: Partial<AgentConfig>,
  currentSpec: any,
): Record<string, any> {
  const patch: Record<string, any> = {};

  // Agent identity fields → spec.agent
  const agentPatch: Record<string, any> = {};
  if (updates.name !== undefined) agentPatch.name = updates.name;
  if (updates.description !== undefined) agentPatch.description = updates.description;
  if (Object.keys(agentPatch).length > 0) {
    patch.agent = agentPatch;
  }

  // Instructions
  if (updates.instructions !== undefined) {
    patch.instructions = updates.instructions;
  }

  // Capabilities → spec.capabilities array (full replace)
  if (updates.capabilities !== undefined) {
    const specCaps = updates.capabilities
      .filter(c => c.type !== 'trigger') // triggers go to architecture
      .map(c => ({
        name: c.name,
        description: c.description || '',
        phase: 'mvp',
        implementationType: reverseMapType(c.type),
      }));

    // Preserve any existing 'future' phase capabilities from current spec
    const futureCaps = (currentSpec?.capabilities || []).filter(
      (c: any) => c.phase === 'future',
    );

    patch.capabilities = [...specCaps, ...futureCaps];

    // Triggers extracted from capabilities → spec.architecture.triggers
    const triggerCaps = updates.capabilities.filter(c => c.type === 'trigger');
    if (triggerCaps.length > 0) {
      patch.architecture = {
        ...(currentSpec?.architecture || {}),
        triggers: triggerCaps.map(t => ({
          type: t.name,
          description: t.description || '',
        })),
      };
    }
  }

  // Channel → spec.architecture.channels
  if (updates.channel !== undefined) {
    const existingArch = patch.architecture || currentSpec?.architecture || {};
    patch.architecture = {
      ...existingArch,
      channels: [{ name: updates.channel, reason: '' }],
    };
  }

  return patch;
}

function reverseMapType(type: AgentCapability['type']): string {
  switch (type) {
    case 'knowledge': return 'knowledge';
    case 'connector': return 'tool';
    case 'action': return 'prompt';
    case 'agent': return 'prompt';
    case 'trigger': return 'prompt';
    default: return 'prompt';
  }
}
