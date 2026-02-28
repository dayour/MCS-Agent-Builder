import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { colors } from "./styles";
import { SectionHeading, SubHeading, BulletList, Spacer } from "./primitives";
import { RECOMMENDATION_CATEGORY_LABELS } from "@/types";
import type { Recommendation } from "@/types";

const s = StyleSheet.create({
  intro: {
    fontSize: 9,
    color: colors.s500,
    fontStyle: "italic",
    marginBottom: 8,
    lineHeight: 1.5,
  },
});

const CATEGORY_ORDER = Object.keys(RECOMMENDATION_CATEGORY_LABELS);

interface Props {
  sectionNumber: number;
  items: Recommendation[];
}

const BestPractices = ({ sectionNumber, items }: Props) => {
  // Group items by category
  const grouped = new Map<string, Recommendation[]>();
  for (const item of items) {
    const key = item.category || "other";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }

  // Sort groups: known categories in order first, then unknown
  const sortedKeys = [...grouped.keys()].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return (
    <View>
      <SectionHeading number={sectionNumber} title="Best Practices & Recommendations" />
      {items.length === 0 ? (
        <Text style={s.intro}>No recommendations generated yet.</Text>
      ) : (
        <>
          <Text style={s.intro}>
            Best practices and tailored recommendations for this agent.
          </Text>
          {sortedKeys.map((cat, i) => {
            const label = RECOMMENDATION_CATEGORY_LABELS[cat] ?? cat;
            const entries = grouped.get(cat)!;
            return (
              <React.Fragment key={cat}>
                {i > 0 && <Spacer h={4} />}
                <SubHeading>{label}</SubHeading>
                <BulletList items={entries.map((r) => r.text)} />
              </React.Fragment>
            );
          })}
        </>
      )}
    </View>
  );
};

export default BestPractices;
