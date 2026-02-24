import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { colors } from "../styles";
import { SectionHeading, safe } from "../primitives";

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.s50,
    borderRadius: 4,
    padding: 10,
    marginBottom: 6,
  },
  cardResolved: {
    backgroundColor: colors.navyBg,
  },
  question: {
    fontSize: 9,
    fontWeight: 700,
    color: colors.s900,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    fontSize: 7,
    color: colors.s500,
  },
  statusBadge: {
    fontSize: 6.5,
    fontWeight: 700,
    color: colors.white,
    backgroundColor: colors.green,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  statusOpen: {
    backgroundColor: colors.amber,
  },
  resolution: {
    fontSize: 8,
    color: colors.s700,
    fontStyle: "italic",
    marginTop: 4,
  },
});

interface Props {
  data: any;
  sectionNumber: number;
}

const OpenQuestions = ({ data, sectionNumber }: Props) => {
  const items = data?.items;
  if (!items?.length) return null;

  return (
    <View>
      <SectionHeading number={sectionNumber} title="Open Questions" />

      {items.map((q: any, i: number) => {
        const resolved = q.status === "resolved";
        // Use assignee field but display as "Notes"
        const notes = q.notes || q.assignee || "";
        return (
          <View key={i} style={[s.card, resolved && s.cardResolved]} wrap={false}>
            <Text style={s.question}>{safe(q.question)}</Text>
            <View style={s.metaRow}>
              <Text style={[s.statusBadge, !resolved && s.statusOpen]}>
                {resolved ? "Resolved" : "Open"}
              </Text>
              {q.priority && <Text style={s.metaText}>Priority: {q.priority}</Text>}
              {notes ? <Text style={s.metaText}>Notes: {notes}</Text> : null}
            </View>
            {resolved && q.resolution && (
              <Text style={s.resolution}>{q.resolution}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
};

export default OpenQuestions;
