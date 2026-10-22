import { describe, expect, it } from "vitest";
import { buildOutputs } from "../src/build.js";
import { resolveSource } from "../src/collect.js";
import { Warnings } from "../src/warnings.js";
import { loadFixtureInputs } from "./helpers.js";

const spec = { id: "api:greenpt", kind: "api" as const, provider: "greenpt" as const };

async function previousCatalog() {
  const inputs = await loadFixtureInputs();
  return buildOutputs(inputs, new Warnings()).catalog;
}

describe("resolveSource", () => {
  it("reuses the previous build's records when an API fails, marked stale", async () => {
    const previous = await previousCatalog();
    const warnings = new Warnings();
    const state = resolveSource(spec, { ok: false, skipped: false, error: "HTTP 503" }, previous, warnings);

    expect(state.status).toBe("stale");
    expect(state.stale_since).toBe(previous.built_at);
    expect(state.records.length).toBeGreaterThan(0);
    expect(state.records.every((r) => r.stale_since === previous.built_at)).toBe(true);
    expect(warnings.items.map((w) => w.code)).toEqual(["source_failed", "stale_data"]);
  });

  it("keeps the original stale_since across repeated failures", async () => {
    const previous = await previousCatalog();
    const first = resolveSource(spec, { ok: false, skipped: false, error: "down" }, previous, new Warnings());
    const second = resolveSource(
      spec,
      { ok: false, skipped: false, error: "still down" },
      { ...previous, built_at: "2026-10-23T05:00:00.000Z", sources: [first] },
      new Warnings(),
    );
    expect(second.stale_since).toBe(previous.built_at);
  });

  it("carries stale_since into the merged catalog", async () => {
    const previous = await previousCatalog();
    const inputs = await loadFixtureInputs();
    inputs.sources = inputs.sources.map((s) =>
      s.id === spec.id ? resolveSource(spec, { ok: false, skipped: false, error: "down" }, previous, new Warnings()) : s,
    );
    const { catalog } = buildOutputs(inputs, new Warnings());
    const greenL = catalog.models.find((m) => m.model === "green-l")!;
    expect(greenL.prices.input_cost_per_token).toMatchObject({ source: "api", stale_since: previous.built_at });
  });

  it("handles a first run without a previous catalog", () => {
    const warnings = new Warnings();
    const state = resolveSource(spec, { ok: false, skipped: true, error: "KEY is not set" }, undefined, warnings);
    expect(state).toMatchObject({ status: "skipped", records: [] });
    expect(warnings.items.map((w) => w.code)).toEqual(["source_skipped"]);
  });
});
