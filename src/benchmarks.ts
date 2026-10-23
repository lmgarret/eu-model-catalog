import { z } from "zod";
import type { Catalog } from "./catalog.js";
import type { Labs } from "./facts.js";
import type { Warnings } from "./warnings.js";

/** Chat models only. `capabilities` and `math` come from Epoch AI, `coding` from LMArena. */
export const BENCHMARKS = ["capabilities", "coding", "math"] as const;
export type Benchmark = (typeof BENCHMARKS)[number];

/** Each source is also the field in labs/ that names the model there. Both publish under CC BY 4.0. */
export const BENCHMARK_SOURCES = ["epoch", "lmarena"] as const;
export type BenchmarkSource = (typeof BENCHMARK_SOURCES)[number];

export const scoreSchema = z.object({
  value: z.number(),
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

/** One source's scores per model name, as fetched. */
export type SourceScores = Map<string, Partial<Record<Benchmark, Pick<Score, "value" | "ci" | "votes">>>>;

export type BenchmarkFetch = { ok: true; scores: SourceScores; fetched_at: string } | { ok: false; error: string };

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
