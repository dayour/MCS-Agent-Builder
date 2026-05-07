/**
 * usePublish — Shared hook for publishing spec-backed agents to MCS.
 *
 * Used by MyStuffPage, NavAgentList, and any future publish trigger.
 * Wraps usePipelineJob('build') with canPublish checks, env validation,
 * and spec write-back for environment config.
 *
 * Usage:
 *   const publish = usePublish();
 *   const { ok, reason, warnings } = publish.canPublish(agent);
 *   await publish.startPublish(agent);
 */

import { useCallback, useState } from 'react';
import { usePipelineJob } from './usePipelineJob';
import type { AgentConfig } from '../types';

export interface CanPublishResult {
  ok: boolean;
  reason?: string;
  warnings?: string[];
  /** true if the agent needs environment selection before publish */
  needsEnvSelection?: boolean;
}

export interface EnvironmentConfig {
  name: string;
  id: string;
  url: string;
}

export function usePublish() {
  const buildJob = usePipelineJob('build');
  const [publishingAgentId, setPublishingAgentId] = useState<string | null>(null);

  const canPublish = useCallback((agent: AgentConfig): CanPublishResult => {
    // Must be spec-backed
    if (!agent.projectId || !agent.specAgentId) {
      return { ok: false, reason: 'Add to a project to publish to Copilot Studio' };
    }

    // Must have instructions
    if (!agent.instructions?.trim()) {
      return { ok: false, reason: 'Agent needs instructions before publishing' };
    }

    // Check for active build job
    if (buildJob.status === 'running') {
      return { ok: false, reason: 'Build already in progress' };
    }

    // Check if environment is configured
    const buildStatus = agent.specData?.buildStatus;
    const needsEnv = !buildStatus?.dataverseUrl || !buildStatus?.environmentId;

    // Collect warnings for partial steps
    const warnings: string[] = [];
    const spec = agent.specData;
    if (spec) {
      const mvpKnowledge = (spec.knowledge || []).filter((k: any) => k.phase === 'mvp' && k.status !== 'available');
      if (mvpKnowledge.length > 0) {
        warnings.push(`${mvpKnowledge.length} knowledge source(s) will need manual setup`);
      }
      const mvpTools = (spec.integrations || []).filter((i: any) => i.phase === 'mvp' && i.type !== 'setting' && i.status !== 'available' && !i._autoAdded);
      if (mvpTools.length > 0) {
        warnings.push(`${mvpTools.length} tool(s) will need manual setup`);
      }
    }

    return { ok: true, warnings, needsEnvSelection: needsEnv };
  }, [buildJob.status]);

  const saveEnvironment = useCallback(async (agent: AgentConfig, env: EnvironmentConfig) => {
    if (!agent.projectId || !agent.specAgentId) return;

    const patch = {
      buildStatus: {
        ...(agent.specData?.buildStatus || {}),
        dataverseUrl: env.url,
        environmentId: env.id,
        environment: env.name,
      },
    };

    await fetch(`/api/projects/${encodeURIComponent(agent.projectId)}/agents/${encodeURIComponent(agent.specAgentId)}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  }, []);

  const startPublish = useCallback(async (agent: AgentConfig, env?: EnvironmentConfig) => {
    if (!agent.projectId || !agent.specAgentId) return;

    // Save environment config to spec if provided
    if (env) {
      await saveEnvironment(agent, env);
    }

    setPublishingAgentId(agent.id);
    await buildJob.start(agent.projectId, agent.specAgentId);
  }, [buildJob, saveEnvironment]);

  return {
    canPublish,
    startPublish,
    saveEnvironment,
    buildJob,
    publishingAgentId,
  };
}
