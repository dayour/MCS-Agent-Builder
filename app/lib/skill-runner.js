/**
 * skill-runner.js — Stub for backward compatibility.
 *
 * The PTY-based skill runner has been replaced by API-direct pipelines:
 * - research/preview → research-pipeline.js (API-direct via anthropic.js)
 * - build/eval/fix → TODO: build-pipeline.js, eval-pipeline.js, fix-pipeline.js
 *
 * This stub provides the getJob/getJobLog/getAllJobs interface that server.js
 * endpoints expect, returning null/empty for any PTY jobs (none will be created).
 */

const _jobs = new Map();

function startSkill(skillType, command, projectId, agentId, baseDir) {
  // Research/preview are handled by research-pipeline.js (routed in server.js)
  // Build/eval/fix will get their own API-direct pipelines
  const id = `skill-${skillType}-${Date.now()}`;
  const job = {
    id,
    skillType,
    command,
    projectId,
    agentId: agentId || "",
    status: "failed",
    steps: [],
    errors: [`${skillType} pipeline not yet implemented — coming soon`],
    rawLog: "",
    listeners: [],
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    authPrompt: null,
  };
  _jobs.set(id, job);

  // Notify listeners of immediate failure
  for (const fn of job.listeners) {
    try { fn({ type: "done", status: "failed", errors: job.errors, steps: [] }); } catch { /* */ }
  }

  return job;
}

function getJob(jobId) { return _jobs.get(jobId) || null; }
function getAllJobs(skillType) {
  return Array.from(_jobs.values())
    .filter((j) => !skillType || j.skillType === skillType)
    .map((j) => ({ id: j.id, skillType: j.skillType, status: j.status, errors: j.errors }));
}
function getJobLog(jobId) { const j = _jobs.get(jobId); return j ? j.rawLog : null; }
function resumeAfterAuth() { return { error: "PTY runner removed — use API-direct pipelines" }; }

module.exports = { startSkill, resumeAfterAuth, getJob, getAllJobs, getJobLog };
