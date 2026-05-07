/**
 * eval-gate-flags.js — feature-flag control for the eval gate.
 *
 * Per GPT review 2026-04-17: "evalGate visibility may depend on role,
 * feature flags, environment, or bot type." This provides the rollout
 * control surface so the gate can be staged behind a flag per-environment
 * or per-tenant without redeploying code.
 *
 * Flag file: knowledge/eval-gate-flags.json (gitignored if tenant-specific;
 * checked in if global). Schema:
 *   {
 *     "enabled": true | false,          // master kill switch
 *     "tenants": { "<tenantId>": true | false },
 *     "environments": { "<envId>": true | false },
 *     "riskTiers": { "demo": true, "internal": true, "production": true },
 *     "visibility": "all" | "maker" | "admin"
 *   }
 *
 * Visibility levels control how much evalGate detail the frontend should
 * surface. NOT a security control — backend authorization is the real gate;
 * this just reduces surface area for casual viewers.
 *   - "all":   every viewer sees everything including override details
 *   - "maker": authenticated agent owner sees full detail; anonymous hidden
 *   - "admin": even maker sees trimmed view; only admin sees override details
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_FLAGS = {
  enabled: true,
  tenants: {},
  environments: {},
  riskTiers: { demo: true, internal: true, production: true },
  visibility: "maker",
};

const FLAG_PATH = process.env.EVAL_GATE_FLAGS
  || path.join(__dirname, "..", "..", "knowledge", "eval-gate-flags.json");

function loadFlags() {
  if (!fs.existsSync(FLAG_PATH)) return { ...DEFAULT_FLAGS };
  try {
    const raw = JSON.parse(fs.readFileSync(FLAG_PATH, "utf8"));
    return { ...DEFAULT_FLAGS, ...raw };
  } catch {
    return { ...DEFAULT_FLAGS };
  }
}

/**
 * Decide whether the gate enforces for a given build context.
 *
 * Returns { enforce: bool, reason: string } so the caller can log why
 * the gate was skipped (if it was).
 *
 * Hierarchy (most-specific wins):
 *   1. flags.enabled === false → globally off
 *   2. flags.tenants[tenantId] set → use that value
 *   3. flags.environments[envId] set → use that value
 *   4. flags.riskTiers[riskTier] === false → skip for that tier
 *   5. default: enforce
 */
function shouldEnforce({ tenantId, envId, riskTier } = {}) {
  const flags = loadFlags();

  if (flags.enabled === false) {
    return { enforce: false, reason: "eval-gate-flags.json has enabled=false (global kill switch)" };
  }

  if (tenantId && tenantId in flags.tenants) {
    const on = flags.tenants[tenantId] === true;
    return { enforce: on, reason: `tenant ${tenantId.slice(0, 8)}... flag = ${on}` };
  }

  if (envId && envId in flags.environments) {
    const on = flags.environments[envId] === true;
    return { enforce: on, reason: `environment ${envId.slice(0, 8)}... flag = ${on}` };
  }

  if (riskTier && riskTier in flags.riskTiers) {
    const on = flags.riskTiers[riskTier] === true;
    return { enforce: on, reason: `riskTier ${riskTier} flag = ${on}` };
  }

  return { enforce: true, reason: "no override — default enforce" };
}

/**
 * Filter an evalGate record based on viewer role. Mutates nothing; returns
 * a (possibly reduced) copy.
 *
 * Not authorization — do not rely on this for security. Use at rendering
 * time only. Caller decides viewerRole based on their own auth context.
 */
function filterEvalGateForViewer(evalGate, viewerRole = "maker") {
  if (!evalGate) return evalGate;
  const flags = loadFlags();
  const level = flags.visibility || "maker";

  // all: no filtering
  if (level === "all") return evalGate;

  const copy = { ...evalGate };

  // maker: hide override approver details from non-makers (anonymous viewers)
  if (level === "maker" && viewerRole === "anonymous") {
    delete copy.overrideApprovedBy;
    delete copy.overrideReason;
    delete copy.overrideTicketRef;
    delete copy.overrideSpecHash;
    delete copy.overrideEntryHash;
    delete copy.migrationReason;
  }

  // admin: hide override details from makers too (only admins see who overrode)
  if (level === "admin" && viewerRole !== "admin") {
    delete copy.overrideApprovedBy;
    delete copy.overrideReason;
    delete copy.overrideTicketRef;
    delete copy.overrideSpecHash;
    delete copy.overrideEntryHash;
    delete copy.provenance;
  }

  return copy;
}

module.exports = {
  shouldEnforce,
  filterEvalGateForViewer,
  loadFlags,
  DEFAULT_FLAGS,
  FLAG_PATH,
};
