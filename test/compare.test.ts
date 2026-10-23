import { describe, expect, it } from "vitest";
import { buildOutputs } from "../src/build.js";
import { Warnings } from "../src/warnings.js";
import { BENCHMARKS, BENCHMARK_INFO } from "../site/src/lib/benchmarks.js";
import { dodge, labelRows } from "../site/src/lib/beeswarm.js";
import {
  type SpecContext,
  type PricePoint,
  bestFlags,
  bestValueFrontier,
  canCompare,
  compareHash,
  missingFromScatter,
  ordinal,
  parseCompare,
  resolveKeys,
  specRows,
} from "../site/src/lib/compare.js";
import { type ModelGroup, groupModels, toOffer } from "../site/src/lib/models.js";
import { defaultWeights, score } from "../site/src/lib/scores.js";
import { loadFixtureInputs } from "./helpers.js";

describe("beeswarm", () => {
  it("dodges dots so none touch", () => {
    const xs = [0, 2, 4, 30];
    const y = dodge(xs, { step: 9, half: 100 });
    const pts = xs.map((x, i) => ({ x, y: y[i] ?? NaN }));
    for (const [i, a] of pts.entries())
      for (const b of pts.slice(i + 1)) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(9 - 1e-9);
    expect(y[3]).toBe(0);
  });

  it("keeps dots within the band", () => {
    const y = dodge(Array(20).fill(5), { step: 9, half: 20 });
    expect(y.every((v) => Math.abs(v) <= 20)).toBe(true);
  });

  it("places the first dots in the middle", () => {
    const y = dodge([10, 10, 10], { step: 9, half: 30, first: new Set([2]) });
    expect(y[2]).toBe(0);
  });

  it("stacks overlapping labels into rows", () => {
    expect(labelRows([100, 104, 400], [80, 80, 80], 6)).toEqual([0, 1, 0]);
  });
});

describe("compare links", () => {
  it("round-trips keys with slashes, commas and percent signs", () => {
    const keys = ["mistral/a", "x,y", "p/q%r"];
    expect(compareHash(keys)).toBe("#/compare/mistral%2Fa,x%2Cy,p%2Fq%25r");
    expect(parseCompare(compareHash(keys).slice("#/compare/".length))).toEqual(keys);
  });

  it("gives no keys for an empty segment", () => {
    expect(parseCompare("")).toEqual([]);
    expect(parseCompare(undefined)).toEqual([]);
  });

  it("drops duplicates, keeping the first", () => {
    expect(parseCompare("a,b,a")).toEqual(["a", "b"]);
  });

  it("keeps a part with a malformed percent escape as typed", () => {
    expect(parseCompare("a%zz")).toEqual(["a%zz"]);
  });

  it("resolves keys in order, leaving unknown ones undefined", () => {
    const g1 = { key: "mistral/a" } as ModelGroup;
    expect(resolveKeys(["gone", g1.key], [g1])).toEqual([undefined, g1]);
  });

  it("writes ordinals, with Best for first", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal)).toEqual([
      "Best", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st", "111th",
    ]);
  });
});

describe("canCompare", () => {
  const chat = { mode: "chat" };
  const embedding = { mode: "embedding" };

  it("asks for a second pick", () => {
    expect(canCompare([chat])).toEqual({ ok: false, reason: "Pick 2 or 3 to compare" });
  });

  it("allows 2 or 3 models of one type", () => {
    expect(canCompare([chat, chat])).toEqual({ ok: true });
    expect(canCompare([chat, chat, chat])).toEqual({ ok: true });
  });

  it("refuses more than 3", () => {
    expect(canCompare([chat, chat, chat, chat])).toEqual({ ok: false, reason: "Pick up to 3 to compare" });
  });

  it("refuses mixed types", () => {
    expect(canCompare([chat, embedding])).toEqual({ ok: false, reason: "Pick models of the same type" });
  });

  it("checks the count before the types", () => {
    expect(canCompare([chat, embedding, chat, embedding])).toEqual({ ok: false, reason: "Pick up to 3 to compare" });
  });
});

describe("spec rows", () => {
  async function fixture() {
    const { catalog } = buildOutputs(await loadFixtureInputs(), new Warnings());
    const groups = groupModels(catalog, catalog.models.map((m) => toOffer(m, "2026-10-22")));
    const providerScores: SpecContext["providerScores"] = {};
    for (const [id, p] of Object.entries(catalog.providers)) {
      providerScores[id] = { privacy: score("privacy", p.facts, defaultWeights()), eco: score("eco", p.facts, defaultWeights()) };
    }
    const pick = (...keys: string[]) => keys.map((k) => groups.find((g) => g.key === k)!);
    const ctx: SpecContext = { catalog, currency: "EUR", providerScores };
    return { pick, ctx };
  }
  const row = (rows: ReturnType<typeof specRows>, label: string) => rows.find((r) => r.label === label)!;

  it("tags every value that ties for best", () => {
    expect(bestFlags([3, 5, 5], "higher")).toEqual([false, true, true]);
    expect(bestFlags([3, 5], "lower")).toEqual([true, false]);
  });

  it("tags nothing when the values are all equal or fewer than 2 are known", () => {
    expect(bestFlags([4, 4], "higher")).toEqual([false, false]);
    expect(bestFlags([4, undefined], "higher")).toEqual([false, false]);
  });

  it("starts with the benchmarks for chat models and tags the larger context", async () => {
    const { pick, ctx } = await fixture();
    const rows = specRows(pick("mistral/mistral-small-2506", "swiss-ai/apertus-70b"), ctx);
    expect(rows.map((r) => r.label)).toEqual([
      ...BENCHMARKS.map((b) => BENCHMARK_INFO[b].label),
      "Input /1M", "Output /1M", "Cheapest host",
      "Hosts", "Privacy", "Eco",
      "Context", "Max output", "Released", "Knowledge cutoff", "Weights", "License",
      "Tool calling", "Structured output", "Image input", "Audio input", "Reasoning",
    ]);
    expect(row(rows, "Context").cells.map((c) => c.best)).toEqual([true, false]);
  });

  it("shows prices in the chosen currency but compares them the same way", async () => {
    const { pick, ctx } = await fixture();
    const groups = pick("mistral/mistral-small-2506", "swiss-ai/apertus-70b");
    const eur = specRows(groups, ctx);
    const chf = specRows(groups, { ...ctx, currency: "CHF" });
    for (const label of ["Input /1M", "Output /1M"]) {
      expect(row(eur, label).cells.map((c) => c.text)).not.toEqual(row(chf, label).cells.map((c) => c.text));
      expect(row(eur, label).cells.map((c) => c.best)).toEqual(row(chf, label).cells.map((c) => c.best));
    }
    expect(row(eur, "Input /1M").cells.map((c) => c.best)).toEqual([true, false]);
  });

  it("leaves out benchmarks for embeddings and tags no missing output price", async () => {
    const { pick, ctx } = await fixture();
    const rows = specRows(pick("greenpt/green-embedding", "mistral/mistral-embed"), ctx);
    expect(rows.some((r) => r.group === "Benchmarks")).toBe(false);
    expect(row(rows, "Output /1M").cells).toEqual([
      { text: "–", best: false },
      { text: "–", best: false },
    ]);
  });

  it("doesn't compare input prices in different units", async () => {
    const { pick, ctx } = await fixture();
    const rows = specRows(pick("regolo/faster-whisper-large-v3", "mistral/mistral-small-2506"), ctx);
    const input = row(rows, "Input /1M");
    expect(input.cells[0]!.text).toMatch(/^€0\.\d+ \/ minute$/);
    expect(input.cells.map((c) => c.best)).toEqual([false, false]);
  });

  it("gives an unknown column dashes, ignored by best and differs", async () => {
    const { pick, ctx } = await fixture();
    const rows = specRows([...pick("mistral/mistral-small-2506", "swiss-ai/apertus-70b"), undefined], ctx);
    expect(rows.every((r) => r.cells[2]!.text === "–" && !r.cells[2]!.best)).toBe(true);
    expect(row(rows, "Weights").differs).toBe(false);
  });

  it("doesn't count a row of dashes as a difference", async () => {
    const { pick, ctx } = await fixture();
    const output = row(specRows(pick("greenpt/green-embedding", "mistral/mistral-embed"), ctx), "Output /1M");
    expect(output.differs).toBe(false);
  });
});

describe("price scatter", () => {
  const pt = (key: string, price: number, score: number): PricePoint => ({ key, name: key, price, score });

  it("keeps only the points no cheaper or equal-priced point beats", () => {
    const points = [pt("a", 1, 50), pt("b", 2, 40), pt("c", 3, 70), pt("d", 3, 60), pt("e", 5, 70)];
    expect(bestValueFrontier(points).map((p) => p.key)).toEqual(["a", "c"]);
  });

  it("gives no frontier for no points", () => {
    expect(bestValueFrontier([])).toEqual([]);
  });

  it("says why a model is missing", () => {
    const scores = { capabilities: { percentile: 80 } } as ModelGroup["scores"];
    const noPrice = { key: "p", name: "P", mode: "chat", scores, offers: [{ input: 1 }] } as ModelGroup;
    const noScore = { key: "s", name: "S", mode: "chat", offers: [{ input: 1, output: 2 }] } as ModelGroup;
    expect(missingFromScatter([noPrice, noScore], "capabilities")).toEqual([
      { name: "P", why: "no price" },
      { name: "S", why: "not rated" },
    ]);
  });
});
