import { describe, expect, it } from "vitest";
import { buildOutputs, validateOutputs } from "../src/build.js";
import { HardError } from "../src/model.js";
import { Warnings, toAnnotation } from "../src/warnings.js";
import { fixture, loadFixtureInputs } from "./helpers.js";

async function build(patch: (inputs: Awaited<ReturnType<typeof loadFixtureInputs>>) => void = () => {}) {
  const inputs = await loadFixtureInputs();
  patch(inputs);
  const warnings = new Warnings();
  return { ...buildOutputs(inputs, warnings), warnings: warnings.items, inputs };
}

describe("buildOutputs", () => {
  it("produces pricing.json from the fixtures", async () => {
    const { pricing } = await build();
    await expect(`${JSON.stringify(pricing, null, 2)}\n`).toMatchFileSnapshot("__snapshots__/pricing.json");
  });

  it("keeps the whole Bifrost base", async () => {
    const { pricing } = await build();
    const base = fixture("bifrost-datasheet.json") as Record<string, unknown>;
    for (const key of Object.keys(base)) expect(pricing).toHaveProperty([key]);
    expect(pricing["ai21.j2-mid-v1"]).toEqual(base["ai21.j2-mid-v1"]);
  });

  it("applies the precedence and records each field's source", async () => {
    const { catalog } = await build();
    const model = (provider: string, name: string) =>
      catalog.models.find((m) => m.provider === provider && m.model === name)!;

    // API beats models.dev.
    expect(model("greenpt", "green-l").prices.input_cost_per_token).toMatchObject({
      source: "api",
      usd_per_unit: 2.8085e-7,
      original: { amount: "0.25", currency: "EUR", per: "1M_tokens" },
    });
    // Overlay beats everything, including a zero from the API.
    expect(model("regolo", "faster-whisper-large-v3").prices.input_cost_per_second).toMatchObject({
      source: "overlay",
      at: "2026-10-22",
      usd_per_unit: 0.00016851,
    });
    // models.dev beats the Bifrost base, which still fills fields nobody else has.
    const small = model("mistral", "mistral-small-latest");
    expect(small.prices.input_cost_per_token?.source).toBe("models.dev");
    expect(small.limits.max_input_tokens?.source).toBe("api");
  });

  it("writes overrides keyed by Bifrost provider, merged into the base entry", async () => {
    const { pricing } = await build();
    expect(pricing["mistral/mistral-small-latest"]).toMatchObject({
      provider: "mistral",
      base_model: "mistral-small",
      supports_vision: true,
      input_cost_per_token: 1.5e-7,
    });
    expect(pricing["infomaniak/swiss-ai/Apertus-v1.5-70B"]).toMatchObject({ provider: "infomaniak", mode: "chat" });
  });

  it("leaves unpriced models out of pricing.json", async () => {
    const { pricing, catalog } = await build();
    expect(pricing).not.toHaveProperty(["regolo/brick-v1-beta"]);
    expect(catalog.models.find((m) => m.model === "brick-v1-beta")?.pricing_key).toBeNull();
  });

  it("marks deprecated models", async () => {
    const { pricing } = await build((i) => (i.builtAt = "2026-12-01T05:00:00.000Z"));
    expect(pricing["mistral/mistral-large-2411"]).toMatchObject({ deprecation_date: "2026-11-30", is_deprecated: true });
  });

  it("writes the exchange rates", async () => {
    const { catalog } = await build();
    expect(catalog.exchange_rates).toMatchObject({ date: "2026-10-21", rates: { USD: "1.1234", CHF: "0.9256" } });
  });

  it("warns about zero or missing prices", async () => {
    const { warnings } = await build();
    expect(warnings).toContainEqual(
      expect.objectContaining({ code: "missing_price", provider: "regolo", model: "faster-whisper-large-v3" }),
    );
  });

  it("warns when the overlay disagrees, showing both values", async () => {
    const { warnings } = await build((i) => (i.overlay.greenpt!["green-s"]!.input = "0.5"));
    const w = warnings.find((w) => w.code === "price_mismatch" && w.model === "green-s");
    expect(w?.message).toContain("overlay: 0.000156027777778 USD (0.5 EUR/hour)");
    expect(w?.message).toContain("api: 0.0000717727777778 USD (0.23 EUR/hour)");
    expect(toAnnotation(w!)).toMatch(/^::warning title=price_mismatch greenpt green-s::/);
  });

  it("does not warn when the overlay agrees across currencies within tolerance", async () => {
    const { warnings } = await build();
    expect(warnings.filter((w) => w.code === "price_mismatch")).toEqual([]);
  });

  it("warns about overlay models the API no longer lists", async () => {
    const { warnings } = await build((i) => {
      const api = i.sources.find((s) => s.id === "api:regolo")!;
      api.records = api.records.filter((r) => r.model !== "faster-whisper-large-v3");
    });
    expect(warnings).toContainEqual(
      expect.objectContaining({ code: "overlay_unlisted", provider: "regolo", model: "faster-whisper-large-v3" }),
    );
  });

  it("fails hard when the output breaks its schema", async () => {
    const { pricing, catalog, inputs } = await build();
    pricing["greenpt/green-l"] = { ...pricing["greenpt/green-l"], input_cost_per_token: -1 };
    expect(() => validateOutputs({ pricing, catalog }, inputs.providers)).toThrow(HardError);
  });
});
