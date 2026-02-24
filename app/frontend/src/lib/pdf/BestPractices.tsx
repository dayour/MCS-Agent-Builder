import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { colors } from "./styles";
import { SectionHeading, SubHeading, BulletList, Spacer } from "./primitives";

const s = StyleSheet.create({
  intro: {
    fontSize: 9,
    color: colors.s500,
    fontStyle: "italic",
    marginBottom: 8,
    lineHeight: 1.5,
  },
});

interface Props {
  sectionNumber: number;
  isMultiAgent: boolean;
}

const BestPractices = ({ sectionNumber, isMultiAgent }: Props) => (
  <View>
    <SectionHeading number={sectionNumber} title="Best Practices & Recommendations" />
    <Text style={s.intro}>
      Industry-proven recommendations for Microsoft Copilot Studio agents.
    </Text>

    <SubHeading>Instructions & Design</SubHeading>
    <BulletList
      items={[
        "Keep system instructions under 8,000 characters for optimal generative orchestration",
        "Use explicit persona definitions for consistent tone across all responses",
        "Define clear scope boundaries \u2014 what the agent handles, declines, and refuses",
        "Include example responses for high-stakes scenarios to anchor model behavior",
      ]}
    />

    <Spacer h={4} />
    <SubHeading>Knowledge & Grounding</SubHeading>
    <BulletList
      items={[
        "Prefer SharePoint or Dataverse knowledge sources over uploaded files for automatic refresh",
        "Use descriptive file names that help the retrieval engine find the right content",
        "Test with edge-case queries that probe content boundaries and gaps",
        "Enable strict grounding for factual or regulated content domains",
      ]}
    />

    <Spacer h={4} />
    <SubHeading>Connectors & MCP Servers</SubHeading>
    <BulletList
      items={[
        "Prefer MCP servers over connectors when both exist for a service \u2014 MCP provides broader capability with automatic tool discovery and updates without republishing",
        "Use connectors when you need per-action DLP governance or direct invocation from topics \u2014 MCP tools are only available through the generative orchestrator",
        "Check the built-in MCP catalog (25+ servers including Dataverse, Dynamics 365, Outlook, SharePoint, Teams) before building custom connectors",
        "For niche or legacy systems without MCP support, use custom connectors or the HTTP action with proper authentication configuration",
        "Test all tool integrations in the integration eval set before production deployment \u2014 verify real data flows end-to-end",
      ]}
    />

    <Spacer h={4} />
    <SubHeading>Evaluation & Testing</SubHeading>
    <BulletList
      items={[
        "Maintain 100% pass rate on critical (boundary) tests before expanding scope",
        "Include at least 3 test cases per capability for adequate coverage",
        "Run regression tests after every instruction or topic change",
        "Use semantic matching (Compare meaning 70%+) for conversational responses",
      ]}
    />

    <Spacer h={4} />
    <SubHeading>Deployment & Operations</SubHeading>
    <BulletList
      items={[
        "Publish to a test environment before production to validate end-to-end behavior",
        "Monitor conversation logs for the first 2 weeks post-launch to catch drift",
        "Set up fallback topics for unrecognized intents to prevent dead-ends",
        "Review knowledge sources quarterly to ensure content stays current",
      ]}
    />

    {isMultiAgent && (
      <>
        <Spacer h={4} />
        <SubHeading>Multi-Agent Architecture</SubHeading>
        <BulletList
          items={[
            "Keep specialist agents focused on a single domain for clearer routing",
            "Define explicit routing rules with unambiguous trigger phrases",
            "Test cross-agent handoff scenarios in the integration eval set",
          ]}
        />
      </>
    )}
  </View>
);

export default BestPractices;
