import type { SourceScores } from "../benchmarks.js";
import { fetchText } from "../http.js";

/** Epoch Capabilities Index, one row per model. CC BY 4.0, see https://epoch.ai/benchmarks. */
export const EPOCH_ECI_URL = "https://epoch.ai/data/eci_scores.csv";
/** The benchmark results the index is fitted on, one row per model version and benchmark. */
export const EPOCH_BENCHMARKS_URL = "https://epoch.ai/data/eci_benchmarks.csv";
/** Run by Epoch itself. Its coding numbers mostly come from third parties, so coding comes from LMArena. */
const MATH_BENCHMARK = "OTIS Mock AIME 2024-2025";

/** Parses RFC 4180 CSV into rows keyed by the header. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const endField = () => {
    row.push(field.replace(/\r$/, ""));
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted && c === '"' && text[i + 1] === '"') {
      field += '"';
      i++;
    } else if (c === '"') quoted = !quoted;
    else if (quoted) field += c;
    else if (c === ",") endField();
    else if (c === "\n") endRow();
    else field += c;
  }
  if (field || row.length) endRow();
  const [header = [], ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

const num = (s: string | undefined) => (s?.trim() ? Number(s) : NaN);

function requireColumns(rows: Record<string, string>[], columns: string[], file: string): void {
  const missing = columns.filter((c) => rows[0] && !(c in rows[0]));
  if (missing.length) throw new Error(`${file} has no ${missing.join(", ")} column`);
}

/**
 * Scores per Epoch model name: the index with its 90% confidence interval, and the math benchmark.
 * A model has a row per version (reasoning effort...); the best one counts.
 */
export function parseEpoch(eciCsv: string, benchmarksCsv: string): SourceScores {
  const out: SourceScores = new Map();
  const eci = parseCsv(eciCsv);
  requireColumns(eci, ["Model", "eci", "eci_ci_low", "eci_ci_high"], "eci_scores.csv");
  for (const r of eci) {
    const [value, low, high] = [num(r.eci), num(r.eci_ci_low), num(r.eci_ci_high)];
    if (!r.Model || Number.isNaN(value)) continue;
    out.set(r.Model, { capabilities: { value, ...(!Number.isNaN(low) && !Number.isNaN(high) && { ci: [low, high] }) } });
  }
  const results = parseCsv(benchmarksCsv);
  requireColumns(results, ["Model", "benchmark", "performance"], "eci_benchmarks.csv");
  for (const r of results) {
    const value = num(r.performance);
    if (r.benchmark !== MATH_BENCHMARK || !r.Model || Number.isNaN(value)) continue;
    const scores = out.get(r.Model) ?? {};
    if (!scores.math || value > scores.math.value) scores.math = { value: Math.round(value * 1e4) / 1e4 };
    out.set(r.Model, scores);
  }
  return out;
}

export async function fetchEpoch(): Promise<SourceScores> {
  const [eci, results] = await Promise.all([fetchText(EPOCH_ECI_URL), fetchText(EPOCH_BENCHMARKS_URL)]);
  return parseEpoch(eci, results);
}
