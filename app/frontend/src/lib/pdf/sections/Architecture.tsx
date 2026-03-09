import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { colors } from "../styles";
import {
  SectionHeading, SubHeading, Card, BulletList,
  Callout, DataTable, Divider, safe,
} from "../primitives";

const SOLUTION_TYPE_LABELS: Record<string, string> = {
  agent: "Agent",
  flow: "Power Automate Flow",
  hybrid: "Hybrid (Agent + Flow)",
  "not-recommended": "Not Recommended",
};

const s = StyleSheet.create({
  solutionTypeCard: {
    borderWidth: 0.5,
    borderRadius: 6,
    padding: 10,
    marginBottom: 6,
  },
  solutionTypeName: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 2,
  },
  altRecCard: {
    backgroundColor: "#fffbeb",
    borderWidth: 0.5,
    borderColor: "#f59e0b",
    borderRadius: 6,
    padding: 10,
    marginBottom: 6,
  },
  altRecLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: "#d97706",
    marginBottom: 2,
  },
  altRecText: {
    fontSize: 8,
    color: colors.foreground,
    lineHeight: 1.5,
  },
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

/** Split a paragraph string into bullet-point lines. */
function toBullets(text: string): string[] {
  if (!text) return [];
  // If already bullet-formatted, split on newlines
  const lines = text.split(/\n/).map(l => l.replace(/^[\s\-\u2022*]+/, "").trim()).filter(Boolean);
  if (lines.length > 1) return lines;
  // Split long paragraphs on sentence boundaries
  return text.split(/\.\s+/).map(s => s.replace(/\.$/, "").trim()).filter(Boolean);
}

const Architecture = ({ data }: Props) => {
  if (!data) return null;

  // Merge architecture score into the design card
  const archScore = data.scoring?.length > 0
    ? data.scoring.reduce((sum: number, f: any) => sum + (f.score || 0), 0)
    : null;

  return (
    <View>
      <SectionHeading title="Architecture" subtitle="Design pattern, channels, triggers, and specialist agents" />

      {/* Solution type — single line */}
      {data.solutionType && (
        <View style={{
          ...s.solutionTypeCard,
          backgroundColor: data.solutionType === "agent" ? colors.primaryLight : data.solutionType === "flow" ? "#f3e8ff" : data.solutionType === "hybrid" ? "#fffbeb" : "#fef2f2",
          borderColor: data.solutionType === "agent" ? colors.primaryMuted : data.solutionType === "flow" ? "#a855f7" : data.solutionType === "hybrid" ? "#f59e0b" : "#ef4444",
        }} wrap={false}>
          <Text style={{
            ...s.solutionTypeName,
            color: data.solutionType === "agent" ? colors.primary : data.solutionType === "flow" ? "#7c3aed" : data.solutionType === "hybrid" ? "#d97706" : "#dc2626",
          }}>
            {SOLUTION_TYPE_LABELS[data.solutionType] ?? data.solutionType} — {data.solutionTypeScore ?? 0}/5
          </Text>
          {data.solutionTypeReason && (
            <BulletList items={toBullets(data.solutionTypeReason)} />
          )}
        </View>
      )}

      {/* Alternative recommendation */}
      {data.alternativeRecommendation && (data.solutionType === "flow" || data.solutionType === "not-recommended") && (
        <View style={s.altRecCard} wrap={false}>
          <Text style={s.altRecLabel}>Recommended Alternative</Text>
          <BulletList items={toBullets(data.alternativeRecommendation)} />
        </View>
      )}

      {/* Design pattern — merged with architecture score */}
      <View style={s.patternCard} wrap={false}>
        <Text style={s.patternName}>
          {safe(data.pattern)}{archScore != null ? ` (${archScore}/6)` : ""}
        </Text>
        {data.patternReasoning && (
          <BulletList items={toBullets(data.patternReasoning)} />
        )}
      </View>

      {/* Scoring factors as compact list — only if there are factors */}
      {data.scoring?.length > 0 && (
        <Card>
          <BulletList
            items={data.scoring.map((f: any) =>
              `${safe(f.factor)}: ${f.score ? "Yes" : "No"}${f.notes ? ` — ${f.notes}` : ""}`
            )}
          />
        </Card>
      )}

      {data.triggers?.length > 0 && (
        <>
          <SubHeading>Triggers</SubHeading>
          <Card>
            <BulletList items={data.triggers.map((t: any) =>
              `${safe(t.type)}${t.description ? ` — ${t.description}` : ""}`
            )} />
          </Card>
        </>
      )}

      {data.channels?.length > 0 && (
        <>
          <SubHeading>Channels</SubHeading>
          <Card>
            <BulletList items={data.channels.map((c: any) =>
              `${safe(c.name)}${c.reason ? ` — ${c.reason}` : ""}`
            )} />
          </Card>
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

      <Divider />
    </View>
  );
};

export default Architecture;
