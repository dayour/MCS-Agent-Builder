/**
 * Post-Meeting Analyzer
 *
 * Triggered automatically when a meeting stops. Generates:
 * - Meeting summary (2-3 paragraphs)
 * - Customer requirements → MCS capabilities mapping
 * - Recommended agent architecture
 * - Action items with owners
 * - Follow-up email draft
 * - Updated brief.json with new findings
 *
 * Uses Sonnet 4.6 for deep analysis.
 */

const fs = require('fs');
const path = require('path');
const { chatCompletion } = require('../../../tools/lib/anthropic');

/**
 * Analyze a completed meeting and generate a comprehensive report.
 *
 * @param {object} meetingData
 * @param {string} meetingData.id - Meeting session ID
 * @param {string} meetingData.projectId - Project ID
 * @param {string} meetingData.projectDir - Path to project directory
 * @param {number} meetingData.startedAt - Start timestamp
 * @param {number} meetingData.stoppedAt - End timestamp
 * @param {Array} meetingData.transcript - Full transcript entries
 * @param {Array} meetingData.suggestions - All Q&A pairs
 * @param {object} [meetingData.briefing] - Pre-meeting briefing text
 * @param {function} [onProgress] - Progress callback
 * @returns {Promise<{report: string, briefUpdates: object, savedTo: string}>}
 */
async function analyzeMeeting(meetingData, onProgress) {
  const { id, projectId, projectDir, startedAt, stoppedAt, transcript = [], suggestions = [], briefing } = meetingData;

  if (onProgress) onProgress({ stage: 'analyzing', message: 'Analyzing meeting transcript...' });

  // Format transcript for the prompt
  const transcriptText = transcript
    .map(e => `[${new Date(e.timestamp).toLocaleTimeString()}] ${e.speaker === 'kim' ? 'You' : 'Customer'}: ${e.text}`)
    .join('\n');

  // Format Q&A pairs
  const qaText = suggestions
    .map((s, i) => `Q${i + 1} (${s.detection.type}): "${s.detection.text}"\nA${i + 1}: ${s.text}`)
    .join('\n\n');

  const durationMin = Math.round((stoppedAt - startedAt) / 60000);

  const analysisPrompt = `You are analyzing a customer meeting. Generate a concise, actionable post-meeting report.

## Meeting Info
- Duration: ${durationMin} minutes
- Date: ${new Date(startedAt).toLocaleDateString()}

## Transcript
${transcriptText || '(No transcript available)'}

${qaText ? `## Questions & Answers During Meeting\n${qaText}` : ''}

${briefing ? `## Pre-Meeting Context\n${briefing}` : ''}

---

Generate the following sections. Be concise and action-oriented.

### SUMMARY
2-3 paragraph recap of what was discussed, key themes, decisions made, and overall direction. Focus on substance — what matters, what was agreed, what was left open.

### KEY TAKEAWAYS
Bulleted list of the most important points, decisions, or insights from the meeting.

### NEXT STEPS
Bulleted list of concrete next steps with owner (where identifiable) and any deadlines mentioned. Be specific — "Schedule follow-up" is too vague, "Kim to send architecture proposal by Friday" is good.

### ACTION ITEMS
| Action | Owner | Status |
|--------|-------|--------|
(List every commitment or task mentioned, who owns it, and whether it's new/in-progress/blocked)

### FOLLOW-UP SUGGESTIONS
Recommendations for follow-up: things to research, clarify, or prepare before the next interaction. Include a draft follow-up message if appropriate.

### BRIEF UPDATES
JSON object with new data to merge into the project's brief.json (only include items that are NEW from this meeting):
\`\`\`json
{
  "capabilities": [{"name": "...", "description": "..."}],
  "integrations": [{"system": "...", "description": "..."}],
  "decisions": [{"decision": "...", "rationale": "...", "date": "${new Date().toISOString().split('T')[0]}"}],
  "boundaries": ["..."]
}
\`\`\``;

  const result = await chatCompletion([
    { role: 'user', content: analysisPrompt }
  ], {
    model: 'sonnet',
    maxTokens: 3000,
    timeout: 90000
  });

  const report = typeof result.content === 'string' ? result.content : String(result.content || '');
  if (!report) throw new Error('Analysis returned empty content');

  // Save report to project directory
  let savedTo = null;
  if (projectDir) {
    const meetingsDir = path.join(projectDir, 'meetings');
    if (!fs.existsSync(meetingsDir)) fs.mkdirSync(meetingsDir, { recursive: true });

    const timestamp = new Date(startedAt).toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const reportPath = path.join(meetingsDir, `meeting-${timestamp}.md`);
    fs.writeFileSync(reportPath, `# Meeting Report — ${new Date(startedAt).toLocaleDateString()}\n\n${report}`, 'utf-8');
    savedTo = reportPath;
  }

  // Extract brief.json updates from the report
  let briefUpdates = null;
  const jsonMatch = report.match(/```json\s*\n([\s\S]*?)\n\s*```/);
  if (jsonMatch) {
    try {
      briefUpdates = JSON.parse(jsonMatch[1]);
    } catch { /* ignore parse errors */ }
  }

  // Merge updates into brief.json if available
  if (briefUpdates && projectDir) {
    mergeBriefUpdates(projectDir, briefUpdates);
  }

  if (onProgress) onProgress({ stage: 'done', message: savedTo ? `Report saved to ${savedTo}` : 'Analysis complete' });

  return { report, briefUpdates, savedTo, cost: result.cost };
}

/**
 * Merge post-meeting findings into the project's brief.json.
 * Non-destructive — appends new items, never overwrites existing data.
 */
function mergeBriefUpdates(projectDir, updates) {
  // Find brief.json
  const possiblePaths = [
    path.join(projectDir, 'brief.json'),
    ...findBriefJsonPaths(projectDir)
  ];

  for (const briefPath of possiblePaths) {
    if (!fs.existsSync(briefPath)) continue;

    try {
      const brief = JSON.parse(fs.readFileSync(briefPath, 'utf-8'));

      // Append new capabilities
      if (updates.capabilities && Array.isArray(updates.capabilities)) {
        if (!brief.capabilities) brief.capabilities = [];
        for (const cap of updates.capabilities) {
          const exists = brief.capabilities.some(c => c.name?.toLowerCase() === cap.name?.toLowerCase());
          if (!exists) brief.capabilities.push({ ...cap, source: 'meeting' });
        }
      }

      // Append new integrations
      if (updates.integrations && Array.isArray(updates.integrations)) {
        if (!brief.integrations) brief.integrations = [];
        for (const int of updates.integrations) {
          const exists = brief.integrations.some(i => i.system?.toLowerCase() === int.system?.toLowerCase());
          if (!exists) brief.integrations.push({ ...int, source: 'meeting' });
        }
      }

      // Append new decisions
      if (updates.decisions && Array.isArray(updates.decisions)) {
        if (!brief.decisions) brief.decisions = [];
        brief.decisions.push(...updates.decisions);
      }

      // Append new boundaries
      if (updates.boundaries && Array.isArray(updates.boundaries)) {
        if (!brief.boundaries) brief.boundaries = [];
        for (const b of updates.boundaries) {
          if (!brief.boundaries.includes(b)) brief.boundaries.push(b);
        }
      }

      // Write back
      fs.writeFileSync(briefPath, JSON.stringify(brief, null, 2), 'utf-8');
      return true;
    } catch { /* ignore */ }
  }
  return false;
}

function findBriefJsonPaths(projectDir) {
  const paths = [];
  const agentsDir = path.join(projectDir, 'agents');
  if (fs.existsSync(agentsDir)) {
    try {
      const agents = fs.readdirSync(agentsDir).filter(f =>
        fs.statSync(path.join(agentsDir, f)).isDirectory()
      );
      for (const agent of agents) {
        paths.push(path.join(agentsDir, agent, 'brief.json'));
      }
    } catch { /* ignore */ }
  }
  return paths;
}

module.exports = { analyzeMeeting, mergeBriefUpdates };
