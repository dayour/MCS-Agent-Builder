const InstructionsSection = ({ data }: { data: any }) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-1">Instructions</h2>
      <p className="text-xs text-muted-foreground">System prompt defining agent behavior ({data.systemPrompt.length} / 8000 chars)</p>
    </div>

    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">System Prompt</span>
        <span className="text-[11px] text-muted-foreground">{data.systemPrompt.length} chars</span>
      </div>
      <pre className="p-4 text-sm leading-relaxed text-foreground whitespace-pre-wrap font-mono text-xs overflow-y-auto max-h-[500px]">
        {data.systemPrompt}
      </pre>
    </div>
  </div>
);

export default InstructionsSection;
