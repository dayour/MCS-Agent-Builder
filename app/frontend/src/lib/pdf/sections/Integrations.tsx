import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { colors } from "../styles";
import { SectionHeading, StatusPill, Divider, safe } from "../primitives";

const s = StyleSheet.create({
  table: { marginVertical: 6 },
  header: {
    flexDirection: "row",
    backgroundColor: colors.navy,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  headerCell: { fontSize: 7.5, fontWeight: 700, color: colors.white },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.3,
    borderBottomColor: colors.s200,
  },
  rowAlt: { backgroundColor: colors.s50 },
  cell: { fontSize: 8, color: colors.s700 },
});

interface Props {
  data: any;
  sectionNumber: number;
}

const Integrations = ({ data, sectionNumber }: Props) => {
  const items = data?.items;
  if (!items?.length) return null;

  return (
    <View>
      <SectionHeading number={sectionNumber} title="Integrations" />

      <View style={s.table}>
        <View style={s.header} wrap={false}>
          <View style={{ flex: 2 }}><Text style={s.headerCell}>Tool</Text></View>
          <View style={{ flex: 2 }}><Text style={s.headerCell}>Type</Text></View>
          <View style={{ flex: 1 }}><Text style={s.headerCell}>Auth</Text></View>
          <View style={{ flex: 1 }}><Text style={s.headerCell}>Phase</Text></View>
        </View>

        {items.map((t: any, i: number) => (
          <View key={i} style={[s.row, i % 2 === 1 && s.rowAlt]} wrap={false}>
            <View style={{ flex: 2 }}>
              <Text style={[s.cell, { fontWeight: 600, color: colors.s900 }]}>{safe(t.name)}</Text>
            </View>
            <View style={{ flex: 2 }}>
              <Text style={s.cell}>{safe(t.type)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cell}>{safe(t.auth)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <StatusPill label={t.phase || "MVP"} />
            </View>
          </View>
        ))}
      </View>

      <Divider />
    </View>
  );
};

export default Integrations;
