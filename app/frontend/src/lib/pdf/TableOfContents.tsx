import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { colors } from "./styles";

const s = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: colors.navy,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: colors.navy,
    paddingLeft: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "baseline",
    paddingVertical: 5,
    borderBottomWidth: 0.3,
    borderBottomColor: colors.s200,
  },
  number: {
    fontSize: 9,
    fontWeight: 600,
    color: colors.s400,
    width: 24,
  },
  label: {
    flex: 1,
    fontSize: 10,
    color: colors.s900,
  },
});

interface TocEntry {
  number: number;
  title: string;
}

const TableOfContents = ({ entries }: { entries: TocEntry[] }) => (
  <View style={s.container}>
    <Text style={s.title}>Contents</Text>
    {entries.map((e) => (
      <View key={e.number} style={s.row} wrap={false}>
        <Text style={s.number}>{String(e.number).padStart(2, "0")}</Text>
        <Text style={s.label}>{e.title}</Text>
      </View>
    ))}
  </View>
);

export default TableOfContents;
