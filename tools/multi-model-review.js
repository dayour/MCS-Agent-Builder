#!/usr/bin/env node
/**
 * Multi-Model Review CLI — GPT-5.4 "Fresh Eyes" for MCS Agent Builds
 *
 * Calls GPT-5.4 via GitHub Copilot Responses API to provide a second-model
 * perspective on agent instructions, topics, briefs, and eval scoring.
 * Fully optional — exits with code 3 when not configured (skip silently).
 * Setup: gh auth login && gh auth refresh --scopes copilot
 *
 * Usage:
 *   node tools/multi-model-review.js review-instructions --brief <path>
 *   node tools/multi-model-review.js review-topics --file <path> [--brief <path>]
 *   node tools/multi-model-review.js review-brief --brief <path>
 *   node tools/multi-model-review.js score --actual "<text>" --expected "<text>" [--method compare-meaning|general-quality]
 *   node tools/multi-model-review.js usage
 *
 * Exit codes: 0 = success, 1 = API error, 3 = not configured
 */

const fs = require('fs');
const path = require('path');
const { isConfigured, chatCompletion, estimateTokens, getUsageSummary, getActiveMethod } = require('./lib/openai');

// --- Knowledge file mapping per command ---
const KNOWLEDGE_DIR = path.resolve(__dirname, '../knowledge');

const KNOWLEDGE_MAP = {
    'review-instructions': [
        'cache/instructions-authoring.md',
        'cache/generative-orchestration.md',
        'cache/conversation-design.md'
    ],
    'review-topics': [
        'patterns/yaml-reference.md',
        'cache/triggers.md',
        'cache/conversation-design.md'
    ],
    'review-brief': [
        'frameworks/component-selection.md',
        'frameworks/architecture-scoring.md',
        'cache/generative-orchestration.md'
    ],
    'score': [
        'cache/eval-methods.md'
    ]
};

/**
 * Build the system context (MCS primer + command-specific knowledge files).
 */
function buildContext(command) {
    const primerPath = path.resolve(KNOWLEDGE_DIR, 'cache/mcs-primer-gpt.md');
    let primer = '';
    try {
        primer = fs.readFileSync(primerPath, 'utf8');
    } catch {
        primer = '# MCS Primer not found — proceeding without domain context.';
    }

    const files = KNOWLEDGE_MAP[command] || [];
    const sections = [];
    for (const f of files) {
        const fullPath = path.resolve(KNOWLEDGE_DIR, f);
        try {
            sections.push(fs.readFileSync(fullPath, 'utf8'));
        } catch {
            // Skip missing files — graceful degradation
        }
    }

    const knowledge = sections.join('\n\n---\n\n');
    return `${primer}\n\n---\n\n${knowledge}`;
}

// --- Command Prompts ---

const PROMPTS = {
    'review-instructions': `You are an expert reviewer of Microsoft Copilot Studio agent instructions. You have deep knowledge of MCS generative orchestration, topic routing, tool integration, and instruction authoring best practices.

Review the agent instructions below and report findings in these categories:
1. **Gaps** — Capabilities listed in the brief that are NOT addressed in instructions
2. **Contradictions** — Conflicting guidance within the instructions
3. **Ambiguity** — Phrases that could be interpreted multiple ways
4. **Boundary coverage** — Missing decline/refuse handling for out-of-scope requests
5. **Reference validity** — /Tool and /Topic references that don't match the configured tools/topics
6. **MCS anti-patterns** — Hardcoded URLs, tool listing in responses, aggressive caps, instruction bloat

Output valid JSON with this structure:
{
  "findings": [{"severity": "critical|high|medium|low", "category": "gap|contradiction|ambiguity|boundary|reference|anti-pattern", "location": "specific location in instructions", "description": "what's wrong", "suggestion": "how to fix"}],
  "summary": "2-3 sentence overall assessment",
  "instructionQuality": <1-10 score>
}`,

    'review-topics': `You are an expert reviewer of Microsoft Copilot Studio topic YAML. You understand MCS conversation flows, trigger types, node structures, and adaptive cards. Focus on LOGIC review (not syntax — that's handled by other tools).

Review the topic YAML below for:
1. **Dead-end branches** — Paths that don't end with a message, redirect, or end node
2. **Missing error handling** — No fallback for failed API calls or unexpected inputs
3. **Variable issues** — Variables used before initialization, or declared but never used
4. **Trigger coverage** — Trigger phrases that miss common phrasings for the intent
5. **UX issues** — Confusing prompts, no escape from loops, missing confirmation steps

Output valid JSON:
{
  "findings": [{"severity": "critical|high|medium|low", "category": "dead-end|error-handling|variable|trigger|ux", "location": "node or line reference", "description": "what's wrong", "suggestion": "how to fix"}],
  "summary": "2-3 sentence overall assessment",
  "topicQuality": <1-10 score>
}`,

    'review-brief': `You are an expert reviewer of Microsoft Copilot Studio agent design briefs. You understand MCS architecture (single vs multi-agent), component selection, eval design, and the build lifecycle.

Review the brief.json below for completeness:
1. **Missing sections** — Are all key fields populated (capabilities, integrations, knowledge, boundaries, instructions, model, evalSets)?
2. **Capability-integration gaps** — Capabilities that reference tools not in integrations[]
3. **MVP delineation** — Is phase: "mvp" vs "future" clearly assigned?
4. **Eval coverage** — Do evalSets cover all capabilities? Are safety tests present?
5. **Unresolved questions** — Any openQuestions[] still unanswered?
6. **Blocking issues** — Decisions with status "pending" that block the build

Output valid JSON:
{
  "findings": [{"severity": "critical|high|medium|low", "category": "missing|gap|mvp|eval|question|blocking", "location": "field or section name", "description": "what's wrong", "suggestion": "how to fix"}],
  "summary": "2-3 sentence overall assessment",
  "briefCompleteness": <1-10 score>,
  "readyToBuild": true/false,
  "blockingIssues": ["list of things that must be fixed before building"]
}`,

    'score-compare-meaning': `You are a semantic similarity scorer for AI agent evaluation. Compare the actual agent response to the expected response and determine if they convey the same meaning.

Score from 0-100:
- 90-100: Essentially the same information, possibly different wording
- 70-89: Key information present but some details missing or extra
- 50-69: Partially related but missing important information
- 30-49: Loosely related, significant gaps
- 0-29: Completely different or wrong

Output valid JSON:
{
  "score": <0-100>,
  "reasoning": "1-2 sentence explanation of the score"
}`,

    'score-general-quality': `You are a response quality scorer for AI agent evaluation. Evaluate the actual agent response for quality, helpfulness, and appropriateness.

Score from 0-100:
- 90-100: Excellent — clear, helpful, complete, well-formatted
- 70-89: Good — mostly helpful with minor gaps
- 50-69: Acceptable — answers the question but could be better
- 30-49: Poor — vague, missing key info, or somewhat off-topic
- 0-29: Bad — wrong, unhelpful, or harmful

If an expected response is provided, also consider whether the actual response covers the same ground.

Output valid JSON:
{
  "score": <0-100>,
  "reasoning": "1-2 sentence explanation of the score"
}`
};

// --- CLI Arg Parsing ---
function parseArgs() {
    const args = process.argv.slice(2);
    const config = {};

    if (args.length === 0 || args[0] === '--help') {
        console.log(`Usage:
  node multi-model-review.js review-instructions --brief <path>
  node multi-model-review.js review-topics --file <path> [--brief <path>]
  node multi-model-review.js review-brief --brief <path>
  node multi-model-review.js score --actual "<text>" --expected "<text>" [--method compare-meaning|general-quality]
  node multi-model-review.js models                    List available GPT models
  node multi-model-review.js usage                     Show session usage stats

Exit codes: 0 = success, 1 = API error, 3 = not configured
Setup:    gh auth login && gh auth refresh --scopes copilot`);
        process.exit(0);
    }

    config.command = args[0];

    for (let i = 1; i < args.length; i++) {
        switch (args[i]) {
            case '--brief': config.briefPath = args[++i]; break;
            case '--file': config.filePath = args[++i]; break;
            case '--actual': config.actual = args[++i]; break;
            case '--expected': config.expected = args[++i]; break;
            case '--method': config.method = args[++i]; break;
            case '--verbose': config.verbose = true; break;
        }
    }

    return config;
}

/**
 * Parse JSON from GPT response, handling markdown code fences.
 */
function parseGptJson(content) {
    // Strip markdown code fences if present
    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    return JSON.parse(cleaned);
}

// --- Command Handlers ---

async function reviewInstructions(config) {
    if (!config.briefPath) {
        console.error('Error: --brief <path> is required for review-instructions');
        process.exit(1);
    }

    const brief = JSON.parse(fs.readFileSync(config.briefPath, 'utf8'));
    const instructions = brief.instructions || '';
    const capabilities = brief.capabilities || [];
    const boundaries = brief.boundaries || {};
    const integrations = brief.integrations || [];
    const topics = (brief.conversations && brief.conversations.topics) || [];

    if (!instructions) {
        console.error('Error: brief.json has no instructions field');
        process.exit(1);
    }

    const context = buildContext('review-instructions');
    const userContent = `## Agent Instructions to Review

${instructions}

## Agent Configuration Context

### Capabilities (${capabilities.length})
${capabilities.map(c => `- ${c.name}: ${c.description || ''} [phase: ${c.phase || 'mvp'}]`).join('\n')}

### Configured Integrations (${integrations.length})
${integrations.map(i => `- ${i.name} (${i.type || 'unknown'}): ${i.description || ''}`).join('\n')}

### Boundaries
Handle: ${(boundaries.handle || []).join(', ') || 'none specified'}
Decline: ${(boundaries.decline || []).join(', ') || 'none specified'}
Refuse: ${(boundaries.refuse || []).join(', ') || 'none specified'}

### Topics (${topics.length})
${topics.map(t => `- ${t.name} [trigger: ${t.triggerType || 'unknown'}]`).join('\n')}`;

    const tokenEstimate = estimateTokens(context + userContent);
    if (config.verbose) console.error(`Estimated tokens: ~${tokenEstimate}`);

    const result = await chatCompletion([
        { role: 'system', content: PROMPTS['review-instructions'] + '\n\n' + context },
        { role: 'user', content: userContent }
    ]);

    const parsed = parseGptJson(result.content);
    parsed._usage = result.usage;
    parsed._cost = `$${result.cost.toFixed(4)}`;
    console.log(JSON.stringify(parsed, null, 2));
}

async function reviewTopics(config) {
    if (!config.filePath) {
        console.error('Error: --file <path> is required for review-topics');
        process.exit(1);
    }

    const yamlContent = fs.readFileSync(config.filePath, 'utf8');
    const context = buildContext('review-topics');

    let briefContext = '';
    if (config.briefPath) {
        try {
            const brief = JSON.parse(fs.readFileSync(config.briefPath, 'utf8'));
            const caps = (brief.capabilities || []).map(c => `- ${c.name}`).join('\n');
            const integs = (brief.integrations || []).map(i => `- ${i.name} (${i.type})`).join('\n');
            briefContext = `\n\n## Brief Context\n\n### Capabilities\n${caps}\n\n### Integrations\n${integs}`;
        } catch { /* skip brief context if unreadable */ }
    }

    const userContent = `## Topic YAML to Review

\`\`\`yaml
${yamlContent}
\`\`\`
${briefContext}`;

    const result = await chatCompletion([
        { role: 'system', content: PROMPTS['review-topics'] + '\n\n' + context },
        { role: 'user', content: userContent }
    ]);

    const parsed = parseGptJson(result.content);
    parsed._usage = result.usage;
    parsed._cost = `$${result.cost.toFixed(4)}`;
    console.log(JSON.stringify(parsed, null, 2));
}

async function reviewBrief(config) {
    if (!config.briefPath) {
        console.error('Error: --brief <path> is required for review-brief');
        process.exit(1);
    }

    const brief = JSON.parse(fs.readFileSync(config.briefPath, 'utf8'));
    const context = buildContext('review-brief');

    // Send a summarized version to stay within token limits
    const summary = {
        agentName: brief.agentName || brief.name,
        purpose: brief.purpose,
        persona: brief.persona,
        model: brief.model,
        architecture: brief.architecture,
        capabilities: brief.capabilities,
        integrations: brief.integrations,
        knowledge: brief.knowledge,
        boundaries: brief.boundaries,
        instructions: brief.instructions ? `[${brief.instructions.length} chars]` : null,
        evalSets: (brief.evalSets || []).map(s => ({
            name: s.name,
            testCount: (s.tests || []).length,
            passThreshold: s.passThreshold,
            methods: s.methods
        })),
        decisions: (brief.decisions || []).map(d => ({
            id: d.id,
            question: d.question,
            status: d.status,
            category: d.category
        })),
        openQuestions: brief.openQuestions,
        conversations: brief.conversations ? {
            topicCount: (brief.conversations.topics || []).length,
            topics: (brief.conversations.topics || []).map(t => ({ name: t.name, phase: t.phase, triggerType: t.triggerType }))
        } : null
    };

    const userContent = `## Brief to Review\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\``;

    const result = await chatCompletion([
        { role: 'system', content: PROMPTS['review-brief'] + '\n\n' + context },
        { role: 'user', content: userContent }
    ]);

    const parsed = parseGptJson(result.content);
    parsed._usage = result.usage;
    parsed._cost = `$${result.cost.toFixed(4)}`;
    console.log(JSON.stringify(parsed, null, 2));
}

async function scoreResponse(config) {
    if (!config.actual) {
        console.error('Error: --actual "<text>" is required for score');
        process.exit(1);
    }

    const method = config.method || 'compare-meaning';
    const promptKey = method === 'general-quality' ? 'score-general-quality' : 'score-compare-meaning';
    const context = buildContext('score');

    let userContent = `## Actual Response\n${config.actual}`;
    if (config.expected) {
        userContent += `\n\n## Expected Response\n${config.expected}`;
    }

    const result = await chatCompletion([
        { role: 'system', content: PROMPTS[promptKey] + '\n\n' + context },
        { role: 'user', content: userContent }
    ], { maxTokens: 512 });

    const parsed = parseGptJson(result.content);
    parsed._usage = result.usage;
    parsed._cost = `$${result.cost.toFixed(4)}`;
    console.log(JSON.stringify(parsed, null, 2));
}

async function showModels() {
    let token;
    try {
        token = require('child_process').execSync('gh auth token', {
            encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
    } catch {
        console.error('gh CLI not available or not logged in. Run: gh auth login');
        process.exit(3);
    }
    const { httpRequestWithRetry } = require('./lib/http');
    const res = await httpRequestWithRetry('GET', 'https://api.githubcopilot.com/models', {
        'Authorization': `Bearer ${token}`,
        'Copilot-Integration-Id': 'vscode-chat',
        'Editor-Version': 'vscode/1.96.0'
    }, null, 1);
    if (res.status !== 200) {
        console.error('Failed to fetch models:', res.status);
        process.exit(1);
    }
    const models = (res.data.data || [])
        .filter(m => (m.id || '').startsWith('gpt-5'))
        .map(m => ({
            id: m.id,
            family: m.capabilities?.family,
            context: m.capabilities?.limits?.max_prompt_tokens,
            maxOutput: m.capabilities?.limits?.max_output_tokens
        }))
        .sort((a, b) => (b.id || '').localeCompare(a.id || ''));
    const current = 'gpt-5.4';
    console.log(`Current default: ${current}\n`);
    console.log('GPT-5.x models available:');
    for (const m of models) {
        const marker = m.id === current ? ' ← current' : '';
        console.log(`  ${m.id}  ctx=${m.context}  out=${m.maxOutput}${marker}`);
    }
    if (models.length > 0 && models[0].id !== current) {
        console.log(`\nNewer model available: ${models[0].id}`);
        console.log(`Update COPILOT_DEFAULT_MODEL in tools/lib/openai.js to use it.`);
    } else {
        console.log('\nYou are on the latest model.');
    }
}

function showUsage() {
    const summary = getUsageSummary();
    const method = getActiveMethod();
    const METHOD_LABELS = {
        'copilot-api': 'GitHub Copilot API — GPT-5.4'
    };
    console.log(JSON.stringify({
        configured: isConfigured(),
        method: method || 'not configured',
        endpoint: METHOD_LABELS[method] || 'Not configured',
        session: {
            calls: summary.calls,
            inputTokens: summary.inputTokens,
            outputTokens: summary.outputTokens,
            totalTokens: summary.inputTokens + summary.outputTokens,
            estimatedCost: `$${summary.cost.toFixed(4)}`
        }
    }, null, 2));
}

// --- Main ---
async function main() {
    const config = parseArgs();

    // These commands don't need GPT configured for API calls
    if (config.command === 'usage') {
        showUsage();
        return;
    }
    if (config.command === 'models') {
        await showModels();
        return;
    }

    // Check configuration
    if (!isConfigured()) {
        console.error(JSON.stringify({
            error: 'GPT not configured',
            hint: 'Run: gh auth login && gh auth refresh --scopes copilot'
        }));
        process.exit(3);
    }

    try {
        switch (config.command) {
            case 'review-instructions':
                await reviewInstructions(config);
                break;
            case 'review-topics':
                await reviewTopics(config);
                break;
            case 'review-brief':
                await reviewBrief(config);
                break;
            case 'score':
                await scoreResponse(config);
                break;
            default:
                console.error(`Unknown command: ${config.command}`);
                process.exit(1);
        }
    } catch (err) {
        if (err.code === 'NOT_CONFIGURED') {
            console.error(JSON.stringify({ error: err.message }));
            process.exit(3);
        }
        console.error(JSON.stringify({ error: err.message }));
        process.exit(1);
    }
}

main();
