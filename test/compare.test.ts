import { describe, expect, it } from "vitest";
import { dodge, labelRows } from "../site/src/lib/beeswarm.js";

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
