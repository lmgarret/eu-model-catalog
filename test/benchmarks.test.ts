import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { type BenchmarkFetch, matchBenchmarks } from "../src/benchmarks.js";
import { buildOutputs } from "../src/build.js";
import type { Catalog } from "../src/catalog.js";
import { parseCsv, parseEpoch } from "../src/sources/epoch.js";
import { parseLmarena } from "../src/sources/lmarena.js";
import { Warnings } from "../src/warnings.js";
import { BUILT_AT, FIXTURES, fixture, loadFixtureInputs } from "./helpers.js";

const text = (name: string) => readFileSync(path.join(FIXTURES, name), "utf8");
const epoch = (): BenchmarkFetch => ({
  ok: true,
  scores: parseEpoch(text("epoch-eci.csv"), text("epoch-benchmarks.csv")),
  fetched_at: BUILT_AT,
});
const lmarena = (): BenchmarkFetch => ({ ok: true, scores: parseLmarena(fixture("lmarena.json") as unknown[]), fetched_at: BUILT_AT });

describe("benchmark sources", () => {
  it("parses quoted CSV fields", () => {
    expect(parseCsv('a,b\n"x,y","say ""hi"""\r\n')).toEqual([{ a: "x,y", b: 'say "hi"' }]);
  });

  it("takes Epoch's index with its interval, and the best version's math score", () => {
    const scores = parseEpoch(text("epoch-eci.csv"), text("epoch-benchmarks.csv"));
    expect(scores.get("Gemma 4 26B A4B")).toEqual({
      capabilities: { value: 141.88, ci: [138.86, 143.43] },
      math: { value: 0.822 },
    });
    expect(scores.get("DeepSeek Coder 33B")?.capabilities?.value).toBe(95.94);
  });

  it("fails on a changed Epoch layout", () => {
    expect(() => parseEpoch("name,score\nx,1\n", text("epoch-benchmarks.csv"))).toThrow(/no Model, eci/);
  });

  it("takes LMArena's coding category only", () => {
    const scores = parseLmarena(fixture("lmarena.json") as unknown[]);
    expect(scores.get("Mistral Small 3.2 (2506)")).toEqual({ coding: { value: 1411.3, ci: [1401.3, 1421.3], votes: 3337 } });
  });
});

describe("matchBenchmarks", () => {
  it("matches lab models by their exact names at each source", async () => {
    const { labs } = await loadFixtureInputs();
    const warnings = new Warnings();
    const scores = matchBenchmarks(labs, { epoch: epoch(), lmarena: lmarena() }, undefined, warnings);
    expect(scores["google/gemma-4-26b-a4b-it"]).toEqual({
      capabilities: { value: 141.88, ci: [138.86, 143.43], source: "epoch", name: "Gemma 4 26B A4B", at: BUILT_AT },
      math: { value: 0.822, source: "epoch", name: "Gemma 4 26B A4B", at: BUILT_AT },
      coding: { value: 1482.5, ci: [1467.7, 1497.2], votes: 1443, source: "lmarena", name: "Gemma 4 26B A4B", at: BUILT_AT },
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
    const { catalog: previous } = buildOutputs({ ...inputs, benchmarks: first }, new Warnings());

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
    inputs.benchmarks = matchBenchmarks(inputs.labs, { epoch: epoch(), lmarena: lmarena() }, undefined, new Warnings());
    const { catalog } = buildOutputs(inputs, new Warnings());
    const gemma = catalog.labs.google?.models["gemma-4-26b-a4b-it"];
    expect(gemma?.scores?.capabilities?.value).toBe(141.88);
    expect(gemma).not.toHaveProperty("epoch");
    expect(gemma).not.toHaveProperty("lmarena");
  });
});
