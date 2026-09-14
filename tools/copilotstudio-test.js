#!/usr/bin/env node
/**
 * Copilot Studio Agents SDK eval runner. Direct Line remains the default:
 * use this runner when the agent is configured for Entra ID authentication.
 *
 * Usage:
 * COPILOT_STUDIO_JWT=<jwt> node tools/copilotstudio-test.js --environment-id <id> --schema-name <name> --brief agentspec.json
 */

const fs = require("fs");
const { parseCSV, parseEvalSets, evaluateAllMethodsAsync } = require("./eval-scoring");
const { createCopilotStudioTransport } = require("./eval-transport");

function value(args, name) { const index = args.indexOf(name); return index < 0 ? null : args[index + 1]; }

async function main() {
  const args = process.argv.slice(2);
  const briefPath = value(args, "--brief") || value(args, "--spec");
  const csvPath = value(args, "--csv");
  const environmentId = value(args, "--environment-id");
  const schemaName = value(args, "--schema-name");
  const jwt = value(args, "--jwt") || process.env.COPILOT_STUDIO_JWT;
  if (args.includes("--help") || !environmentId || !schemaName || !jwt || (!briefPath && !csvPath)) {
    console.log("Usage: COPILOT_STUDIO_JWT=<jwt> node tools/copilotstudio-test.js --environment-id <id> --schema-name <name> (--brief <agentspec.json> | --csv <evals.csv>)");
    process.exit(args.includes("--help") ? 0 : 2);
  }

  const tests = briefPath
    ? parseEvalSets(briefPath, value(args, "--set")?.split(",")).tests
    : parseCSV(fs.readFileSync(csvPath, "utf8"));
  const transport = createCopilotStudioTransport({ environmentId, schemaName, jwt, cloud: value(args, "--cloud") });
  const results = [];
  for (const test of tests) {
    const conversationId = await transport.startConversation();
    const received = await transport.sendAndReceive(test.question, conversationId);
    const evaluation = await evaluateAllMethodsAsync(
      received.response, test.expected || test.expectedResponse, test.methods || [{ type: test.testMethodType || "GeneralQuality" }],
      received.toolInvocations, test.keywords
    );
    results.push({ ...test, actualResponse: received.response, toolInvocations: received.toolInvocations, ...evaluation });
  }
  const passed = results.filter((result) => result.pass).length;
  console.log(`Agents SDK results: ${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((error) => { console.error(`Fatal error: ${error.message}`); process.exit(2); });
