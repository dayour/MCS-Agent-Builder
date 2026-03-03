import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { colors } from "../styles";
import { SectionHeading, SubHeading, Divider, safe } from "../primitives";

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.s50,
    borderRadius: 4,
    padding: 10,
    marginBottom: 8,
  },
  cardOverridden: {
    borderLeftWidth: 3,
    borderLeftColor: colors.amber,
  },
  cardConfirmed: {
    borderLeftWidth: 3,
    borderLeftColor: colors.green,
  },
  cardPending: {
    borderLeftWidth: 3,
    borderLeftColor: colors.s400,
  },
  title: {
    fontSize: 10,
    fontWeight: 700,
    color: colors.s900,
    marginBottom: 3,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  metaText: {
    fontSize: 7,
    color: colors.s500,
  },
  statusBadge: {
    fontSize: 6.5,
    fontWeight: 700,
    color: colors.white,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  context: {
    fontSize: 8,
    color: colors.s700,
    lineHeight: 1.5,
    marginBottom: 6,
  },
  // Options table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.navy,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  headerCell: { fontSize: 7, fontWeight: 700, color: colors.white },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.3,
    borderBottomColor: colors.s200,
  },
  rowSelected: {
    backgroundColor: colors.navyBg,
  },
  rowAlt: { backgroundColor: colors.s50 },
  cell: { fontSize: 7.5, color: colors.s700 },
  cellBold: { fontSize: 7.5, fontWeight: 600, color: colors.s900 },
  tag: {
    fontSize: 6,
    fontWeight: 700,
    color: colors.navy,
    backgroundColor: colors.navyBg,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginLeft: 4,
  },
  pendingNote: {
    fontSize: 8,
    color: colors.amber,
    fontWeight: 600,
    marginTop: 4,
  },
});

const statusColors: Record<string, string> = {
  pending: colors.s400,
  confirmed: colors.green,
  overridden: colors.amber,
};

const statusCardStyle: Record<string, any> = {
  pending: s.cardPending,
  confirmed: s.cardConfirmed,
  overridden: s.cardOverridden,
};

interface Props {
  data: any;
  sectionNumber: number;
}

const Decisions = ({ data, sectionNumber }: Props) => {
  const items = data?.items;
  if (!items?.length) return null;

  const pending = items.filter((d: any) => d.status === "pending");

  return (
    <View>
      <SectionHeading number={sectionNumber} title="Decisions" />

      {pending.length > 0 && (
        <View style={{ backgroundColor: "#FEF3C7", borderRadius: 4, padding: 8, marginBottom: 8 }} wrap={false}>
          <Text style={{ fontSize: 8, fontWeight: 700, color: colors.amber }}>
            {pending.length} pending decision{pending.length > 1 ? "s" : ""} require resolution before build.
          </Text>
        </View>
      )}

      {items.map((d: any, i: number) => (
        <View key={i} style={[s.card, statusCardStyle[d.status] || s.cardPending]} wrap={false}>
          <Text style={s.title}>{safe(d.title)}</Text>
          <View style={s.metaRow}>
            <Text style={[s.statusBadge, { backgroundColor: statusColors[d.status] || colors.s400 }]}>
              {(d.status || "pending").toUpperCase()}
            </Text>
            <Text style={s.metaText}>{safe(d.category)}</Text>
            {d.capability && <Text style={s.metaText}>{d.capability}</Text>}
          </View>
          {d.context && <Text style={s.context}>{d.context}</Text>}

          {/* Options mini-table */}
          <View>
            <View style={s.tableHeader}>
              <View style={{ flex: 2 }}><Text style={s.headerCell}>Option</Text></View>
              <View style={{ flex: 3 }}><Text style={s.headerCell}>Summary</Text></View>
              <View style={{ flex: 1 }}><Text style={s.headerCell}>Confidence</Text></View>
            </View>
            {(d.options ?? []).map((o: any, oi: number) => {
              const isSelected = o.id === d.selectedOptionId;
              const isRecommended = o.id === d.recommendedOptionId;
              return (
                <View
                  key={oi}
                  style={[s.row, isSelected && s.rowSelected, !isSelected && oi % 2 === 1 && s.rowAlt]}
                >
                  <View style={{ flex: 2, flexDirection: "row", alignItems: "center" }}>
                    <Text style={isSelected ? s.cellBold : s.cell}>{safe(o.label)}</Text>
                    {isSelected && <Text style={s.tag}>SELECTED</Text>}
                    {isRecommended && !isSelected && <Text style={[s.tag, { color: colors.s500, backgroundColor: colors.s100 }]}>REC</Text>}
                  </View>
                  <View style={{ flex: 3 }}>
                    <Text style={s.cell}>{safe(o.summary)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cell}>{safe(o.confidence)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ))}

      <Divider />
    </View>
  );
};

export default Decisions;
