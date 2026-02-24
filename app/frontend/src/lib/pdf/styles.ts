import { StyleSheet, Font } from "@react-pdf/renderer";

// Use built-in Helvetica — no CDN downloads, instant generation.
// react-pdf includes Helvetica with normal/bold/italic/bolditalic variants.

// Disable hyphenation for cleaner text
Font.registerHyphenationCallback((word) => [word]);

// ── Color palette ─────────────────────────────────────────────────
export const colors = {
  navy: "#10244C",
  navyBg: "#F0F3F9",
  s900: "#0F172A",
  s700: "#334155",
  s500: "#64748B",
  s400: "#94A3B8",
  s200: "#E2E8F0",
  s100: "#F1F5F9",
  s50: "#F8FAFC",
  white: "#FFFFFF",
  green: "#16A34A",
  amber: "#B4780A",
  red: "#C8323C",
  msRed: "#F35325",
  msGreen: "#81BC06",
  msBlue: "#05A6F0",
  msYellow: "#FFBA08",
};

// ── Page dimensions (A4 in points) ────────────────────────────────
export const page = {
  width: 595.28,
  height: 841.89,
  marginTop: 60,
  marginBottom: 50,
  marginLeft: 55,
  marginRight: 55,
};

export const contentWidth = page.width - page.marginLeft - page.marginRight;

// ── Shared styles ─────────────────────────────────────────────────
export const baseStyles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: colors.s700,
    paddingTop: page.marginTop,
    paddingBottom: page.marginBottom,
    paddingLeft: page.marginLeft,
    paddingRight: page.marginRight,
  },
  // Header (fixed on every page)
  header: {
    position: "absolute",
    top: 18,
    left: page.marginLeft,
    right: page.marginRight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.s200,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerText: {
    fontSize: 7,
    color: colors.s500,
  },
  headerRight: {
    fontSize: 6.5,
    color: colors.s400,
  },
  // Footer (fixed on every page)
  footer: {
    position: "absolute",
    bottom: 16,
    left: page.marginLeft,
    right: page.marginRight,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.5,
    borderTopColor: colors.s200,
    paddingTop: 6,
  },
  footerText: {
    fontSize: 6.5,
    color: colors.s400,
  },
});
