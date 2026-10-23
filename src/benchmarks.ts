import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { z } from "zod";
import type { Catalog } from "./catalog.js";
import type { Labs } from "./facts.js";
import { HardError } from "./model.js";
import type { Warnings } from "./warnings.js";

/** Chat models only. `capabilities` and `math` come from Epoch AI, `coding` from LMArena. */
export const BENCHMARKS = ["capabilities", "coding", "math"] as const;
export type Benchmark = (typeof BENCHMARKS)[number];

/** Each source is also the field in labs/ that names the model there. Both publish under CC BY 4.0. */
export const BENCHMARK_SOURCES = ["epoch", "lmarena"] as const;
export type BenchmarkSource = (typeof BENCHMARK_SOURCES)[number];

export const BENCHMARK_SOURCE: Record<Benchmark, BenchmarkSource> = { capabilities: "epoch", coding: "lmarena", math: "epoch" };

export const scoreSchema = z.object({
  value: z.number(),
  /** Share of the models the source rates that score lower, 0 to 100: the scale the site shows. */
  percentile: z.number().int().min(0).max(100),
  /** Confidence interval, when the source gives one. */
  ci: z.tuple([z.number(), z.number()]).optional(),
  /** Votes behind an arena rating. */
  votes: z.number().int().nonnegative().optional(),
  source: z.enum(BENCHMARK_SOURCES),
  /** The model's name at the source, as labs/ gives it. */
  name: z.string(),
  at: z.string(),
  stale_since: z.string().optional(),
});
export type Score = z.infer<typeof scoreSchema>;

export const scoresSchema = z.partialRecord(z.enum(BENCHMARKS), scoreSchema);
export type Scores = z.infer<typeof scoresSchema>;

/**
 * Models outside the catalog to compare against on one benchmark: the latest of each family in
 * benchmarks.yaml, and the best open-weight model.
 */
export const fieldSchema = z.object({
  source: z.enum(BENCHMARK_SOURCES),
  at: z.string(),
  stale_since: z.string().optional(),
  references: z.array(
    z.object({
      /** The family from benchmarks.yaml, or "Best open weights". */
      family: z.string(),
      /** The model's name at the source. */
      name: z.string(),
      value: z.number(),
    }),
  ),
});
export type Field = z.infer<typeof fieldSchema>;
export const fieldsSchema = z.partialRecord(z.enum(BENCHMARKS), fieldSchema);
export type Fields = z.infer<typeof fieldsSchema>;

/** One source's scores per model name, as parsed. */
export type RawScores = Map<string, Partial<Record<Benchmark, Pick<Score, "value" | "ci" | "votes">>>>;
/** The same, with each score's percentile. */
export type SourceScores = Map<string, Partial<Record<Benchmark, Pick<Score, "value" | "percentile" | "ci" | "votes">>>>;

/** Fills in each score's percentile among every model the source rates on that benchmark. */
export function withPercentiles(scores: RawScores): SourceScores {
  const out: SourceScores = new Map();
  for (const b of BENCHMARKS) {
    const values = [...scores.values()].flatMap((s) => (s[b] ? [s[b].value] : []));
    for (const [name, s] of scores) {
      const score = s[b];
      if (!score) continue;
      const below = values.filter((v) => v < score.value).length;
      const percentile = values.length > 1 ? Math.round((100 * below) / (values.length - 1)) : 100;
      out.set(name, { ...out.get(name), [b]: { ...score, percentile } });
    }
  }
  return out;
}

/** What a source gives: scores per model name, and which of those models have open weights. */
export interface SourceData {
  scores: SourceScores;
  open: Set<string>;
}

export type BenchmarkFetch = ({ ok: true; fetched_at: string } & SourceData) | { ok: false; error: string };

/**
 * Scores per canonical id, for lab models that give their name at a source (`epoch`, `lmarena` in
 * labs/). Names match exactly. A failed source reuses the previous catalog's scores for the same
 * names, marked `stale_since`.
 */
export function matchBenchmarks(
  labs: Labs,
  fetched: Record<BenchmarkSource, BenchmarkFetch>,
  previous: Catalog | undefined,
  warnings: Warnings,
): Record<string, Scores> {
  const out: Record<string, Scores> = {};
  const reused: Partial<Record<BenchmarkSource, number>> = {};
  for (const source of BENCHMARK_SOURCES) {
    const f = fetched[source];
    if (!f.ok) warnings.add({ code: "source_failed", message: `${source} benchmarks failed: ${f.error}` });
  }
  for (const [lab, l] of Object.entries(labs)) {
    for (const [slug, m] of Object.entries(l.models)) {
      const scores: Scores = {};
      for (const source of BENCHMARK_SOURCES) {
        const name = m[source];
        if (!name) continue;
        const f = fetched[source];
        if (f.ok) {
          const found = f.scores.get(name);
          if (!found) {
            warnings.add({
              code: "unknown_benchmark_model",
              message: `labs/${lab}.yaml ${slug}: ${source} has no model "${name}"`,
              details: { lab, model: slug, source, name },
            });
            continue;
          }
          for (const b of BENCHMARKS) {
            const s = found[b];
            if (s) scores[b] = { ...s, source, name, at: f.fetched_at };
          }
        } else {
          const prev = previous?.labs[lab]?.models[slug]?.scores ?? {};
          for (const b of BENCHMARKS) {
            const s = prev[b];
            if (s?.source !== source || s.name !== name) continue;
            scores[b] = { ...s, stale_since: s.stale_since ?? s.at };
            reused[source] = (reused[source] ?? 0) + 1;
          }
        }
      }
      if (Object.keys(scores).length) out[`${lab}/${slug}`] = scores;
    }
  }
  for (const [source, n] of Object.entries(reused)) {
    warnings.add({ code: "stale_data", message: `${source} benchmarks: reusing ${n} scores from the previous build` });
  }
  return out;
}

export const BEST_OPEN = "Best open weights";

const familiesSchema = z
  .object({
    families: z.array(
      z
        .object({
          name: z.string(),
          match: z.string().refine((m) => m.includes("(?<v>"), "needs a (?<v>…) group for the version"),
        })
        .strict(),
    ),
  })
  .strict();

export interface Family {
  name: string;
  match: RegExp;
}

/** Loads benchmarks.yaml, the reference families. */
export async function loadFamilies(file: string): Promise<Family[]> {
  const result = familiesSchema.safeParse(parse(await readFile(file, "utf8")));
  if (!result.success) {
    throw new HardError(`${file} is invalid:\n${result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")}`);
  }
  return result.data.families.map((f) => ({ name: f.name, match: new RegExp(f.match) }));
}

/** Compares dotted versions numerically: 5.10 > 5.9 > 5. */
function compareVersions(a: string, b: string): number {
  const [x, y] = [a.split(".").map(Number), b.split(".").map(Number)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** The latest version in a family, at its best score across variants (effort levels…). */
function latest(entries: [string, number][], family: Family): { name: string; value: number } | undefined {
  let best: { name: string; value: number; version: string } | undefined;
  for (const [name, value] of entries) {
    const version = family.match.exec(name)?.groups?.v;
    if (!version) continue;
    const c = best ? compareVersions(version, best.version) : 1;
    if (c > 0 || (c === 0 && value > best!.value)) best = { name, value, version };
  }
  return best && { name: best.name, value: best.value };
}

/**
 * Each benchmark's reference models: the latest of each family and the best open-weight model.
 * A failed source reuses the previous catalog's, marked `stale_since`.
 */
export function benchmarkFields(
  fetched: Record<BenchmarkSource, BenchmarkFetch>,
  previous: Catalog | undefined,
  families: Family[],
): Fields {
  const out: Fields = {};
  for (const b of BENCHMARKS) {
    const source = BENCHMARK_SOURCE[b];
    const f = fetched[source];
    if (f.ok) {
      const entries = [...f.scores].flatMap(([name, s]): [string, number][] => (s[b] ? [[name, s[b].value]] : []));
      const references = families.flatMap((family) => {
        const m = latest(entries, family);
        return m ? [{ family: family.name, ...m }] : [];
      });
      const open = entries.filter(([name]) => f.open.has(name)).sort((x, y) => y[1] - x[1])[0];
      if (open) references.push({ family: BEST_OPEN, name: open[0], value: open[1] });
      out[b] = { source, at: f.fetched_at, references };
    } else {
      const prev = previous?.benchmarks[b];
      if (prev) out[b] = { ...prev, stale_since: prev.stale_since ?? prev.at };
    }
  }
  return out;
}
