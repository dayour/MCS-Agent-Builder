import { RotateCcw, Settings2 } from "lucide-react";
import {
  AVAILABLE_MODELS,
  useSettingsStore,
  type ModelKey,
  type ModelTask,
  type FeatureKey,
} from "@/stores/settingsStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Button } from "../ui/button";
import { Label } from "../ui/label";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MODEL_OPTIONS = Object.entries(AVAILABLE_MODELS) as [ModelKey, string][];

const MODEL_TASKS: { key: ModelTask; label: string; description: string }[] = [
  { key: "wizardChat", label: "Wizard Chat", description: "Model used for interview conversation" },
  { key: "enrichment", label: "Enrichment", description: "Model used for brief enrichment (instructions, evals)" },
  { key: "prefetch", label: "Prefetch", description: "Model used for question prefetching" },
];

const FEATURE_FLAGS: { key: "prefetchEnabled" | "speculativeEnrichment" | "progressivePreview"; label: string; description: string }[] = [
  { key: "prefetchEnabled", label: "Question Prefetching", description: "Pre-generate the next question while you read the current one" },
  { key: "speculativeEnrichment", label: "Speculative Enrichment", description: "Start enrichment before the interview ends (when 4 core sections are complete)" },
  { key: "progressivePreview", label: "Progressive Preview", description: "Show real-time brief updates during streaming" },
];

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const {
    models,
    prefetchEnabled,
    speculativeEnrichment,
    progressivePreview,
    setModel,
    toggleFeature,
    reset,
  } = useSettingsStore();

  const featureValues: Record<FeatureKey, boolean> = { prefetchEnabled, speculativeEnrichment, progressivePreview };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-background text-foreground sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Wizard Settings
          </DialogTitle>
          <DialogDescription>
            Configure models and performance features for the agent wizard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Model Selection */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Models</h3>
            <div className="space-y-3 rounded-lg border border-border p-4">
              {MODEL_TASKS.map(({ key, label, description }) => (
                <div key={key} className="grid gap-1.5">
                  <Label htmlFor={`model-${key}`} className="text-sm">
                    {label}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">{description}</span>
                  </Label>
                  <Select
                    value={models[key]}
                    onValueChange={(v) => { if (v in AVAILABLE_MODELS) setModel(key, v as ModelKey); }}
                  >
                    <SelectTrigger id={`model-${key}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODEL_OPTIONS.map(([modelKey, modelLabel]) => (
                        <SelectItem key={modelKey} value={modelKey}>
                          {modelLabel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </section>

          {/* Feature Toggles */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Performance Features</h3>
            <div className="space-y-3 rounded-lg border border-border p-4">
              {FEATURE_FLAGS.map(({ key, label, description }) => (
                <label key={key} className="flex items-center justify-between gap-4 cursor-pointer">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">{description}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={featureValues[key]}
                    onChange={(e) => toggleFeature(key, e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary accent-primary"
                  />
                </label>
              ))}
            </div>
          </section>

          {/* Reset */}
          <div className="flex justify-end border-t border-border pt-4">
            <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to defaults
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
