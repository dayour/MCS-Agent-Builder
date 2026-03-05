import type { EvalSet, EvalMethod } from "@/types";
import { downloadFile } from "./reportGenerator";

/** CSV-escape a field: wrap in quotes if it contains commas, quotes, or newlines. */
function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Pick the first CSV-eligible method (skips "Capability use"). */
function pickCsvMethod(testMethods: EvalMethod[] | null | undefined, setMethods: EvalMethod[]): string {
  const methods = testMethods?.length ? testMethods : setMethods;
  const eligible = methods.find((m) => m.type !== "Capability use");
  return eligible?.type ?? setMethods[0]?.type ?? "General quality";
}

/** Generate CSV string from an eval set (MCS native eval import format). */
export function generateEvalCsv(set: EvalSet): string {
  const rows = ["Question,Expected response,Testing method"];
  const tests = set.tests.slice(0, 100); // MCS limit: 100 questions per CSV
  for (const test of tests) {
    if (!test.question.trim()) continue;
    const method = pickCsvMethod(test.methods, set.methods);
    rows.push(
      `${csvEscape(test.question)},${csvEscape(test.expected ?? "")},${csvEscape(method)}`
    );
  }
  return rows.join("\n");
}

/** Download a single eval set as CSV. */
export function downloadEvalCsv(set: EvalSet): void {
  if (set.tests.length === 0) return;
  const csv = generateEvalCsv(set);
  downloadFile(csv, `evals-${set.name}.csv`, "text/csv");
}

/** Download all non-empty eval sets as CSVs with a small delay between each. */
export function downloadAllEvalCsvs(sets: EvalSet[]): void {
  const nonEmpty = sets.filter((s) => s.tests.length > 0);
  nonEmpty.forEach((set, i) => {
    setTimeout(() => downloadEvalCsv(set), i * 300);
  });
}
