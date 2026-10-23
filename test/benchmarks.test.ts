import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BEST_OPEN, type BenchmarkFetch, benchmarkFields, loadFamilies, matchBenchmarks, withPercentiles } from "../src/benchmarks.js";
import { buildOutputs } from "../src/build.js";
import type { Catalog } from "../src/catalog.js";
import { parseCsv, parseEpoch } from "../src/sources/epoch.js";
import { parseLmarena } from "../src/sources/lmarena.js";
import { Warnings } from "../src/warnings.js";
import { BUILT_AT, FIXTURES, ROOT, fixture, loadFixtureInputs } from "./helpers.js";

const text = (name: string) => readFileSync(path.join(FIXTURES, name), "utf8");
const epoch = (): BenchmarkFetch => ({ ok: true, ...parseEpoch(text("epoch-eci.csv"), text("epoch-benchmarks.csv")), fetched_at: BUILT_AT });
const lmarena = (): BenchmarkFetch => ({ ok: true, ...parseLmarena(fixture("lmarena.json") as unknown[]), fetched_at: BUILT_AT });

describe("benchmark sources", () => {
  it("parses quoted CSV fields", () => {
    expect(parseCsv('a,b\n"x,y","say ""hi"""\r\n')).toEqual([{ a: "x,y", b: 'say "hi"' }]);
  });

  it("takes Epoch's index with its interval, the best version's FrontierMath score, and open weights", () => {
    const { scores, open } = parseEpoch(text("epoch-eci.csv"), text("epoch-benchmarks.csv"));
    expect(scores.get("Mistral Large 4")).toEqual({
      capabilities: { value: 150.03, percentile: 100, ci: [146.94, 152.74] },
      math: { value: 0.6168, percentile: 100 },
    });
    // OTIS Mock AIME isn't the math benchmark any more.
    expect(scores.get("Gemma 4 26B A4B")).toEqual({ capabilities: { value: 141.88, percentile: 50, ci: [138.86, 143.43] } });
    expect([...open]).toEqual(["Gemma 4 26B A4B", "DeepSeek Coder 33B"]);
  });

  it("fails on a changed Epoch layout", () => {
    expect(() => parseEpoch("name,score\nx,1\n", text("epoch-benchmarks.csv"))).toThrow(/no Model, eci/);
  });

  it("takes LMArena's coding category only, and counts any license but Proprietary as open weights", () => {
    const { scores, open } = parseLmarena(fixture("lmarena.json") as unknown[]);
    expect(scores.get("Mistral Small 3.2 (2506)")).toEqual({ coding: { value: 1411.3, percentile: 0, ci: [1401.3, 1421.3], votes: 3337 } });
    expect([...open].sort()).toEqual(["Gemma 4 26B A4B", "Mistral Small 3.2 (2506)"]);
  });

  it("ranks each benchmark separately, from 0 for the lowest to 100 for the best", () => {
    const scores = withPercentiles(
      new Map([
        ["a", { capabilities: { value: 10 }, math: { value: 0.9 } }],
        ["b", { capabilities: { value: 20 } }],
        ["c", { capabilities: { value: 20 }, math: { value: 0.1 } }],
        ["d", { capabilities: { value: 30 } }],
      ]),
    );
    expect([...scores.values()].map((s) => s.capabilities?.percentile)).toEqual([0, 33, 33, 100]);
    expect(scores.get("a")?.math?.percentile).toBe(100);
    expect(scores.get("c")?.math?.percentile).toBe(0);
  });
});

describe("matchBenchmarks", () => {
  it("matches lab models by their exact names at each source", async () => {
    const { labs } = await loadFixtureInputs();
    const warnings = new Warnings();
    const scores = matchBenchmarks(labs, { epoch: epoch(), lmarena: lmarena() }, undefined, warnings);
    expect(scores["google/gemma-4-26b-a4b-it"]).toEqual({
      capabilities: { value: 141.88, percentile: 50, ci: [138.86, 143.43], source: "epoch", name: "Gemma 4 26B A4B", at: BUILT_AT },
      coding: { value: 1482.5, percentile: 50, ci: [1467.7, 1497.2], votes: 1443, source: "lmarena", name: "Gemma 4 26B A4B", at: BUILT_AT },
    });
    expect(Object.keys(scores["mistral/mistral-small-2506"]!)).toEqual(["coding"]);
    expect(warnings.items).toEqual([]);
  });

  it("warns about names a source doesn't have", async () => {
    const { labs } = await loadFixtureInputs();
    labs.mistral!.models["mistral-small-2506"]!.epoch = "Mistral Small 9";
    const warnings = new Warnings();
    matchBenchmarks(labs, { epoch: epoch(), lmarena: lmarena() }, undefined, warnings);
    expect(warnings.items).toEqual([
      expect.objectContaining({ code: "unknown_benchmark_model", details: expect.objectContaining({ source: "epoch", name: "Mistral Small 9" }) }),
    ]);
  });

  it("reuses the previous build's scores when a source fails, for the same names only", async () => {
    const inputs = await loadFixtureInputs();
    const first = matchBenchmarks(inputs.labs, { epoch: epoch(), lmarena: lmarena() }, undefined, new Warnings());
    const { catalog: previous } = buildOutputs({ ...inputs, scores: first }, new Warnings());

    inputs.labs.mistral!.models["mistral-small-2506"]!.lmarena = "Mistral Small 3.2";
    const warnings = new Warnings();
    const failed: BenchmarkFetch = { ok: false, error: "HTTP 503" };
    const scores = matchBenchmarks(inputs.labs, { epoch: epoch(), lmarena: failed }, previous as Catalog, warnings);
    expect(scores["google/gemma-4-26b-a4b-it"]?.coding).toMatchObject({ value: 1482.5, stale_since: BUILT_AT });
    expect(scores["mistral/mistral-small-2506"]).toBeUndefined();
    expect(warnings.items.map((w) => w.code)).toEqual(["source_failed", "stale_data"]);
  });

  it("publishes scores on lab models, without the source names", async () => {
    const inputs = await loadFixtureInputs();
    inputs.scores = matchBenchmarks(inputs.labs, { epoch: epoch(), lmarena: lmarena() }, undefined, new Warnings());
    const { catalog } = buildOutputs(inputs, new Warnings());
    const gemma = catalog.labs.google?.models["gemma-4-26b-a4b-it"];
    expect(gemma?.scores?.capabilities?.value).toBe(141.88);
    expect(gemma).not.toHaveProperty("epoch");
    expect(gemma).not.toHaveProperty("lmarena");
  });
});

describe("benchmarkFields", () => {
  const source = (names: Record<string, number>, open: string[] = []): BenchmarkFetch => ({
    ok: true,
    scores: withPercentiles(new Map(Object.entries(names).map(([n, value]) => [n, { capabilities: { value }, coding: { value } }]))),
    open: new Set(open),
    fetched_at: BUILT_AT,
  });

  it("picks each family's latest version at its best variant, and the best open-weight model", async () => {
    const families = await loadFamilies(path.join(ROOT, "benchmarks.yaml"));
    const epoch = source({ "Claude Opus 4.8": 159, "Claude Opus 5.5": 150, "Claude Opus 5.10": 140, "Claude Sonnet 5.5": 166, "GPT-6 Sol": 163, "GPT-6.1 Sol": 168, "Kimi K3": 157, "Llama 3": 120 }, ["Kimi K3", "Llama 3"]);
    const lmarena = source({ "Claude Opus 5.5": 1530, "Claude Opus 5.5 (High)": 1548, "Gemini 3.8 Flash": 1528, "Gemini 3.9 Flash-Lite": 1500 });
    const fields = benchmarkFields({ epoch, lmarena }, undefined, families);
    expect(fields.capabilities?.references).toEqual([
      { family: "Claude Opus", name: "Claude Opus 5.10", value: 140 },
      { family: "Claude Sonnet", name: "Claude Sonnet 5.5", value: 166 },
      { family: "GPT Sol", name: "GPT-6.1 Sol", value: 168 },
      { family: BEST_OPEN, name: "Kimi K3", value: 157 },
    ]);
    expect(fields.coding?.references).toEqual([
      { family: "Claude Opus", name: "Claude Opus 5.5 (High)", value: 1548 },
      { family: "Gemini Flash", name: "Gemini 3.8 Flash", value: 1528 },
    ]);
  });

  it("reuses the previous references when a source fails", async () => {
    const families = await loadFamilies(path.join(ROOT, "benchmarks.yaml"));
    const fields = benchmarkFields({ epoch: source({ "Claude Opus 5.5": 168 }), lmarena: source({ "Claude Opus 5.5": 1548 }) }, undefined, families);
    const inputs = await loadFixtureInputs();
    const { catalog: previous } = buildOutputs({ ...inputs, benchmarks: fields }, new Warnings());
    const stale = benchmarkFields({ epoch: source({}), lmarena: { ok: false, error: "HTTP 503" } }, previous as Catalog, families);
    expect(stale.coding).toMatchObject({ stale_since: BUILT_AT, references: fields.coding?.references });
    expect(stale.capabilities).toMatchObject({ references: [] });
  });
});
