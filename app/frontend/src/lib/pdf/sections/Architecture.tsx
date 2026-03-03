import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { colors } from "../styles";
import {
  SectionHeading, SubHeading, Card, BulletList,
  Callout, DataTable, Divider, safe,
} from "../primitives";

const s = StyleSheet.create({
  patternCard: {
    backgroundColor: colors.primaryLight,
    borderWidth: 0.5,
    borderColor: colors.primaryMuted,
    borderRadius: 6,
    padding: 10,
    marginBottom: 6,
  },
  patternName: {
    fontSize: 12,
    fontWeight: 700,
    color: colors.primary,
    marginBottom: 2,
  },
  patternReason: {
    fontSize: 8,
    color: colors.muted,
    lineHeight: 1.5,
  },
  agentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginBottom: 2,
  },
  agentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 3,
  },
  agentName: {
    fontSize: 9,
    fontWeight: 600,
    color: colors.foreground,
  },
  agentRole: {
    fontSize: 8,
    color: colors.muted,
    lineHeight: 1.4,
  },
  agentMeta: {
    fontSize: 7.5,
    color: colors.muted,
    fontStyle: "italic",
  },
});

interface Props {
  data: any;
}

const Architecture = ({ data }: Props) => {
  if (!data) return null;
  return (
    <View>
      <SectionHeading title="Architecture" subtitle="Structure, channels, triggers, and specialist agents" />

      {/* Pattern card — matches the app's highlighted selection card */}
      <View style={s.patternCard} wrap={false}>
        <Text style={s.patternName}>{safe(data.pattern)}</Text>
        {data.patternReasoning && <Text style={s.patternReason}>{data.patternReasoning}</Text>}
      </View>

      {data.triggers?.length > 0 && (
        <>
          <SubHeading>Triggers</SubHeading>
          {data.triggers.map((t: any, i: number) => (
            <Card key={i}>
              <Text style={{ fontSize: 9, fontWeight: 600, color: colors.foreground }}>{safe(t.type)}</Text>
              {t.description && <Text style={{ fontSize: 8, color: colors.muted, marginTop: 1 }}>{t.description}</Text>}
            </Card>
          ))}
        </>
      )}

      {data.channels?.length > 0 && (
        <>
          <SubHeading>Channels</SubHeading>
          {data.channels.map((c: any, i: number) => (
            <Card key={i}>
              <Text style={{ fontSize: 9, fontWeight: 600, color: colors.foreground }}>{safe(c.name)}</Text>
              {c.reason && <Text style={{ fontSize: 8, color: colors.muted, marginTop: 1 }}>{c.reason}</Text>}
            </Card>
          ))}
        </>
      )}

      {data.childAgents?.length > 0 && (
        <>
          <SubHeading>Specialist Agents</SubHeading>
          {data.childAgents.map((c: any, i: number) => (
            <Card key={i}>
              <View style={s.agentRow}>
                <View style={s.agentDot} />
                <View style={{ flex: 1 }}>
                  <Text style={s.agentName}>{safe(c.name)}</Text>
                  <Text style={s.agentRole}>{safe(c.role)}</Text>
                  {c.routingRule && <Text style={s.agentMeta}>Route: {c.routingRule}</Text>}
                  {c.model && <Text style={s.agentMeta}>Model: {c.model}</Text>}
                </View>
              </View>
            </Card>
          ))}
        </>
      )}

      {data.scoring?.length > 0 && (
        <>
          <SubHeading>
            {`Architecture Score (${data.scoring.reduce((sum: number, f: any) => sum + (f.score || 0), 0)}/6)`}
          </SubHeading>
          <DataTable
            columns={[
              { header: "Factor", flex: 2 },
              { header: "Applies", flex: 1 },
              { header: "Notes", flex: 3 },
            ]}
            rows={data.scoring.map((f: any) => [safe(f.factor), f.score ? "Yes" : "No", safe(f.notes)])}
          />
        </>
      )}

      <Divider />
    </View>
  );
};

export default Architecture;
