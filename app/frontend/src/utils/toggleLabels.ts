/**
 * Shared toggle metadata — single source of truth for feature toggle key → label mappings.
 * Used by SnapshotsPage, SnapshotEditor, and SnapshotToggleDialog.
 */

export type FlagCategory = 'Evaluation' | 'Experimental' | 'UI/UX' | 'Homepage' | 'Flows' | 'Preview' | 'Monitor' | 'Tools' | 'Saving' | 'Workflows';

export interface ToggleMeta {
  label: string;
  category: FlagCategory;
}

export const TOGGLE_META: Record<string, ToggleMeta> = {
  isEvalMode:                      { label: 'Eval Mode',                     category: 'Evaluation'   },
  showEvalResults:                 { label: 'See Current Eval Results',       category: 'Evaluation'   },
  isEvalsV2:                       { label: 'Evals v2',                       category: 'Evaluation'   },
  isAiAutocomplete:                { label: 'AI Autocomplete',                category: 'Experimental' },
  isAgentTypeBadge:                { label: 'Agent Type Badge',               category: 'Experimental' },
  isPublishHAEnabled:              { label: 'Publish via HA',                 category: 'Experimental' },
  publishScenario:                 { label: 'Publish Scenario',               category: 'Experimental' },
  isDexter:                        { label: 'Dexter',                         category: 'Experimental' },
  isSkillsEnabled:                 { label: 'Skills',                         category: 'Experimental' },
  isWorkIQEnabled:                 { label: 'Work IQ',                        category: 'Experimental' },
  showConversationalLayoutFeature: { label: 'Conversational Layout',          category: 'UI/UX'        },
  isComponentDrawer:               { label: 'Component Drawer',               category: 'UI/UX'        },
  isPillContextMenu:               { label: 'ComponentPill in instructions',  category: 'UI/UX'        },
  isBuildTabsEnabled:              { label: 'Build Tabs',                     category: 'UI/UX'        },
  isL1NavJuneProposal:             { label: 'Build Shell (L1 Nav)',           category: 'UI/UX'        },
  isAgentGlobalUndo:               { label: 'Agent Global Undo',              category: 'UI/UX'        },
  isFlowCaptureEnabled:            { label: 'Figma Transposer',               category: 'Flows'        },
  isInterviewMode:                 { label: 'Interview Mode',                 category: 'Homepage'     },
  showPersonalAgentOption:         { label: 'Personal Agent Option',          category: 'Homepage'     },
  isAutoSave:                      { label: 'Auto-Save',                      category: 'Saving'       },
  isManualSave:                    { label: 'Manual Save (Ctrl+S)',           category: 'Saving'       },
  workflowVersion:                 { label: 'Canvas + Adding [TW]',           category: 'Workflows'    },
  isStepTypeVisuals:               { label: 'Distinct Step Type Visuals [TW]',category: 'Workflows'    },
  isWorkflowTestingV2:             { label: 'Workflow Testing & Config [TW]', category: 'Workflows'    },
  isTriggersEnabled:               { label: 'Triggers & Channels',            category: 'Workflows'    },
};

export const CATEGORY_ORDER: FlagCategory[] = ['Evaluation', 'Experimental', 'UI/UX', 'Homepage', 'Flows', 'Preview', 'Monitor', 'Tools', 'Saving', 'Workflows'];

/** Flat key → label map derived from TOGGLE_META — use when category isn't needed. */
export const TOGGLE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(TOGGLE_META).map(([k, v]) => [k, v.label]),
);
