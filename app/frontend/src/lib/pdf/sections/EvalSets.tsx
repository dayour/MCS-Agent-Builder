import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { colors } from "../styles";
import {
  SectionHeading, SubHeading, Paragraph,
  DataTable, ProgressBar, Divider, Spacer, safe,
} from "../primitives";

const s = StyleSheet.create({
  setHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  passRate: {
    fontSize: 9,
    fontWeight: 700,
    color: colors.navy,
  },
  methodsText: {
    fontSize: 7.5,
    color: colors.s500,
    marginBottom: 6,
  },
  resultPass: {
    fontSize: 8,
    fontWeight: 600,
    color: colors.green,
  },
  resultFail: {
    fontSize: 8,
    fontWeight: 600,
    color: colors.red,
  },
  resultNone: {
    fontSize: 8,
    color: colors.s400,
  },
});

interface Props {
  data: any;
  sectionNumber: number;
}

const EvalSets = ({ data, sectionNumber }: Props) => {
  const sets = data?.sets;
  if (!sets?.length) return null;

  return (
    <View>
      <SectionHeading number={sectionNumber} title="Eval Sets" />

      {sets.map((set: any, si: number) => {
        const tests = set.tests ?? [];
        const tested = tests.filter((t: any) => t.lastResult != null);
        const passed = tested.filter((t: any) => t.lastResult?.pass).length;
        const rate = tested.length > 0 ? Math.round((passed / tested.length) * 100) : null;

        const methodsStr = (set.methods ?? [])
          .map((m: any) => {
            if (m.score != null) return `${m.type} (${m.score}%)`;
            if (m.mode) return `${m.type} (${m.mode})`;
            return m.type;
          })
          .join(", ");

        const setTitle = `${set.name.charAt(0).toUpperCase() + set.name.slice(1)} (target: ${set.passThreshold}%)`;

        return (
          <View key={si}>
            <View style={s.setHeader} wrap={false}>
              <SubHeading>{setTitle}</SubHeading>
              {rate !== null && (
                <>
                  <ProgressBar
                    value={rate}
                    width={80}
                    height={6}
                    color={rate >= set.passThreshold ? colors.green : colors.red}
                  />
                  <Text style={s.passRate}>{rate}%</Text>
                </>
              )}
            </View>

            {set.description && (
              <Paragraph italic color={colors.s500}>
                {set.description}
              </Paragraph>
            )}
            {methodsStr && <Text style={s.methodsText}>Methods: {methodsStr}</Text>}

            {tests.length > 0 && (
              <DataTable
                columns={[
                  { header: "Question", flex: 3 },
                  { header: "Expected", flex: 3 },
                  { header: "Capability", flex: 2 },
                  { header: "Result", flex: 1 },
                ]}
                rows={tests.map((t: any) => {
                  const result =
                    t.lastResult == null
                      ? "\u2014"
                      : t.lastResult.pass
                        ? "\u2713 Pass"
                        : "\u2717 Fail";
                  return [safe(t.question), safe(t.expected), safe(t.capability), result];
                })}
              />
            )}
            <Spacer h={6} />
          </View>
        );
      })}

      <Divider />
    </View>
  );
};

export default EvalSets;
