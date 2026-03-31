import { useWizardStore } from "@/stores/wizardStore";
import ChatPanel from "./ChatPanel";
import BriefPreviewPanel from "./BriefPreviewPanel";
import SectionProgress from "./SectionProgress";
import DocumentBar from "./DocumentBar";

export default function WizardLayout() {
  const currentState = useWizardStore((s) => s.currentState);
  const documents = useWizardStore((s) => s.documents);
  const projectId = useWizardStore((s) => s.projectId);
  const uploadFile = useWizardStore((s) => s.uploadFile);
  const removeFile = useWizardStore((s) => s.removeFile);
  const phase = useWizardStore((s) => s.phase);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left: Chat + Progress */}
      <div className="flex flex-1 min-w-0 lg:max-w-[60%]">
        {/* Progress sidebar (hidden on small screens) */}
        <div className="hidden md:flex flex-col w-[200px] shrink-0 border-r border-border/40 bg-muted/20 py-3">
          <SectionProgress
            sections={currentState.sections}
            activeSection={currentState.activeSection}
          />

          {/* Document panel */}
          <div className="mt-auto border-t border-border/40">
            <DocumentBar
              documents={documents}
              projectId={projectId}
              onUpload={uploadFile}
              onRemove={removeFile}
              disabled={phase === "saving"}
            />
          </div>
        </div>

        {/* Chat panel */}
        <div className="flex-1 min-w-0 flex flex-col bg-background">
          <ChatPanel />
        </div>
      </div>

      {/* Right: Brief Preview (hidden on mobile) */}
      <div className="hidden lg:flex flex-col w-[40%] border-l border-border/40 bg-muted/10">
        <BriefPreviewPanel streaming={phase === "streaming"} />
      </div>
    </div>
  );
}
