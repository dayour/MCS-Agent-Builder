import React from "react";
import { View, Text, Svg, Rect, StyleSheet } from "@react-pdf/renderer";
import { colors } from "./styles";

const s = StyleSheet.create({
  sectionHeading: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.navy,
    paddingLeft: 10,
    paddingVertical: 2,
  },
  sectionNumber: {
    fontSize: 8,
    fontWeight: 600,
    color: colors.s400,
    marginRight: 6,
    marginBottom: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: colors.navy,
  },
  subHeading: {
    fontSize: 10,
    fontWeight: 600,
    color: colors.navy,
    marginTop: 8,
    marginBottom: 4,
  },
  paragraph: {
    fontSize: 9,
    color: colors.s700,
    lineHeight: 1.5,
    marginBottom: 4,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 3,
    paddingLeft: 4,
  },
  bulletDot: {
    width: 4,
    fontSize: 9,
    color: colors.navy,
    marginRight: 6,
  },
  bulletText: {
    flex: 1,
    fontSize: 9,
    color: colors.s700,
    lineHeight: 1.5,
  },
  calloutBox: {
    backgroundColor: colors.navyBg,
    borderLeftWidth: 3,
    borderLeftColor: colors.navy,
    borderRadius: 3,
    padding: 10,
    marginVertical: 6,
  },
  calloutText: {
    fontSize: 8.5,
    color: colors.s700,
    lineHeight: 1.5,
    fontStyle: "italic",
  },
  kvRow: {
    flexDirection: "row",
    marginBottom: 4,
    alignItems: "baseline",
  },
  kvLabel: {
    fontSize: 7.5,
    fontWeight: 700,
    color: colors.s500,
    textTransform: "uppercase",
    width: 80,
    letterSpacing: 0.5,
  },
  kvValue: {
    flex: 1,
    fontSize: 9.5,
    color: colors.s900,
  },
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.s200,
    marginVertical: 12,
  },
  // Table styles
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.navy,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableHeaderCell: {
    fontSize: 7.5,
    fontWeight: 700,
    color: colors.white,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.3,
    borderBottomColor: colors.s200,
  },
  tableRowAlt: {
    backgroundColor: colors.s50,
  },
  tableCell: {
    fontSize: 8,
    color: colors.s700,
  },
  // Status pill
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  pillText: {
    fontSize: 7,
    fontWeight: 700,
    color: colors.white,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // Code block
  codeBlock: {
    fontFamily: "Courier",
    fontSize: 7.5,
    color: colors.s700,
    backgroundColor: colors.s100,
    borderWidth: 0.5,
    borderColor: colors.s200,
    borderRadius: 3,
    padding: 10,
    lineHeight: 1.6,
    marginVertical: 6,
  },
});

// ── Section Heading ───────────────────────────────────────────────

export const SectionHeading = ({ number, title }: { number: number; title: string }) => (
  <View style={s.sectionHeading} wrap={false}>
    <Text style={s.sectionNumber}>{String(number).padStart(2, "0")}</Text>
    <Text style={s.sectionTitle}>{title}</Text>
  </View>
);

// ── Sub Heading ───────────────────────────────────────────────────

export const SubHeading = ({ children }: { children: string }) => (
  <Text style={s.subHeading}>{children}</Text>
);

// ── Paragraph ─────────────────────────────────────────────────────

export const Paragraph = ({
  children,
  italic,
  bold,
  color,
  size,
}: {
  children: string;
  italic?: boolean;
  bold?: boolean;
  color?: string;
  size?: number;
}) => (
  <Text
    style={[
      s.paragraph,
      italic && { fontStyle: "italic" },
      bold && { fontWeight: 700 },
      color ? { color } : undefined,
      size ? { fontSize: size } : undefined,
    ]}
  >
    {children}
  </Text>
);

// ── Bullet List ───────────────────────────────────────────────────

export const BulletList = ({ items }: { items: string[] }) => (
  <View style={{ marginVertical: 4 }}>
    {items.map((item, i) => (
      <View key={i} style={s.bulletRow}>
        <Text style={s.bulletDot}>{"\u2022"}</Text>
        <Text style={s.bulletText}>{item}</Text>
      </View>
    ))}
  </View>
);

// ── Data Table ────────────────────────────────────────────────────

interface Column {
  header: string;
  flex: number;
}

export const DataTable = ({
  columns,
  rows,
}: {
  columns: Column[];
  rows: string[][];
}) => (
  <View style={{ marginVertical: 6 }}>
    {/* Header */}
    <View style={s.tableHeader} wrap={false}>
      {columns.map((col, i) => (
        <View key={i} style={{ flex: col.flex }}>
          <Text style={s.tableHeaderCell}>{col.header}</Text>
        </View>
      ))}
    </View>
    {/* Body */}
    {rows.map((row, ri) => (
      <View key={ri} style={[s.tableRow, ri % 2 === 1 && s.tableRowAlt]} wrap={false}>
        {row.map((cell, ci) => (
          <View key={ci} style={{ flex: columns[ci]?.flex ?? 1 }}>
            <Text style={s.tableCell}>{cell}</Text>
          </View>
        ))}
      </View>
    ))}
  </View>
);

// ── Callout Box ───────────────────────────────────────────────────

export const Callout = ({ children }: { children: string }) => (
  <View style={s.calloutBox} wrap={false}>
    <Text style={s.calloutText}>{children}</Text>
  </View>
);

// ── Key-Value Row ─────────────────────────────────────────────────

export const KeyValue = ({ label, value }: { label: string; value: string }) => (
  <View style={s.kvRow}>
    <Text style={s.kvLabel}>{label}</Text>
    <Text style={s.kvValue}>{safe(value)}</Text>
  </View>
);

// ── Progress Bar (SVG) ────────────────────────────────────────────

export const ProgressBar = ({
  value,
  width = 120,
  height = 8,
  color = colors.navy,
  bgColor = colors.s200,
}: {
  value: number;
  width?: number;
  height?: number;
  color?: string;
  bgColor?: string;
}) => {
  const clamped = Math.max(0, Math.min(100, value));
  const fillWidth = (clamped / 100) * width;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Rect x={0} y={0} width={width} height={height} rx={4} ry={4} fill={bgColor} />
      {fillWidth > 0 && (
        <Rect x={0} y={0} width={fillWidth} height={height} rx={4} ry={4} fill={color} />
      )}
    </Svg>
  );
};

// ── Status Pill ───────────────────────────────────────────────────

const pillColors: Record<string, string> = {
  mvp: colors.navy,
  future: colors.s500,
  passing: colors.green,
  failing: colors.red,
  building: colors.amber,
  not_started: colors.s400,
  draft: colors.s500,
  researched: colors.amber,
  ready: colors.navy,
  built: colors.green,
  resolved: colors.green,
  open: colors.amber,
};

export const StatusPill = ({ label }: { label: string }) => {
  const bg = pillColors[label.toLowerCase()] ?? colors.s400;
  return (
    <View style={[s.pill, { backgroundColor: bg }]} wrap={false}>
      <Text style={s.pillText}>{label}</Text>
    </View>
  );
};

// ── Status Dot ────────────────────────────────────────────────────

const dotColors: Record<string, string> = {
  passing: colors.green,
  failing: colors.red,
  building: colors.amber,
  not_started: colors.s400,
};

export const StatusDot = ({ status }: { status: string }) => {
  const fill = dotColors[status] ?? colors.s400;
  return (
    <Svg width={8} height={8} viewBox="0 0 8 8" style={{ marginRight: 4 }}>
      <Rect x={1} y={1} width={6} height={6} rx={3} ry={3} fill={fill} />
    </Svg>
  );
};

// ── Code Block ────────────────────────────────────────────────────

export const CodeBlock = ({ children }: { children: string }) => (
  <Text style={s.codeBlock}>{children}</Text>
);

// ── Divider ───────────────────────────────────────────────────────

export const Divider = () => <View style={s.divider} />;

// ── Microsoft Logo (SVG) ──────────────────────────────────────────

export const MsLogo = ({ size = 14 }: { size?: number }) => {
  const gap = size * 0.12;
  const sq = (size - gap) / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Rect x={0} y={0} width={sq} height={sq} fill={colors.msRed} />
      <Rect x={sq + gap} y={0} width={sq} height={sq} fill={colors.msGreen} />
      <Rect x={0} y={sq + gap} width={sq} height={sq} fill={colors.msBlue} />
      <Rect x={sq + gap} y={sq + gap} width={sq} height={sq} fill={colors.msYellow} />
    </Svg>
  );
};

// ── Helpers ───────────────────────────────────────────────────────

export const safe = (v: any): string =>
  v != null && v !== "" ? String(v) : "\u2014";

export const Spacer = ({ h = 8 }: { h?: number }) => (
  <View style={{ height: h }} />
);
