import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import { baseStyles, colors } from "./styles";
import { MsLogo } from "./primitives";
import CoverPage from "./CoverPage";
import TableOfContents from "./TableOfContents";
import ExecutiveSummary from "./ExecutiveSummary";
import BestPractices from "./BestPractices";
import BusinessContext from "./sections/BusinessContext";
import AgentIdentity from "./sections/AgentIdentity";
import Architecture from "./sections/Architecture";
import Instructions from "./sections/Instructions";
import Capabilities from "./sections/Capabilities";
import Integrations from "./sections/Integrations";
import KnowledgeSources from "./sections/KnowledgeSources";
import ConversationTopics from "./sections/ConversationTopics";
import ScopeBoundaries from "./sections/ScopeBoundaries";
import EvalSets from "./sections/EvalSets";
import OpenQuestions from "./sections/OpenQuestions";
import type { Agent } from "@/types";

// ── Header (repeated on every content page) ──────────────────────

const Header = ({ agentName }: { agentName: string }) => (
  <View style={baseStyles.header} fixed>
    <View style={baseStyles.headerLeft}>
      <MsLogo size={12} />
      <Text style={baseStyles.headerText}>Microsoft</Text>
    </View>
    <Text style={baseStyles.headerRight}>{agentName} — Agent Brief</Text>
  </View>
);

// ── Footer (repeated on every content page) ──────────────────────

const Footer = () => {
  const date = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    <View style={baseStyles.footer} fixed>
      <Text style={baseStyles.footerText}>{date}</Text>
      <Text style={baseStyles.footerText}>Confidential</Text>
      <Text
        style={baseStyles.footerText}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
};

// ── Build TOC entries based on which sections have data ──────────

function buildToc(briefData: Record<string, any>): { number: number; title: string }[] {
  const entries: { number: number; title: string }[] = [];
  let n = 0;

  entries.push({ number: ++n, title: "Executive Summary" });

  if (briefData["business-context"]) entries.push({ number: ++n, title: "Business Context" });
  if (briefData["agent-identity"]) entries.push({ number: ++n, title: "Agent Identity" });
  if (briefData["architecture"]) entries.push({ number: ++n, title: "Architecture" });
  if (briefData["instructions"]?.systemPrompt) entries.push({ number: ++n, title: "Instructions" });
  if (briefData["capabilities"]?.items?.length) entries.push({ number: ++n, title: "Capabilities" });
  if (briefData["tools"]?.items?.length) entries.push({ number: ++n, title: "Integrations" });
  if (briefData["knowledge-sources"]?.items?.length) entries.push({ number: ++n, title: "Knowledge Sources" });
  if (briefData["conversation-topics"]?.items?.length) entries.push({ number: ++n, title: "Conversation Topics" });

  const sb = briefData["scope-boundaries"];
  if (sb?.handles?.length || sb?.politelyDeclines?.length || sb?.hardRefuses?.length) {
    entries.push({ number: ++n, title: "Scope & Boundaries" });
  }

  if (briefData["eval-sets"]?.sets?.length) entries.push({ number: ++n, title: "Eval Sets" });

  entries.push({ number: ++n, title: "Best Practices & Recommendations" });

  if (briefData["open-questions"]?.items?.length) entries.push({ number: ++n, title: "Open Questions" });

  return entries;
}

// ── Main Document ────────────────────────────────────────────────

interface Props {
  agent: Agent;
  briefData: Record<string, any>;
}

const BriefPdfDocument = ({ agent, briefData }: Props) => {
  const tocEntries = buildToc(briefData);
  const isMultiAgent = briefData["architecture"]?.pattern?.toLowerCase().includes("multi");

  // Section numbering — must match TOC order
  let n = 0;
  const num = () => ++n;

  return (
    <Document
      title={`${agent.name} — Agent Brief`}
      author="Microsoft Copilot Studio"
      subject="Agent Brief"
    >
      {/* Cover Page (no header/footer) */}
      <CoverPage
        agentName={agent.name}
        description={agent.description || briefData["agent-identity"]?.description || ""}
        status={agent.status}
        readiness={agent.readiness}
      />

      {/* Content Pages */}
      <Page size="A4" style={baseStyles.page} wrap>
        <Header agentName={agent.name} />
        <Footer />

        <TableOfContents entries={tocEntries} />

        <ExecutiveSummary
          sectionNumber={num()}
          briefData={briefData}
          readiness={agent.readiness}
        />

        <BusinessContext data={briefData["business-context"]} sectionNumber={num()} />
        <AgentIdentity data={briefData["agent-identity"]} sectionNumber={num()} />
        <Architecture data={briefData["architecture"]} sectionNumber={num()} />
        <Instructions data={briefData["instructions"]} sectionNumber={num()} />
        <Capabilities data={briefData["capabilities"]} sectionNumber={num()} />
        <Integrations data={briefData["tools"]} sectionNumber={num()} />
        <KnowledgeSources data={briefData["knowledge-sources"]} sectionNumber={num()} />
        <ConversationTopics data={briefData["conversation-topics"]} sectionNumber={num()} />
        <ScopeBoundaries data={briefData["scope-boundaries"]} sectionNumber={num()} />
        <EvalSets data={briefData["eval-sets"]} sectionNumber={num()} />

        <BestPractices sectionNumber={num()} isMultiAgent={isMultiAgent} />

        <OpenQuestions data={briefData["open-questions"]} sectionNumber={num()} />
      </Page>
    </Document>
  );
};

export default BriefPdfDocument;
