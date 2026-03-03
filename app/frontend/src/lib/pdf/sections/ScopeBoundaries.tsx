import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { colors } from "../styles";
import { SectionHeading, Card, BulletList, Divider } from "../primitives";

const s = StyleSheet.create({
  label: {
    fontSize: 7.5,
    fontWeight: 700,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
});

interface Props {
  data: any;
}

const ScopeBoundaries = ({ data }: Props) => {
  if (!data) return null;
  const hasContent = data.handles?.length || data.politelyDeclines?.length || data.hardRefuses?.length;
  if (!hasContent) return null;

  return (
    <View>
      <SectionHeading title="Scope & Boundaries" subtitle="What the agent handles, declines, and refuses" />

      {data.handles?.length > 0 && (
        <Card accentColor={colors.green}>
          <Text style={s.label}>Handles</Text>
          <BulletList items={data.handles} dotColor={colors.green} />
        </Card>
      )}

      {data.politelyDeclines?.length > 0 && (
        <Card accentColor={colors.amber}>
          <Text style={s.label}>Politely Declines</Text>
          <BulletList items={data.politelyDeclines} dotColor={colors.amber} />
        </Card>
      )}

      {data.hardRefuses?.length > 0 && (
        <Card accentColor={colors.red}>
          <Text style={s.label}>Hard Refuses</Text>
          <BulletList items={data.hardRefuses} dotColor={colors.red} />
        </Card>
      )}

      <Divider />
    </View>
  );
};

export default ScopeBoundaries;
