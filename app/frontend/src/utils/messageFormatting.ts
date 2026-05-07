/** Returns true if the line is a section divider (e.g. "--" or "---"). */
export const isDivider = (line: string): boolean => /^-{2,}$/.test(line.trim());

/** Returns true if the line is a bullet point (- or •) but not a divider. */
export const isBulletLine = (line: string): boolean => {
  const t = line.trim();
  return !isDivider(t) && (t.startsWith('-') || t.startsWith('•'));
};

/** Returns true if the line starts a numbered list item (e.g. "1. " or "1) "). */
export const isNumberedLine = (line: string): boolean => /^\d+[.)]\s+/.test(line.trim());
