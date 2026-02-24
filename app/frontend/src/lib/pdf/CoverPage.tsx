import React from "react";
import { Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { colors, page } from "./styles";
import { MsLogo, StatusPill, ProgressBar, Spacer } from "./primitives";

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: colors.white,
    justifyContent: "center",
    paddingHorizontal: page.marginLeft + 20,
    paddingVertical: 80,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 60,
  },
  logoText: {
    fontSize: 12,
    color: colors.s500,
    fontWeight: 400,
  },
  title: {
    fontSize: 32,
    fontWeight: 700,
    color: colors.navy,
    marginBottom: 6,
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: 16,
    color: colors.s500,
    marginBottom: 24,
  },
  description: {
    fontSize: 11,
    color: colors.s700,
    lineHeight: 1.6,
    marginBottom: 30,
    maxWidth: 400,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  readinessRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 40,
  },
  readinessLabel: {
    fontSize: 8,
    fontWeight: 600,
    color: colors.s500,
  },
  readinessValue: {
    fontSize: 8,
    fontWeight: 700,
    color: colors.navy,
  },
  dateLine: {
    fontSize: 9,
    color: colors.s400,
    marginBottom: 6,
  },
  confidential: {
    fontSize: 8,
    fontWeight: 700,
    color: colors.s400,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 60,
  },
});

interface Props {
  agentName: string;
  description: string;
  status: string;
  readiness: number;
}

const CoverPage = ({ agentName, description, status, readiness }: Props) => {
  const date = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Page size="A4" style={s.page}>
      <View style={s.logoRow}>
        <MsLogo size={18} />
        <Text style={s.logoText}>Microsoft</Text>
      </View>

      <Text style={s.title}>{agentName}</Text>
      <Text style={s.subtitle}>Agent Brief</Text>

      {description ? <Text style={s.description}>{description}</Text> : null}

      <View style={s.statusRow}>
        <StatusPill label={status} />
      </View>

      <View style={s.readinessRow}>
        <Text style={s.readinessLabel}>Readiness</Text>
        <ProgressBar value={readiness} width={140} height={8} />
        <Text style={s.readinessValue}>{readiness}%</Text>
      </View>

      <Text style={s.dateLine}>Generated {date}</Text>

      <Spacer h={20} />
      <Text style={s.confidential}>Confidential</Text>
    </Page>
  );
};

export default CoverPage;
