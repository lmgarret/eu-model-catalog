import { describe, expect, it } from "vitest";
import { dodge, labelRows } from "../site/src/lib/beeswarm.js";
import { canCompare, compareHash, ordinal, parseCompare, resolveKeys } from "../site/src/lib/compare.js";
import type { ModelGroup } from "../site/src/lib/models.js";

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
