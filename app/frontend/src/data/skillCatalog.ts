import type { DexterWorkspaceSkill } from '../domains/dw/services/dexterWorkerService';

/** A browsable skill template from the Anthropic Skills Library. */
export interface SkillCatalogEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  iconBg: string;
  iconColor: string;
  skill: DexterWorkspaceSkill;
}

/**
 * Top skills from the Anthropic Skills Library (https://github.com/anthropics/skills).
 * Each entry maps to a DexterWorkspaceSkill that can be added to a worker via PUT.
 *
 * Note: Tool configs use `stdio` type with placeholder package names.
 * In a real deployment, these would be replaced with actual MCP server
 * configurations per environment.
 */
export const SKILL_CATALOG: SkillCatalogEntry[] = [
  // ── Documents ──────────────────────────────────────────────────────────
  {
    id: 'docx',
    name: 'Word Documents (DOCX)',
    description: 'Create, read, edit, and manipulate Word documents (.docx files). Supports tables of contents, headings, page numbers, letterheads, tracked changes, and comments.',
    category: 'Documents',
    iconBg: 'bg-blue-50', iconColor: 'text-blue-600',
    skill: {
      name: 'docx',
      description: 'Create, read, edit, and manipulate Word documents (.docx files)',
      instructions: 'A .docx file is a ZIP archive containing XML files. Use python-docx for creation and editing. Support formatting, tables, images, headers/footers, and styles. For reading, use markitdown or python-docx. Always validate output by checking the document opens correctly.',
      tools: [{ type: 'stdio', packageName: 'python-docx' }],
      knowledge: [],
      enabled: true,
    },
  },
  {
    id: 'pdf',
    name: 'PDF Processing',
    description: 'Read, extract, merge, split, rotate, watermark, create, fill forms, encrypt/decrypt, and OCR PDF files.',
    category: 'Documents',
    iconBg: 'bg-red-50', iconColor: 'text-red-600',
    skill: {
      name: 'pdf',
      description: 'Process PDF files — read, create, merge, split, fill forms, OCR',
      instructions: 'Use PyPDF2 for merging/splitting, reportlab for creation, pdfplumber for extraction, and pytesseract for OCR on scanned PDFs. For form filling, read the forms guide. Always validate PDF output is well-formed.',
      tools: [{ type: 'stdio', packageName: 'pypdf2' }],
      knowledge: [],
      enabled: true,
    },
  },
  {
    id: 'pptx',
    name: 'PowerPoint Presentations (PPTX)',
    description: 'Create slide decks, read/parse presentations, edit existing slides, work with templates, layouts, speaker notes, and comments.',
    category: 'Documents',
    iconBg: 'bg-orange-50', iconColor: 'text-orange-600',
    skill: {
      name: 'pptx',
      description: 'Create, read, and edit PowerPoint presentations (.pptx)',
      instructions: 'For reading/analysis: use markitdown. For editing from templates: use python-pptx. For creation from scratch: use pptxgenjs (Node). Always check that the output renders correctly. Support multiple slide layouts, charts, images, and transitions.',
      tools: [{ type: 'stdio', packageName: 'python-pptx' }],
      knowledge: [],
      enabled: true,
    },
  },
  {
    id: 'xlsx',
    name: 'Excel Spreadsheets (XLSX)',
    description: 'Create, read, edit, clean, and format spreadsheets. Supports formulas, charts, pivot tables, and data cleaning from messy CSV/TSV files.',
    category: 'Documents',
    iconBg: 'bg-green-50', iconColor: 'text-green-600',
    skill: {
      name: 'xlsx',
      description: 'Create, read, edit, and clean Excel spreadsheets (.xlsx)',
      instructions: 'Use openpyxl for Excel operations. Use a consistent professional font (e.g. Arial). Every Excel model MUST have zero formula errors (#REF!, #DIV/0!, etc.). Support conditional formatting, charts, pivot tables, and data validation. For messy data, clean and restructure before outputting.',
      tools: [{ type: 'stdio', packageName: 'openpyxl' }],
      knowledge: [],
      enabled: true,
    },
  },
  {
    id: 'doc-coauthoring',
    name: 'Document Co-Authoring',
    description: 'Structured workflow for co-authoring documentation, proposals, technical specs, decision docs, and similar content through iterative refinement.',
    category: 'Documents',
    iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600',
    skill: {
      name: 'doc-coauthoring',
      description: 'Guide users through a structured workflow for co-authoring documentation',
      instructions: 'Walk users through three stages: 1) Context Gathering — understand the document\'s purpose, audience, and key points. 2) Refinement & Structure — organize content, iterate on drafts, improve clarity. 3) Reader Testing — verify the document works for its intended readers. Act as an active guide, not just a text generator.',
      tools: [],
      knowledge: [],
      enabled: true,
    },
  },

  // ── Design & Creative ──────────────────────────────────────────────────
  {
    id: 'frontend-design',
    name: 'Frontend Design',
    description: 'Create distinctive, production-grade frontend interfaces with high design quality. Generates creative, polished web components, pages, and applications.',
    category: 'Design & Creative',
    iconBg: 'bg-purple-50', iconColor: 'text-purple-600',
    skill: {
      name: 'frontend-design',
      description: 'Create distinctive, production-grade frontend interfaces',
      instructions: 'Create polished, production-grade frontend code that avoids generic "AI slop" aesthetics. Before coding, commit to a BOLD aesthetic direction (minimal, maximalist, retro-futuristic, organic, luxury, playful, editorial, brutalist, etc.). Use React, Tailwind CSS, and modern web technologies. Pay exceptional attention to spacing, typography, color, and micro-interactions.',
      tools: [],
      knowledge: [],
      enabled: true,
    },
  },
  {
    id: 'canvas-design',
    name: 'Canvas Design',
    description: 'Create beautiful visual art in .png and .pdf documents using design philosophy. Posters, artwork, and static visual pieces.',
    category: 'Design & Creative',
    iconBg: 'bg-pink-50', iconColor: 'text-pink-600',
    skill: {
      name: 'canvas-design',
      description: 'Create beautiful visual art in .png and .pdf formats',
      instructions: 'Complete in two steps: 1) Design Philosophy Creation — define the aesthetic movement and visual language in a .md file. 2) Express visually — create the design on canvas as .pdf or .png. Use code to generate visuals programmatically. Create original designs, never copying existing artists\' work.',
      tools: [{ type: 'stdio', packageName: 'pillow' }],
      knowledge: [],
      enabled: true,
    },
  },
  {
    id: 'algorithmic-art',
    name: 'Algorithmic Art',
    description: 'Create generative algorithmic art using p5.js with seeded randomness, flow fields, particle systems, and interactive parameter exploration.',
    category: 'Design & Creative',
    iconBg: 'bg-violet-50', iconColor: 'text-violet-600',
    skill: {
      name: 'algorithmic-art',
      description: 'Create algorithmic art using p5.js with seeded randomness and interactive parameter exploration',
      instructions: 'Complete in two steps: 1) Algorithmic Philosophy Creation — define the computational aesthetic movement in .md. 2) Express by creating p5.js generative art (.html + .js files). Use seeded randomness for reproducibility. Create original algorithmic art rather than copying existing artists\' work to avoid copyright violations.',
      tools: [],
      knowledge: [],
      enabled: true,
    },
  },
  {
    id: 'theme-factory',
    name: 'Theme Factory',
    description: 'Apply professional themes (colors, fonts, styling) to artifacts — slides, docs, reports, landing pages. 10 pre-set themes plus custom generation.',
    category: 'Design & Creative',
    iconBg: 'bg-amber-50', iconColor: 'text-amber-600',
    skill: {
      name: 'theme-factory',
      description: 'Apply consistent professional styling themes to any artifact',
      instructions: 'Provide 10 curated professional themes with carefully selected color palettes and font pairings. Each theme includes cohesive colors with hex codes and complementary typography. Can apply themes to slide decks, documents, reports, HTML pages, and other artifacts. Can also generate new themes on-the-fly based on user preferences.',
      tools: [],
      knowledge: [],
      enabled: true,
    },
  },
  {
    id: 'slack-gif-creator',
    name: 'Slack GIF Creator',
    description: 'Create animated GIFs optimized for Slack — emoji GIFs (128x128) and message GIFs (480x480) with validation and animation utilities.',
    category: 'Design & Creative',
    iconBg: 'bg-fuchsia-50', iconColor: 'text-fuchsia-600',
    skill: {
      name: 'slack-gif-creator',
      description: 'Create animated GIFs optimized for Slack',
      instructions: 'Create animated GIFs following Slack constraints. Emoji GIFs: 128x128 recommended. Message GIFs: 480x480. Use Pillow for GIF generation. Validate dimensions, file size, and frame count. Support animation concepts like bouncing, spinning, pulsing, and typing indicators.',
      tools: [{ type: 'stdio', packageName: 'pillow' }],
      knowledge: [],
      enabled: true,
    },
  },

  // ── Development ────────────────────────────────────────────────────────
  {
    id: 'mcp-builder',
    name: 'MCP Server Builder',
    description: 'Build high-quality MCP (Model Context Protocol) servers that enable LLMs to interact with external services. Supports Python (FastMCP) and Node/TypeScript.',
    category: 'Development',
    iconBg: 'bg-neutral-100', iconColor: 'text-neutral-700',
    skill: {
      name: 'mcp-builder',
      description: 'Build MCP servers for LLM-to-service integration',
      instructions: 'Create MCP servers using FastMCP (Python) or the MCP SDK (Node/TypeScript). Focus on well-designed tools with clear names, descriptions, and parameter schemas. Include error handling, rate limiting, and authentication. The quality of an MCP server is measured by how well it enables LLMs to accomplish real-world tasks.',
      tools: [],
      knowledge: [],
      enabled: true,
    },
  },
  {
    id: 'claude-api',
    name: 'Claude API Development',
    description: 'Build applications with the Claude API, Anthropic SDK, or Agent SDK. Includes model selection, streaming, tool use, and extended thinking patterns.',
    category: 'Development',
    iconBg: 'bg-orange-50', iconColor: 'text-orange-700',
    skill: {
      name: 'claude-api',
      description: 'Build LLM-powered applications with the Claude API and Anthropic SDKs',
      instructions: 'Default to Claude Opus 4.7 (model string: claude-opus-4-7). Use adaptive thinking (thinking: {type: "adaptive"}) for anything complex. Default to streaming for long input/output to prevent timeouts. Use the SDK\'s .get_final_message() / .finalMessage() helper for complete responses. Support tool use, multi-turn conversations, and system prompts.',
      tools: [],
      knowledge: [],
      enabled: true,
    },
  },
  {
    id: 'webapp-testing',
    name: 'Web Application Testing',
    description: 'Test local web applications using Playwright — verify frontend functionality, debug UI behavior, capture screenshots, and view browser logs.',
    category: 'Development',
    iconBg: 'bg-teal-50', iconColor: 'text-teal-600',
    skill: {
      name: 'webapp-testing',
      description: 'Test web applications using Playwright browser automation',
      instructions: 'Write native Python Playwright scripts to test web applications. Use helper scripts for server lifecycle management. Always run scripts with --help first before reading source. Capture screenshots for visual verification. Check browser console logs for errors. Support multiple browsers and viewports.',
      tools: [{ type: 'stdio', packageName: 'playwright' }],
      knowledge: [],
      enabled: true,
    },
  },
  {
    id: 'web-artifacts-builder',
    name: 'Web Artifacts Builder',
    description: 'Create elaborate, multi-component web artifacts using React, Tailwind CSS, and shadcn/ui. For complex apps requiring state management and routing.',
    category: 'Development',
    iconBg: 'bg-cyan-50', iconColor: 'text-cyan-600',
    skill: {
      name: 'web-artifacts-builder',
      description: 'Build complex multi-component web artifacts with React and Tailwind',
      instructions: 'Build powerful frontend artifacts: 1) Initialize the frontend repo using init-artifact.sh. 2) Develop by editing generated code. 3) Bundle all code into a single HTML file using bundle-artifact.sh. 4) Display artifact to user. Use React, Tailwind CSS, and shadcn/ui components. Support state management and client-side routing.',
      tools: [],
      knowledge: [],
      enabled: true,
    },
  },
  {
    id: 'skill-creator',
    name: 'Skill Creator',
    description: 'Create new skills, modify existing ones, run evals, benchmark performance, and optimize skill descriptions for better triggering accuracy.',
    category: 'Development',
    iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600',
    skill: {
      name: 'skill-creator',
      description: 'Create, test, and optimize Claude skills',
      instructions: 'Process for creating a skill: 1) Decide what the skill should do and roughly how. 2) Write a draft of the skill. 3) Create test prompts and run claude-with-access-to-the-skill on them. 4) Evaluate results qualitatively and quantitatively. Support iterative refinement, eval running, variance analysis, and description optimization for better triggering.',
      tools: [],
      knowledge: [],
      enabled: true,
    },
  },

  // ── Enterprise & Communication ─────────────────────────────────────────
  {
    id: 'brand-guidelines',
    name: 'Brand Guidelines',
    description: 'Apply official brand colors, typography, and style guidelines to any artifact — documents, slides, web pages, and visual content.',
    category: 'Enterprise',
    iconBg: 'bg-blue-50', iconColor: 'text-blue-700',
    skill: {
      name: 'brand-guidelines',
      description: 'Apply brand colors, typography, and visual identity to artifacts',
      instructions: 'Access and apply official brand identity and style resources. Apply brand colors, typography, and visual formatting to any artifact that benefits from consistent corporate look-and-feel. Support post-processing existing artifacts to match brand standards.',
      tools: [],
      knowledge: [],
      enabled: true,
    },
  },
  {
    id: 'internal-comms',
    name: 'Internal Communications',
    description: 'Write internal communications — status reports, leadership updates, 3P updates, newsletters, FAQs, incident reports, and project updates.',
    category: 'Enterprise',
    iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600',
    skill: {
      name: 'internal-comms',
      description: 'Write formatted internal communications using company templates',
      instructions: 'Write internal communications using standard company formats: 3P updates (Progress, Plans, Problems), company newsletters, FAQ responses, status reports, leadership updates, project updates, and incident reports. Follow consistent formatting and tone appropriate for internal audiences.',
      tools: [],
      knowledge: [],
      enabled: true,
    },
  },
];

/** Get unique categories from the catalog. */
export const SKILL_CATEGORIES = Array.from(new Set(SKILL_CATALOG.map(s => s.category)));
