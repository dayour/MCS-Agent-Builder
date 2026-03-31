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
  const { id, projectId, projectDir, startedAt, stoppedAt, transcript, suggestions, briefing } = meetingData;

  if (onProgress) onProgress({ stage: 'analyzing', message: 'Analyzing meeting transcript...' });

  // Format transcript for the prompt
  const transcriptText = transcript
    .map(e => `[${new Date(e.timestamp).toLocaleTimeString()}] ${e.speaker === 'kim' ? 'Kim' : 'Customer'}: ${e.text}`)
    .join('\n');

  // Format Q&A pairs
  const qaText = suggestions
    .map((s, i) => `Q${i + 1} (${s.detection.type}): "${s.detection.text}"\nA${i + 1}: ${s.text}`)
    .join('\n\n');

  const durationMin = Math.round((stoppedAt - startedAt) / 60000);

  const analysisPrompt = `You are analyzing a customer meeting for MCS (Microsoft Copilot Studio) agent solutioning. Generate a comprehensive post-meeting report.

## Meeting Info
- Duration: ${durationMin} minutes
- Date: ${new Date(startedAt).toLocaleDateString()}
- Transcript entries: ${transcript.length}
- Questions detected: ${suggestions.length}

## Full Transcript
${transcriptText || '(No transcript available)'}

## Questions & Answers During Meeting
${qaText || '(No Q&A pairs)'}

${briefing ? `## Pre-Meeting Briefing\n${briefing}` : ''}

---

Generate the following sections:

### 1. MEETING SUMMARY
2-3 paragraph summary of what was discussed, key themes, and overall direction.

### 2. CUSTOMER REQUIREMENTS → MCS CAPABILITIES
For each requirement identified, map to specific MCS capabilities:
| Requirement | MCS Component | Implementation Notes |
|------------|--------------|---------------------|
(Include connectors, MCPs, knowledge sources, topics, channels as relevant)

### 3. RECOMMENDED AGENT ARCHITECTURE
- Single agent vs multi-agent recommendation with reasoning
- List of agents (if multi-agent) with their roles
- Key topics each agent needs
- Knowledge sources required
- Connectors/MCPs to configure

### 4. ACTION ITEMS
Bulleted list with owner (Kim or Customer) where identifiable.

### 5. FOLLOW-UP EMAIL DRAFT
Professional follow-up email to the customer summarizing the meeting and next steps.

### 6. BRIEF.JSON UPDATES
JSON object with new data to merge into the project's brief.json:
\`\`\`json
{
  "capabilities": [{"name": "...", "description": "..."}],
  "integrations": [{"system": "...", "description": "..."}],
  "decisions": [{"decision": "...", "rationale": "...", "date": "${new Date().toISOString().split('T')[0]}"}],
  "boundaries": ["..."]
}
\`\`\`
Only include items that are NEW from this meeting.`;

  const result = await chatCompletion([
    { role: 'user', content: analysisPrompt }
  ], {
    model: 'sonnet',
    maxTokens: 3000,
    timeout: 90000
  });

  const report = result.content;

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

  if (onProgress) onProgress({ stage: 'done', message: `Report saved to ${savedTo}` });

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
