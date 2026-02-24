import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { colors } from "./styles";
import { SectionHeading, ProgressBar, Paragraph, BulletList, Spacer } from "./primitives";

const s = StyleSheet.create({
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginVertical: 10,
  },
  metricCard: {
    width: "23%",
    backgroundColor: colors.navyBg,
    borderRadius: 4,
    padding: 10,
    alignItems: "center",
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 700,
    color: colors.navy,
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 7,
    fontWeight: 600,
    color: colors.s500,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  readinessRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 8,
    padding: 10,
    backgroundColor: colors.navyBg,
    borderRadius: 4,
  },
  readinessLabel: {
    fontSize: 9,
    fontWeight: 600,
    color: colors.s700,
    width: 60,
  },
  readinessValue: {
    fontSize: 10,
    fontWeight: 700,
    color: colors.navy,
  },
});

interface Props {
  sectionNumber: number;
  briefData: Record<string, any>;
  readiness: number;
}

const ExecutiveSummary = ({ sectionNumber, briefData, readiness }: Props) => {
  const bc = briefData["business-context"];
  const caps = briefData["capabilities"]?.items ?? [];
  const tools = briefData["tools"]?.items ?? [];
  const ks = briefData["knowledge-sources"]?.items ?? [];
  const evalSets = briefData["eval-sets"]?.sets ?? [];
  const oq = briefData["open-questions"]?.items ?? [];

  // Compute metrics
  const mvpCaps = caps.filter((c: any) => (c.phase || "").toLowerCase() === "mvp");
  const futureCaps = caps.filter((c: any) => (c.phase || "").toLowerCase() === "future");
  const totalTests = evalSets.reduce((sum: number, es: any) => sum + (es.tests?.length ?? 0), 0);
  const testedTests = evalSets.reduce(
    (sum: number, es: any) =>
      sum + (es.tests?.filter((t: any) => t.lastResult != null).length ?? 0),
    0,
  );
  const passedTests = evalSets.reduce(
    (sum: number, es: any) =>
      sum + (es.tests?.filter((t: any) => t.lastResult?.pass).length ?? 0),
    0,
  );
  const passRate = testedTests > 0 ? Math.round((passedTests / testedTests) * 100) : null;

  // Top priorities: unresolved questions
  const priorities: string[] = [];
  const unresolvedQs = oq.filter((q: any) => q.status !== "resolved");
  unresolvedQs.slice(0, 3).forEach((q: any) => priorities.push(`Resolve: ${q.question}`));

  // Description paragraph
  const descText = bc?.problemStatement
    ? bc.problemStatement
    : "No business context has been defined yet. Complete the Business Context section to generate an executive summary.";

  return (
    <View>
      <SectionHeading number={sectionNumber} title="Executive Summary" />

      <Paragraph>{descText}</Paragraph>
      <Spacer h={6} />

      {/* Metrics grid */}
      <View style={s.metricsGrid}>
        <View style={s.metricCard} wrap={false}>
          <Text style={s.metricValue}>{caps.length}</Text>
          <Text style={s.metricLabel}>
            Capabilities{mvpCaps.length > 0 ? `\n(${mvpCaps.length} MVP / ${futureCaps.length} Future)` : ""}
          </Text>
        </View>
        <View style={s.metricCard} wrap={false}>
          <Text style={s.metricValue}>{tools.length}</Text>
          <Text style={s.metricLabel}>Integrations</Text>
        </View>
        <View style={s.metricCard} wrap={false}>
          <Text style={s.metricValue}>{ks.length}</Text>
          <Text style={s.metricLabel}>Knowledge{"\n"}Sources</Text>
        </View>
        <View style={s.metricCard} wrap={false}>
          <Text style={s.metricValue}>{totalTests}</Text>
          <Text style={s.metricLabel}>
            Eval Tests{passRate !== null ? `\n(${passRate}% pass)` : ""}
          </Text>
        </View>
      </View>

      {/* Readiness bar */}
      <View style={s.readinessRow} wrap={false}>
        <Text style={s.readinessLabel}>Readiness</Text>
        <ProgressBar value={readiness} width={200} height={10} />
        <Text style={s.readinessValue}>{readiness}%</Text>
      </View>

      {/* Top priorities */}
      {priorities.length > 0 && (
        <>
          <Spacer h={6} />
          <Text style={{ fontSize: 10, fontWeight: 600, color: colors.navy, marginBottom: 4 }}>
            Top Priorities
          </Text>
          <BulletList items={priorities} />
        </>
      )}
    </View>
  );
};

export default ExecutiveSummary;
