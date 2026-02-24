import type { Agent } from "@/types";

/**
 * Generate and download a PDF brief report.
 *
 * Uses @react-pdf/renderer under the hood. The import is dynamic so that
 * the ~400 KB library is only loaded when the user clicks "Export PDF".
 */
export async function generateBriefPDF(
  agent: Agent,
  briefData: Record<string, any>,
): Promise<void> {
  // Dynamic imports — only loaded on demand
  const [{ pdf }, { default: React }, { default: BriefPdfDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("react"),
    import("./BriefPdfDocument"),
  ]);

  const doc = React.createElement(BriefPdfDocument, { agent, briefData });
  const blob = await pdf(doc).toBlob();

  // Trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${agent.name.replace(/\s+/g, "_")}_Brief.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
