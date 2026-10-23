import type { ModelGroup } from "./models.js";
import type { Benchmark, BenchmarkScore } from "./types.js";

export const BENCHMARKS: Benchmark[] = ["capabilities", "coding", "math"];

export const SOURCES: Record<BenchmarkScore["source"], { name: string; url: string }> = {
  epoch: { name: "Epoch AI", url: "https://epoch.ai/benchmarks" },
  lmarena: { name: "LMArena", url: "https://lmarena.ai/leaderboard" },
};

/** What each benchmark measures; scores show as percentiles among every model the source rates. */
export const BENCHMARK_INFO: Record<
  Benchmark,
  { label: string; source: BenchmarkScore["source"]; about: string; raw: (s: BenchmarkScore) => string }
> = {
  capabilities: {
    label: "Capabilities",
    source: "epoch",
    about: "Epoch Capabilities Index: many benchmarks combined on one scale.",
    raw: (s) => `ECI ${withCi(s)}`,
  },
  coding: {
    label: "Coding",
    source: "lmarena",
    about: "LMArena coding rating: people vote for the better of two answers to their coding prompts. Preference, not correctness.",
    raw: (s) => withCi(s),
  },
  math: {
    label: "Math",
    source: "epoch",
    about: "FrontierMath Tiers 1–3, run by Epoch AI: hard, research-level math problems.",
    raw: (s) => `${Math.round(s.value * 100)}% solved`,
  },
};

function withCi(s: BenchmarkScore): string {
  return s.ci ? `${s.value.toFixed(0)} ±${Math.round((s.ci[1] - s.ci[0]) / 2)}` : s.value.toFixed(0);
}

/** Explains the 0–100 scale, for titles. */
export const SCALE = "0–100: the share of all the models the source rates that score lower";

/** 1-based rank of `g` among the groups with a score on `b`, and how many have one. */
export function rankAmong(groups: ModelGroup[], g: ModelGroup, b: Benchmark): { rank: number; of: number } | undefined {
  const value = g.scores?.[b]?.value;
  if (value === undefined) return undefined;
  const scored = groups.flatMap((x) => (x.scores?.[b] ? [x.scores[b].value] : []));
  return { rank: scored.filter((v) => v > value).length + 1, of: scored.length };
}

/** The groups with a score on `b`, as the benchmark strips draw them; `source` is the source's name for the model. */
export function scoredOn(groups: ModelGroup[], b: Benchmark): { key: string; name: string; source: string; value: number }[] {
  return groups.flatMap((g) => {
    const s = g.scores?.[b];
    return s ? [{ key: g.key, name: g.name, source: s.name, value: s.value }] : [];
  });
}
