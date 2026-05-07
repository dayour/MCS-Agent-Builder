#!/usr/bin/env node
/**
 * figma-pull.js — Pull Figma design reference for the Elevate design system
 *
 * Usage:
 *   node tools/figma-pull.js                  # Full refresh of design reference
 *   node tools/figma-pull.js --check          # Check staleness only
 *   node tools/figma-pull.js --component <id> # Pull specific component image
 *   node tools/figma-pull.js --page <id>      # Pull all frames from a page
 *   node tools/figma-pull.js --audit          # Audit code components vs Figma
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const FIGMA_TOKEN = process.env.FIGMA_API_TOKEN || (() => {
  try {
    const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    const m = env.match(/FIGMA_API_TOKEN=(.+)/);
    return m ? m[1].trim() : null;
  } catch { return null; }
})();

const LIBRARY_FILE_ID = 'DLSFFsesGJRdAEi1CWGIdE';
const REFERENCE_PATH = path.join(__dirname, '..', 'knowledge', 'figma-reference.json');

// Key Figma files for different areas
const FILE_MAP = {
  library: 'DLSFFsesGJRdAEi1CWGIdE',
  'test-playground': 'e4GtJkPZyA99waxAw19Kmj',
  'post-march': 'tztlPiawmj4iP4jfGCMG2O',
  homepage: 'WewOn8XOrS3cegWTlxJjCK',
  'my-stuff': '2cpIIHEdnSpYqG943cCBg1',
  capabilities: 'KkSDnBxOOJ1eXxioUMumlY',
  skills: 'ThhYyBQ3JR9RdDnIwEchTt',
  helper: 'N49awrA7v9zTssYWcW8cDQ',
  workflows: 'rVOKkBSr3q0p0ABUECD8vd',
};

function figmaGet(endpoint) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://api.figma.com/v1${endpoint}`);
    const req = https.get(url, {
      headers: { 'X-Figma-Token': FIGMA_TOKEN },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Parse error: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function pullComponentSets() {
  const data = await figmaGet(`/files/${LIBRARY_FILE_ID}/component_sets`);
  if (!data.meta?.component_sets) return [];
  return data.meta.component_sets.map(cs => ({
    name: cs.name,
    key: cs.key,
    nodeId: cs.node_id,
    containingFrame: cs.containing_frame?.name || 'root',
    description: cs.description || '',
  }));
}

async function pullStyles() {
  const data = await figmaGet(`/files/${LIBRARY_FILE_ID}/styles`);
  if (!data.meta?.styles) return [];
  return data.meta.styles.map(s => ({
    name: s.name,
    type: s.style_type,
    key: s.key,
    nodeId: s.node_id,
    description: s.description || '',
  }));
}

async function pullFileStructure(fileId) {
  const data = await figmaGet(`/files/${fileId}?depth=2`);
  return {
    name: data.name,
    lastModified: data.lastModified,
    pages: (data.document?.children || []).map(page => ({
      name: page.name,
      id: page.id,
      frameCount: page.children?.length || 0,
      frames: (page.children || []).slice(0, 30).map(f => ({
        name: f.name,
        type: f.type,
        id: f.id,
      })),
    })),
  };
}

async function pullFullReference() {
  console.log('Pulling Figma design reference...');

  const [componentSets, styles, libraryStructure] = await Promise.all([
    pullComponentSets(),
    pullStyles(),
    pullFileStructure(LIBRARY_FILE_ID),
  ]);

  // Group components by containing frame
  const componentsByArea = {};
  componentSets.forEach(cs => {
    const area = cs.containingFrame;
    if (!componentsByArea[area]) componentsByArea[area] = [];
    componentsByArea[area].push(cs);
  });

  const reference = {
    _meta: {
      generatedAt: new Date().toISOString(),
      libraryFileId: LIBRARY_FILE_ID,
      libraryLastModified: libraryStructure.lastModified,
      fileMap: FILE_MAP,
    },
    componentSets: componentsByArea,
    styles,
    libraryPages: libraryStructure.pages.filter(p =>
      !p.name.startsWith('---') && !p.name.startsWith('----')
    ),
    componentMapping: buildComponentMapping(componentSets),
  };

  fs.writeFileSync(REFERENCE_PATH, JSON.stringify(reference, null, 2));
  console.log(`Written to ${REFERENCE_PATH}`);
  console.log(`  ${componentSets.length} component sets, ${styles.length} styles`);
  console.log(`  Library last modified: ${libraryStructure.lastModified}`);
  return reference;
}

function buildComponentMapping(componentSets) {
  // Map Figma component names to our React component paths
  // This is the curated mapping — maintained manually, seeded from inventory
  const mapping = {
    // Shell & Navigation
    'Copilot Studio shell': { react: 'components/Layout.tsx', status: 'mapped' },
    'L1 navigation': { react: 'components/NavRail.tsx', status: 'mapped' },
    'Rail item [L1 nav]': { react: 'components/NavRail.tsx', status: 'mapped' },
    'Full nav items [L1 nav]': { react: 'components/NavRail.tsx', status: 'mapped' },
    'Nav sections': { react: 'components/NavRail.tsx', status: 'mapped' },
    'Contextual Actions Set': { react: 'components/NavRail.tsx', status: 'mapped' },
    'Contextual actions items': { react: 'components/NavRail.tsx', status: 'mapped' },

    // Header
    'Agent header': { react: 'components/AgentHeader.tsx', status: 'mapped' },
    'Agent name group': { react: 'components/AgentHeader.tsx', status: 'mapped' },
    'Agent icon': { react: 'components/ui/AgentIcon.tsx', status: 'mapped' },
    'Agent icons': { react: 'components/ui/AgentIcon.tsx', status: 'mapped' },
    'Status': { react: 'components/ui/CopilotBadge.tsx', status: 'mapped' },
    'Publish button': { react: null, status: 'figma-only' },
    'More menu': { react: 'components/ui/CopilotMenu.tsx', status: 'mapped' },
    'TestButton': { react: null, status: 'figma-only' },
    'Toggle.Element': { react: 'components/ui/CopilotToggle.tsx', status: 'mapped' },
    'Headline': { react: null, status: 'review' },

    // Build Page
    'Build content': { react: 'pages/BuildPage.tsx', status: 'mapped' },
    'Page title': { react: null, status: 'review' },
    'Instructions': { react: 'pages/build/InstructionsSection.tsx', status: 'mapped' },
    'Instruction type': { react: 'pages/build/InstructionsSection.tsx', status: 'mapped' },
    'Instructions + Components': { react: 'pages/build/', status: 'mapped' },
    'Component': { react: 'pages/build/', status: 'mapped' },
    'Component pill': { react: 'components/ui/CopilotBadge.tsx', status: 'mapped' },
    'COMPONENTS': { react: 'pages/ComponentsPage.tsx', status: 'mapped' },
    'Content/DA.Components': { react: 'pages/build/', status: 'mapped' },
    'Content/CEA.Components': { react: 'pages/build/', status: 'mapped' },
    'Section header/commands': { react: null, status: 'review' },
    'Knowledge / DA': { react: 'pages/build/KnowledgeSection.tsx', status: 'mapped' },
    'Topics': { react: 'pages/build/TopicsSection.tsx', status: 'mapped' },
    'Suggested prompts': { react: null, status: 'review' },

    // Search
    '⏺️ SearchBox': { react: 'components/ui/CopilotInput.tsx', status: 'mapped' },
    'KeyboardShortcut': { react: null, status: 'figma-only' },
    'Menu': { react: 'components/ui/CopilotMenu.tsx', status: 'mapped' },

    // Helper Agent
    'Helper agent': { react: 'components/helper/', status: 'mapped' },
    'Response Footer': { react: 'components/helper/', status: 'mapped' },
    'Response Footer/Response': { react: 'components/helper/', status: 'mapped' },
    'Message response/ Step': { react: 'components/helper/', status: 'mapped' },
    'Message response/ Connection': { react: 'components/helper/', status: 'mapped' },
    'Message response/ Doc links': { react: 'components/helper/', status: 'mapped' },

    // Data Grid
    'DataGrid cell - Medium': { react: 'components/ui/CopilotTable.tsx', status: 'mapped' },
    'DataGrid cell - Small': { react: 'components/ui/CopilotTable.tsx', status: 'mapped' },
    'DataGrid cell - Smaller': { react: 'components/ui/CopilotTable.tsx', status: 'mapped' },
    'DataGrid cell - Large': { react: 'components/ui/CopilotTable.tsx', status: 'mapped' },
    'Content header': { react: 'components/ui/ContentCard.tsx', status: 'mapped' },
    'Cell action header': { react: 'components/ui/CopilotTable.tsx', status: 'mapped' },

    // Activity
    'Activity map/Node/Icon': { react: null, status: 'review' },
    'Activity map/Details pane/Building blocks/Source': { react: null, status: 'review' },
    'Activity map/Details pane/Building blocksSource/details': { react: null, status: 'review' },
    'Activity map/Details pane/CoT type': { react: null, status: 'review' },
    'Activity map/Tool bar': { react: null, status: 'review' },
    'Activity/DataGrid cell/Status': { react: null, status: 'review' },
    'Activity/DataGrid cell/Type': { react: null, status: 'review' },
    'Activity/DataGrid cell/Last step': { react: null, status: 'review' },
    'Activity/DataGrid cell/Last step/Icons': { react: null, status: 'review' },
    'Summary card/Activty': { react: null, status: 'review' },
    'Drawer': { react: null, status: 'review' },

    // Publish
    'Dialog.Publish CEA': { react: null, status: 'figma-only' },
    'Dialog.Publish DA': { react: null, status: 'figma-only' },
    'Dialog.RAI violation': { react: null, status: 'figma-only' },
    'Content.RAI violations': { react: null, status: 'figma-only' },
    'Content.Publish errors': { react: null, status: 'figma-only' },

    // Analytics
    'Analytics': { react: 'pages/monitor/', status: 'mapped' },

    // Misc
    'Popup': { react: 'components/ui/CopilotTooltip.tsx', status: 'mapped' },
    'Tab title - Temporary for CEA reskin': { react: 'components/ui/CopilotUnderlineTabs.tsx', status: 'mapped' },
  };

  // Count statuses
  const counts = { mapped: 0, review: 0, 'figma-only': 0, 'code-only': 0 };
  Object.values(mapping).forEach(m => counts[m.status]++);

  return { entries: mapping, counts };
}

async function checkStaleness() {
  if (!fs.existsSync(REFERENCE_PATH)) {
    console.log('No reference file. Run: node tools/figma-pull.js');
    return { stale: true, reason: 'missing' };
  }
  const ref = JSON.parse(fs.readFileSync(REFERENCE_PATH, 'utf8'));
  const age = Date.now() - new Date(ref._meta.generatedAt).getTime();
  const days = Math.floor(age / 86400000);

  // Check if library was updated since our last pull
  const lib = await figmaGet(`/files/${LIBRARY_FILE_ID}?depth=1`);
  const libModified = new Date(lib.lastModified);
  const refGenerated = new Date(ref._meta.generatedAt);
  const libUpdatedSince = libModified > refGenerated;

  console.log(`Reference age: ${days} days`);
  console.log(`Library last modified: ${lib.lastModified}`);
  console.log(`Reference generated: ${ref._meta.generatedAt}`);
  console.log(`Library updated since pull: ${libUpdatedSince}`);
  console.log(`Component sets: ${Object.values(ref.componentSets).flat().length}`);
  console.log(`Mapping: ${JSON.stringify(ref.componentMapping.counts)}`);

  return {
    stale: days > 3 || libUpdatedSince,
    reason: libUpdatedSince ? 'library-updated' : days > 3 ? 'age' : 'fresh',
    days,
    libUpdatedSince,
  };
}

async function exportComponentImage(nodeId, fileId = LIBRARY_FILE_ID) {
  const data = await figmaGet(`/images/${fileId}?ids=${nodeId}&format=png&scale=2`);
  if (data.images?.[nodeId]) {
    console.log(`Image URL: ${data.images[nodeId]}`);
    return data.images[nodeId];
  }
  console.error('No image returned for node', nodeId);
  return null;
}

// CLI
async function main() {
  if (!FIGMA_TOKEN) {
    console.error('No FIGMA_API_TOKEN found in .env or environment');
    process.exit(1);
  }

  const args = process.argv.slice(2);

  if (args.includes('--check')) {
    await checkStaleness();
  } else if (args.includes('--component')) {
    const idx = args.indexOf('--component');
    const nodeId = args[idx + 1];
    const fileId = args.includes('--file') ? args[args.indexOf('--file') + 1] : LIBRARY_FILE_ID;
    await exportComponentImage(nodeId, fileId);
  } else if (args.includes('--audit')) {
    // Load reference and print mapping status
    if (!fs.existsSync(REFERENCE_PATH)) {
      console.log('No reference. Run: node tools/figma-pull.js first');
      process.exit(1);
    }
    const ref = JSON.parse(fs.readFileSync(REFERENCE_PATH, 'utf8'));
    const mapping = ref.componentMapping;
    console.log('\n=== Figma Component Mapping Audit ===\n');
    console.log('Counts:', JSON.stringify(mapping.counts));
    console.log('\nNeeds review:');
    Object.entries(mapping.entries)
      .filter(([, v]) => v.status === 'review')
      .forEach(([name, v]) => console.log(`  ${name} → ${v.react || '(unmapped)'}`));
    console.log('\nFigma-only (not in code yet):');
    Object.entries(mapping.entries)
      .filter(([, v]) => v.status === 'figma-only')
      .forEach(([name]) => console.log(`  ${name}`));
  } else {
    await pullFullReference();
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
