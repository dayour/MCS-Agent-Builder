// Re-export from shared location. InstructionsEditor was moved to src/components/shared/
// as part of Phase 1.3 of the domain separation refactor (P1.3: resolve cross-folder deps).
// BuildPage.tsx imports from here via the build/ barrel — this shim preserves that.
export { InstructionsEditor } from '../shared/InstructionsEditor';
export type { InstructionsEditorProps, ComponentFilterTab } from '../shared/InstructionsEditor';
