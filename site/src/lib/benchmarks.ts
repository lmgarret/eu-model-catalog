import type { ModelGroup } from "./models.js";
import type { Benchmark, BenchmarkScore } from "./types.js";

export const BENCHMARKS: Benchmark[] = ["capabilities", "coding", "math"];

export const SOURCES: Record<BenchmarkScore["source"], { name: string; url: string }> = {
  epoch: { name: "Epoch AI", url: "https://epoch.ai/benchmarks" },
  lmarena: { name: "LMArena", url: "https://lmarena.ai/leaderboard" },
};

export const BENCHMARK_INFO: Record<Benchmark, { label: string; about: string; format: (v: number) => string }> = {
  capabilities: {
    label: "Capabilities",
    about: "Epoch Capabilities Index: many benchmarks on one scale, where Claude 3.5 Sonnet scores 130 and GPT-5 150.",
    format: (v) => v.toFixed(0),
  },
  coding: {
    label: "Coding",
    about:
      "LMArena coding rating: people vote for the better of two answers to their coding prompts. " +
      "It measures preference, not correctness; ratings about 10 apart are a tie.",
    format: (v) => v.toFixed(0),
  },
  math: {
    label: "Math",
    about: "OTIS Mock AIME 2024–2025, run by Epoch AI: share of competition math problems solved.",
    format: (v) => `${Math.round(v * 100)}%`,
  },
};

/** Lowest and highest score per benchmark, to scale the bars. */
export function benchmarkRanges(groups: ModelGroup[]): Partial<Record<Benchmark, [number, number]>> {
  const out: Partial<Record<Benchmark, [number, number]>> = {};
  for (const b of BENCHMARKS) {
    const v = groups.map((g) => g.scores?.[b]?.value).filter((x) => x !== undefined);
    if (v.length) out[b] = [Math.min(...v), Math.max(...v)];
  }
  return out;
}

/** Tooltip text: the score, its interval and votes, and where it comes from. */
export function describeScore(b: Benchmark, s: BenchmarkScore): string {
  const { label, format, about } = BENCHMARK_INFO[b];
  const ci = s.ci ? ` (${format(s.ci[0])}–${format(s.ci[1])})` : "";
  const votes = s.votes ? `, ${s.votes.toLocaleString("en")} votes` : "";
  const stale = s.stale_since ? `. Stale: ${SOURCES[s.source].name} failed, reused from ${s.stale_since.slice(0, 10)}` : "";
  return `${label} ${format(s.value)}${ci}${votes}, as "${s.name}" on ${SOURCES[s.source].name}${stale}.\n${about}`;
}
