import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { colors } from "./styles";
import { SectionHeading, SubHeading, BulletList, Spacer } from "./primitives";
import { sectionGuidelines } from "@/config/sectionGuidelines";

const s = StyleSheet.create({
  intro: {
    fontSize: 9,
    color: colors.s500,
    fontStyle: "italic",
    marginBottom: 8,
    lineHeight: 1.5,
  },
  tip: {
    fontSize: 8,
    color: colors.p600,
    marginTop: 2,
    marginBottom: 4,
    fontStyle: "italic",
  },
});

/** Map section IDs to human-readable titles. */
const SECTION_TITLES: Record<string, string> = {
  architecture: "Architecture",
  instructions: "Instructions",
  capabilities: "Capabilities",
  tools: "Tools",
  "knowledge-sources": "Knowledge Sources",
  "conversation-topics": "Conversation Topics",
  "scope-boundaries": "Scope & Boundaries",
  "eval-sets": "Eval Sets",
  "open-questions": "Open Questions",
};

interface Props {
  sectionNumber: number;
}

const BestPractices = ({ sectionNumber }: Props) => {
  const entries = Object.entries(sectionGuidelines);

  return (
    <View>
      <SectionHeading number={sectionNumber} title="Best Practices & Guidelines" />
      <Text style={s.intro}>
        Best practices and guidelines for each section of the agent brief.
      </Text>
      {entries.map(([sectionId, guide], i) => {
        const title = SECTION_TITLES[sectionId] ?? sectionId;
        return (
          <React.Fragment key={sectionId}>
            {i > 0 && <Spacer h={4} />}
            <SubHeading>{title}</SubHeading>
            <BulletList items={guide.bestPractices} />
            {guide.tip && <Text style={s.tip}>Tip: {guide.tip}</Text>}
          </React.Fragment>
        );
      })}
    </View>
  );
};

export default BestPractices;
