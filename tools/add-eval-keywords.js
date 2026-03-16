#!/usr/bin/env node
/**
 * Add `keywords` field to eval tests that use Keyword match method.
 *
 * For safety tests: expected is already keyword-like → copy to keywords
 * For functional tests with Keyword match: extract key terms from expected
 * For resilience tests: no keyword match → skip
 *
 * Usage: node tools/add-eval-keywords.js <brief.json>
 *        node tools/add-eval-keywords.js --all-cdw
 */

const fs = require('fs');
const path = require('path');

function usesKeywordMatch(setMethods, testMethods) {
    const methods = (testMethods && testMethods.length > 0) ? testMethods : setMethods;
    return methods.some(m => (m.type || '').toLowerCase().includes('keyword'));
}

/**
 * Extract keywords from an expected response string.
 * For short, comma-separated text: use as-is.
 * For prose: extract key noun phrases, proper nouns, emails, phone numbers, action verbs.
 */
function extractKeywords(expected, question, capability) {
    if (!expected || expected.trim().length === 0) return null;

    const text = expected.trim();

    // If already comma-separated with short segments (likely already keywords)
    const segments = text.split(',').map(s => s.trim());
    const avgLen = segments.reduce((sum, s) => sum + s.length, 0) / segments.length;
    if (segments.length >= 2 && avgLen < 40) {
        // Already keyword-like, filter short words and return
        return segments.filter(s => s.length > 2).join(', ');
    }

    // Extract specific patterns from prose
    const keywords = new Set();

    // Email addresses
    const emails = text.match(/[\w.-]+@[\w.-]+\.\w+/g);
    if (emails) emails.forEach(e => keywords.add(e));

    // Phone numbers
    const phones = text.match(/\d{3}[.-]\d{3}[.-]\d{4}/g);
    if (phones) phones.forEach(p => keywords.add(p));

    // URLs
    const urls = text.match(/(?:https?:\/\/)?[\w.-]+\.(?:com|org|net)[\w/.-]*/g);
    if (urls) urls.forEach(u => keywords.add(u));

    // Proper nouns and specific terms (capitalized words that aren't sentence starters)
    const sentences = text.split(/[.!?]+/);
    for (const sent of sentences) {
        const words = sent.trim().split(/\s+/);
        for (let i = 1; i < words.length; i++) {
            const w = words[i].replace(/[^a-zA-Z0-9'-]/g, '');
            if (w.length > 2 && /^[A-Z]/.test(w) && !/^(The|This|That|These|Those|It|You|Your|For|And|But|Not|All|Any|Can|May|Should|Would|Could|Please|CDW)$/.test(w)) {
                keywords.add(w);
            }
        }
    }

    // Key action/boundary phrases
    const boundaryPhrases = [
        'cannot', 'decline', 'refuse', 'redirect', 'outside scope', 'not legal advice',
        'policy guidance', 'read-only', 'seller review', 'cannot approve', 'cannot modify',
        'cannot share', 'cannot send', 'cannot create', 'cannot help',
        'contact', 'report', 'consult', 'submit', 'review'
    ];
    for (const phrase of boundaryPhrases) {
        if (text.toLowerCase().includes(phrase)) {
            keywords.add(phrase);
        }
    }

    // Key CDW-specific terms from expected
    const cdwTerms = [
        'Service Central', 'Workday', 'Ethics & Compliance', 'CWS Business Partner',
        'Ethics Helpline', 'cdwway', 'CDW Way', 'Code of Conduct',
        'SharePoint', 'Report Phishing', 'InfoSec', 'FlexTO',
        'Salesforce', 'Seller Assistant', 'Power Plays', 'CPQ',
        'SCI code', 'prospect', 'net-new', 'buying signal',
        'account manager', 'support team', 'sales management'
    ];
    for (const term of cdwTerms) {
        if (text.toLowerCase().includes(term.toLowerCase())) {
            keywords.add(term);
        }
    }

    // If we still have too few, extract significant words (>4 chars, not common)
    if (keywords.size < 3) {
        const stopWords = new Set(['about', 'above', 'after', 'again', 'against', 'being', 'below',
            'between', 'could', 'doing', 'during', 'every', 'first', 'found', 'given', 'going',
            'having', 'include', 'including', 'information', 'their', 'there', 'these', 'those',
            'through', 'under', 'using', 'which', 'while', 'would', 'should', 'where', 'available',
            'based', 'company', 'relevant', 'specific', 'questions', 'response', 'agent']);
        const words = text.toLowerCase().split(/\s+/).map(w => w.replace(/[^a-z0-9-]/g, ''));
        for (const w of words) {
            if (w.length > 4 && !stopWords.has(w)) {
                keywords.add(w);
            }
        }
    }

    // Limit to 8 keywords, prioritize shorter specific terms
    const sorted = [...keywords].sort((a, b) => a.length - b.length);
    return sorted.slice(0, 8).join(', ');
}

function processBrief(briefPath) {
    const brief = JSON.parse(fs.readFileSync(briefPath, 'utf8'));
    const agentName = brief.agent?.name || path.basename(path.dirname(briefPath));
    let updated = 0;
    let skipped = 0;

    if (!brief.evalSets || brief.evalSets.length === 0) {
        console.log(`  No eval sets found in ${agentName}`);
        return { updated: 0, skipped: 0 };
    }

    let stripped = 0;
    for (const set of brief.evalSets) {
        for (let i = 0; i < set.tests.length; i++) {
            const test = set.tests[i];
            const hasKwMethod = usesKeywordMatch(set.methods, test.methods);

            // Strip keywords from tests that don't use Keyword match
            if (!hasKwMethod) {
                if (test.keywords != null) {
                    delete test.keywords;
                    stripped++;
                }
                skipped++;
                continue;
            }

            // Skip if keywords already populated
            if (test.keywords && test.keywords.trim().length > 0) {
                skipped++;
                continue;
            }

            // Generate keywords
            const kw = extractKeywords(test.expected, test.question, test.capability);
            if (kw) {
                test.keywords = kw;
                updated++;
            } else {
                console.log(`  WARNING: Could not generate keywords for ${set.name}[${i}]: "${test.question.substring(0, 50)}..."`);
                skipped++;
            }
        }
    }

    // Write back
    fs.writeFileSync(briefPath, JSON.stringify(brief, null, 2));
    console.log(`  ${agentName}: ${updated} tests updated, ${stripped} stripped, ${skipped} skipped`);
    return { updated, skipped };
}

// Main
const args = process.argv.slice(2);

if (args.includes('--all-cdw')) {
    const cdwDir = path.join(__dirname, '..', 'Build-Guides', 'CDW', 'agents');
    const agents = fs.readdirSync(cdwDir).filter(d =>
        fs.statSync(path.join(cdwDir, d)).isDirectory()
    );

    let totalUpdated = 0;
    let totalSkipped = 0;

    for (const agent of agents) {
        const briefPath = path.join(cdwDir, agent, 'brief.json');
        if (!fs.existsSync(briefPath)) continue;
        console.log(`Processing ${agent}...`);
        const { updated, skipped } = processBrief(briefPath);
        totalUpdated += updated;
        totalSkipped += skipped;
    }

    console.log(`\nTotal: ${totalUpdated} tests updated, ${totalSkipped} skipped`);
} else if (args.length > 0) {
    processBrief(args[0]);
} else {
    console.log('Usage: node tools/add-eval-keywords.js <brief.json>');
    console.log('       node tools/add-eval-keywords.js --all-cdw');
}
