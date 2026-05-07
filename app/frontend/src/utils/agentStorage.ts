/**
 * Agent-scoped localStorage helpers.
 *
 * ALWAYS use these instead of raw localStorage for any data that belongs to a
 * specific agent or workflow. Keys are namespaced as `agent:<agentId>:<key>` so
 * that clearAgentStorage() can wipe all data for a deleted agent automatically —
 * no manual cleanup list needed.
 *
 * Quick reference:
 *   getAgentStorage(agentId, 'myKey')           // read
 *   setAgentStorage(agentId, 'myKey', value)     // write
 *   removeAgentStorage(agentId, 'myKey')         // delete one key
 *   clearAgentStorage(agentId)                   // delete ALL keys for an agent (called on deletion)
 *
 * For cached values that depend on config content (e.g. LLM-generated output),
 * store a fingerprint inside the value rather than embedding config in the key:
 *   setAgentStorage(id, 'myCache', JSON.stringify({ fingerprint, data }))
 *   // on read: if parsed.fingerprint !== currentFingerprint → cache miss
 */
const agentPrefix = (agentId: string) => `agent:${agentId}:`;

export const getAgentStorage = (agentId: string, key: string): string | null =>
  localStorage.getItem(`${agentPrefix(agentId)}${key}`);

export const setAgentStorage = (agentId: string, key: string, value: string): void =>
  localStorage.setItem(`${agentPrefix(agentId)}${key}`, value);

export const removeAgentStorage = (agentId: string, key: string): void =>
  localStorage.removeItem(`${agentPrefix(agentId)}${key}`);

export const clearAgentStorage = (agentId: string): void => {
  const prefix = agentPrefix(agentId);
  Object.keys(localStorage).filter(k => k.startsWith(prefix)).forEach(k => localStorage.removeItem(k));
};

// Removes ALL keys in the `agent:<id>:*` namespace across all agents.
// All agent-scoped keys MUST be written via setAgentStorage() to ensure they are covered here.
export const clearAllAgentsStorage = (): void => {
  Object.keys(localStorage).filter(k => k.startsWith('agent:')).forEach(k => localStorage.removeItem(k));
};
