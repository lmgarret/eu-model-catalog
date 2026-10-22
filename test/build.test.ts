import { describe, expect, it } from "vitest";
import { buildOutputs, validateOutputs } from "../src/build.js";
import { LabIndex } from "../src/labs.js";
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
    expect(pricing["Infomaniak/swiss-ai/Apertus-v1.5-70B"]).toMatchObject({ provider: "Infomaniak", mode: "chat" });
  });

  it("leaves unpriced models out of pricing.json", async () => {
    const { pricing, catalog } = await build();
    expect(pricing).not.toHaveProperty(["Regolo.ai/brick-v1-beta"]);
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

  it("warns once per model and price when no source has it", async () => {
    const { warnings } = await build();
    const missing = warnings.filter((w) => w.code === "missing_price");
    expect(missing).toContainEqual(
      expect.objectContaining({
        provider: "regolo",
        model: "brick-v1-beta",
        details: { price: "input", sources: ["models.dev", "api"] },
      }),
    );
    expect(missing.filter((w) => w.model === "brick-v1-beta")).toHaveLength(2);
  });

  it("does not warn when another source fills the price, even in another unit", async () => {
    const { warnings } = await build();
    const models = warnings.filter((w) => w.code === "missing_price").map((w) => w.model);
    // The overlay prices faster-whisper; the API prices green-s per hour where models.dev has nothing.
    expect(models).not.toContain("faster-whisper-large-v3");
    expect(models).not.toContain("green-s");
  });

  it("does not expect an output price from decision models", async () => {
    const { warnings } = await build();
    expect(warnings.filter((w) => w.model === "metis" && w.code === "missing_price")).toEqual([]);
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
    pricing["GreenPT/green-l"] = { ...pricing["GreenPT/green-l"], input_cost_per_token: -1 };
    expect(() => validateOutputs({ pricing, catalog }, inputs.providers)).toThrow(HardError);
  });
});

describe("model and provider facts", () => {
  const model = (catalog: Awaited<ReturnType<typeof build>>["catalog"], provider: string, name: string) =>
    catalog.models.find((m) => m.provider === provider && m.model === name)!;

  it("maps hosted models to their lab's model and takes its facts from labs/", async () => {
    const { catalog } = await build();
    // Rebranded: models.dev's canonical id names the original.
    const greenL = model(catalog, "greenpt", "green-l");
    expect(greenL.canonical_id).toBe("mistral/mistral-small-2506");
    expect(greenL.bifrost_id).toBe("GreenPT/green-l");
    expect(greenL.info.lab).toMatchObject({ value: "mistral", source: "labs" });
    expect(greenL.info.license).toMatchObject({ value: "Apache-2.0", url: "https://example.com/mistral-small" });
    expect(greenL.info.name?.value).toBe("Mistral Small 3.2");
    expect(greenL.info.tool_call).toMatchObject({ value: true, source: "models.dev" });
    // The host is the lab: its alias maps to the same model.
    expect(model(catalog, "mistral", "mistral-small-latest").canonical_id).toBe("mistral/mistral-small-2506");
    // An <org>/<name> id: the org is a lab alias, the variant suffix is dropped.
    expect(model(catalog, "infomaniak", "swiss-ai/Apertus-v1.5-70B").canonical_id).toBe("swiss-ai/apertus-v1.5-70b");
  });

  it("warns about models no lab claims, and lab models labs/ doesn't list", async () => {
    const { warnings } = await build();
    expect(warnings).toContainEqual(
      expect.objectContaining({ code: "unattributed_model", provider: "regolo", model: "brick-v1-beta" }),
    );
    expect(warnings).toContainEqual(
      expect.objectContaining({ code: "unknown_lab_model", provider: "infomaniak", model: "swiss-ai/Apertus-v1.5-70B" }),
    );
  });

  it("lets the overlay set the canonical id and override model facts", async () => {
    const { catalog } = await build((i) => {
      i.overlay.regolo!["brick-v1-beta"] = {
        canonical: "mistralai/Mistral-Large-2411",
        open_weights: true,
        source: "https://example.com/brick",
        checked: "2026-10-01",
      };
    });
    const brick = model(catalog, "regolo", "brick-v1-beta");
    expect(brick.canonical_id).toBe("mistral/mistral-large-2411");
    expect(brick.info.license?.value).toBe("Proprietary");
    expect(brick.info.open_weights).toMatchObject({ value: true, source: "overlay" });
  });

  it("takes a missing license from Hugging Face and warns when the card disagrees", async () => {
    const { catalog, warnings } = await build((i) => {
      i.hfLicenses = new Map([
        ["google/gemma-4-26b-a4b-it", "Apache-2.0"],
        ["mistralai/Mistral-Small-3.2-24B-Instruct-2506", "MIT"],
      ]);
    });
    expect(model(catalog, "greenpt", "gemma4").info.license).toMatchObject({
      value: "Apache-2.0",
      url: "https://huggingface.co/google/gemma-4-26b-a4b-it",
    });
    expect(catalog.labs.google?.models["gemma-4-26b-a4b-it"]?.license_url).toBe("https://huggingface.co/google/gemma-4-26b-a4b-it");
    expect(warnings).toContainEqual(expect.objectContaining({ code: "license_mismatch", details: expect.objectContaining({ huggingface: "MIT" }) }));
  });

  it("publishes provider facts and labs without their aliases", async () => {
    const { catalog } = await build();
    expect(catalog.providers.infomaniak?.facts?.sustainability.heat_reuse?.value).toBe(true);
    expect(catalog.providers.greenpt?.facts).toBeUndefined();
    expect(catalog.labs.mistral).toMatchObject({ name: "Mistral AI", country: "FR", eu_ai_act: { value: "signatory" } });
    expect(catalog.labs.mistral).not.toHaveProperty("aliases");
    expect(catalog.labs.mistral?.models["mistral-small-2506"]).not.toHaveProperty("aliases");
  });

  it("warns about facts checked more than six months ago", async () => {
    const { warnings } = await build((i) => (i.builtAt = "2026-07-11T05:00:00.000Z"));
    const stale = warnings.filter((w) => w.code === "stale_fact");
    expect(stale.map((w) => w.details)).toEqual([
      { path: "privacy.training", checked: "2026-01-10" },
      { lab: "mistral", path: "models.mistral-large-2411", checked: "2026-01-10" },
    ]);
    const { warnings: fresh } = await build((i) => (i.builtAt = "2026-07-09T05:00:00.000Z"));
    expect(fresh.filter((w) => w.code === "stale_fact")).toEqual([]);
  });
});

describe("LabIndex", () => {
  const index = new LabIndex({
    alibaba: {
      name: "Alibaba",
      country: "CN",
      website: "https://qwen.ai",
      aliases: ["Qwen"],
      models: { "qwen3.5-122b-a10b": { name: "Qwen3.5 122B", aliases: ["qwen3.5-122b"], source: "https://x.y", checked: "2026-10-22" } },
    },
  });

  it("resolves by exact keys and aliases only", () => {
    expect(index.resolve({ model: "Qwen/Qwen3.5-122B-A10B-FP8" })).toMatchObject({ id: "alibaba/qwen3.5-122b-a10b", via: "model id" });
    expect(index.resolve({ model: "qwen3.5-122b" })).toMatchObject({ id: "alibaba/qwen3.5-122b-a10b", via: "unique slug" });
    expect(index.resolve({ model: "x", modelsDev: "alibaba/qwen3.5-122b-a10b" })?.via).toBe("models.dev");
    expect(index.resolve({ model: "my-qwen3.5-122b" })).toBeUndefined();
    expect(index.resolve({ model: "unknown-org/model" })).toBeUndefined();
  });
});
