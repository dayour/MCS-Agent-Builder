#!/usr/bin/env node
/**
 * Eval Coverage Analysis Tool
 *
 * Analyzes eval set coverage against the Scenario Library,
 * recommends applicable scenarios, and writes evalCoverage to brief.json.
 *
 * Usage:
 *   node tools/eval-coverage.js --brief <path> --action analyze     # Show coverage report
 *   node tools/eval-coverage.js --brief <path> --action recommend   # Recommend scenarios
 *   node tools/eval-coverage.js --brief <path> --action write       # Write evalCoverage to brief
 */

const fs = require('fs');
const path = require('path');

// --- Argument parsing ---
const args = process.argv.slice(2);
function getArg(name) {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
}

const briefPath = getArg('brief');
const action = getArg('action') || 'analyze';

if (!briefPath) {
    console.error('Usage: node tools/eval-coverage.js --brief <path> --action <analyze|recommend|write>');
    process.exit(1);
}

if (!fs.existsSync(briefPath)) {
    console.error(`Brief not found: ${briefPath}`);
    process.exit(1);
}

// --- Load scenario library index ---
const INDEX_PATH = path.join(__dirname, '..', 'knowledge', 'frameworks', 'eval-scenarios', 'index.json');

function loadIndex() {
    if (!fs.existsSync(INDEX_PATH)) {
        console.warn('Scenario library index not found at:', INDEX_PATH);
        return null;
    }
    return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
}

// --- Load brief ---
function loadBrief() {
    return JSON.parse(fs.readFileSync(briefPath, 'utf8'));
}

// --- Analyze coverage ---
function analyzeCoverage(brief, index) {
    const evalSets = brief.evalSets || [];
    const tests = [];

    for (const set of evalSets) {
        for (const test of (set.tests || [])) {
            tests.push({
                ...test,
                setName: set.name
            });
        }
    }

    const totalTests = tests.length;

    // Count tests by scenarioId
    const scenariosCovered = new Set();
    const categoriesCovered = new Set();
    const coverageCounts = {
        'core-business': 0,
        'variations': 0,
        'architecture': 0,
        'edge-cases': 0,
        'untagged': 0
    };

    for (const test of tests) {
        if (test.scenarioId) {
            scenariosCovered.add(test.scenarioId);
            // Extract category prefix (e.g., "BP-IR" from "BP-IR-01")
            const catId = test.scenarioId.replace(/-\d+$/, '');
            categoriesCovered.add(catId);
        }
        if (test.coverageTag && coverageCounts.hasOwnProperty(test.coverageTag)) {
            coverageCounts[test.coverageTag]++;
        } else {
            coverageCounts['untagged']++;
        }
    }

    // Calculate distribution percentages
    const distribution = {};
    for (const [tag, count] of Object.entries(coverageCounts)) {
        if (tag === 'untagged') continue;
        distribution[tag] = totalTests > 0 ? Math.round((count / totalTests) * 100) : 0;
    }

    // Find gaps — categories in index not covered by tests
    const gaps = [];
    if (index) {
        for (const cat of index.categories) {
            if (!categoriesCovered.has(cat.id)) {
                gaps.push({
                    categoryId: cat.id,
                    reason: `No tests tagged with ${cat.id} scenarios (${cat.name})`
                });
            }
        }
    }

    return {
        totalTests,
        scenariosCovered: [...scenariosCovered],
        categoriesCovered: [...categoriesCovered],
        coverageCounts,
        distribution,
        gaps
    };
}

// --- Recommend scenarios based on agent config ---
function recommendScenarios(brief, index) {
    if (!index) {
        console.log('Cannot recommend — scenario library index not found.');
        return [];
    }

    const routing = index.agentTypeRouting;
    const recommended = new Set();

    // Determine agent characteristics
    const hasKnowledge = (brief.knowledge || []).length > 0;
    const hasTools = (brief.integrations || []).some(i =>
        i.type === 'connector' || i.type === 'mcp' || i.type === 'flow'
    );
    const hasMultiStep = (brief.conversations?.topics || []).some(t =>
        t.topicType === 'custom' && (t.variables || []).length > 1
    );
    const hasRouting = (brief.architecture?.children || []).length > 0 ||
        (brief.conversations?.topics || []).length > 3;
    const hasBoundaries = (brief.boundaries?.decline || []).length > 0 ||
        (brief.boundaries?.refuse || []).length > 0;
    const hasTroubleshooting = (brief.capabilities || []).some(c =>
        /troubleshoot|diagnos|debug|resolv/i.test(c.name + ' ' + (c.description || ''))
    );

    // Map characteristics to agent types
    if (hasKnowledge) {
        (routing['knowledge-answering'] || []).forEach(c => recommended.add(c));
    }
    if (hasTools) {
        (routing['task-execution'] || []).forEach(c => recommended.add(c));
    }
    if (hasTroubleshooting) {
        (routing['diagnostic-guidance'] || []).forEach(c => recommended.add(c));
    }
    if (hasMultiStep) {
        (routing['multi-step-process'] || []).forEach(c => recommended.add(c));
    }
    if (hasRouting) {
        (routing['multi-topic-routing'] || []).forEach(c => recommended.add(c));
    }
    if (hasBoundaries) {
        (routing['sensitive-data'] || []).forEach(c => recommended.add(c));
    }

    // Always recommend safety + tone
    recommended.add('CAP-SB');
    recommended.add('CAP-TQ');
    recommended.add('CAP-GF');

    // Map category IDs to scenario IDs
    const scenariosRecommended = [];
    for (const catId of recommended) {
        const scenarios = (index.scenarios || []).filter(s => s.category === catId);
        for (const s of scenarios) {
            scenariosRecommended.push(s.id);
        }
    }

    return {
        recommendedCategories: [...recommended],
        scenariosRecommended
    };
}

// --- Print analyze report ---
function printAnalyzeReport(coverage, index) {
    const targets = index?.coverageTargets || {
        'core-business': { min: 30, max: 40 },
        'variations': { min: 20, max: 30 },
        'architecture': { min: 20, max: 30 },
        'edge-cases': { min: 10, max: 20 }
    };

    console.log('\n=== Eval Coverage Analysis ===\n');
    console.log(`Total tests: ${coverage.totalTests}`);
    console.log(`Scenarios tagged: ${coverage.scenariosCovered.length}`);
    console.log(`Categories covered: ${coverage.categoriesCovered.length}/${index ? index.categories.length : '?'}\n`);

    console.log('Coverage Distribution:');
    console.log('─'.repeat(60));
    console.log('Tag              | Count | Actual | Target     | Status');
    console.log('─'.repeat(60));

    for (const tag of ['core-business', 'variations', 'architecture', 'edge-cases']) {
        const count = coverage.coverageCounts[tag] || 0;
        const pct = coverage.distribution[tag] || 0;
        const target = targets[tag] || { min: 0, max: 100 };
        const status = pct >= target.min ? 'OK' : 'LOW';
        const padTag = tag.padEnd(16);
        const padCount = String(count).padStart(5);
        const padPct = `${pct}%`.padStart(6);
        const padTarget = `${target.min}-${target.max}%`.padStart(10);
        console.log(`${padTag} | ${padCount} | ${padPct} | ${padTarget} | ${status}`);
    }

    if (coverage.coverageCounts['untagged'] > 0) {
        console.log(`${'untagged'.padEnd(16)} | ${String(coverage.coverageCounts['untagged']).padStart(5)} |        |            | (no tag)`);
    }
    console.log('─'.repeat(60));

    if (coverage.gaps.length > 0) {
        console.log('\nGaps (categories with no test coverage):');
        for (const gap of coverage.gaps) {
            console.log(`  - ${gap.categoryId}: ${gap.reason}`);
        }
    } else if (index) {
        console.log('\nAll scenario categories have at least one test. ✓');
    }

    if (coverage.scenariosCovered.length === 0 && coverage.totalTests > 0) {
        console.log('\nNote: No tests have scenarioId tags. Run /mcs-research to regenerate');
        console.log('tests with scenario metadata, or use eval-coverage --action recommend');
        console.log('to see which scenarios are applicable to this agent.');
    }
}

// --- Print recommend report ---
function printRecommendReport(recommendations, brief, index) {
    console.log('\n=== Scenario Recommendations ===\n');
    console.log(`Recommended categories for "${brief.agent?.name || 'Agent'}":\n`);

    for (const catId of recommendations.recommendedCategories) {
        const cat = index.categories.find(c => c.id === catId);
        if (cat) {
            const count = index.scenarios.filter(s => s.category === catId).length;
            console.log(`  ${catId}: ${cat.name} (${count} scenarios)`);
            console.log(`    → ${cat.applicableWhen}`);
        }
    }

    console.log(`\nTotal recommended scenarios: ${recommendations.scenariosRecommended.length}`);
}

// --- Write evalCoverage to brief ---
function writeEvalCoverage(brief, coverage, recommendations) {
    brief.evalCoverage = {
        lastAnalyzed: new Date().toISOString(),
        scenariosCovered: coverage.scenariosCovered,
        scenariosRecommended: recommendations.scenariosRecommended || [],
        coverageDistribution: coverage.distribution,
        gaps: coverage.gaps
    };

    fs.writeFileSync(briefPath, JSON.stringify(brief, null, 2));
    console.log(`\nWrote evalCoverage to ${briefPath}`);
    console.log(`  Scenarios covered: ${coverage.scenariosCovered.length}`);
    console.log(`  Scenarios recommended: ${(recommendations.scenariosRecommended || []).length}`);
    console.log(`  Gaps found: ${coverage.gaps.length}`);
}

// --- Main ---
function main() {
    const brief = loadBrief();
    const index = loadIndex();

    switch (action) {
        case 'analyze': {
            const coverage = analyzeCoverage(brief, index);
            printAnalyzeReport(coverage, index);
            break;
        }
        case 'recommend': {
            if (!index) {
                console.error('Scenario library index required for recommendations.');
                process.exit(1);
            }
            const recommendations = recommendScenarios(brief, index);
            printRecommendReport(recommendations, brief, index);
            break;
        }
        case 'write': {
            const coverage = analyzeCoverage(brief, index);
            const recommendations = index ? recommendScenarios(brief, index) : { scenariosRecommended: [] };
            printAnalyzeReport(coverage, index);
            if (index) printRecommendReport(recommendations, brief, index);
            writeEvalCoverage(brief, coverage, recommendations);
            break;
        }
        default:
            console.error(`Unknown action: ${action}. Use: analyze, recommend, write`);
            process.exit(1);
    }
}

main();
