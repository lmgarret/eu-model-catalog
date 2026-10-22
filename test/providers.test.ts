import { describe, expect, it } from "vitest";
import type { ProviderConfig } from "../src/config.js";
import { HardError } from "../src/model.js";
import { parseModelsDev } from "../src/sources/modelsdev.js";
import { PROVIDER_APIS } from "../src/sources/providers/index.js";
import { BUILT_AT, fixture, loadFixtureInputs } from "./helpers.js";

const ctx = (config: Partial<ProviderConfig> = {}) => ({
  config: { bifrost_provider: "x", models_dev_id: "x", ...config },
  fetchedAt: BUILT_AT,
});

describe("greenpt", () => {
  const records = PROVIDER_APIS.greenpt.parse(fixture("greenpt.json"), ctx({ currency: "EUR" }));

  it("maps token prices per 1M tokens in EUR", () => {
    expect(records.find((r) => r.model === "green-l")).toMatchObject({
      currency: "EUR",
      unit: "1M_tokens",
      mode: "chat",
      prices: { input: "0.25", output: "0.8" },
      limits: { max_input_tokens: 128000, max_output_tokens: 32000 },
    });
  });

  it("maps speech-to-text per hour", () => {
    expect(records.find((r) => r.model === "green-s")).toMatchObject({
      unit: "hour",
      mode: "audio_transcription",
      prices: { input: "0.23" },
    });
  });

  it("fails hard when the pinned currency differs", () => {
    expect(() => PROVIDER_APIS.greenpt.parse(fixture("greenpt.json"), ctx({ currency: "CHF" }))).toThrow(HardError);
  });

  it("rejects an unexpected shape", () => {
    expect(() => PROVIDER_APIS.greenpt.parse({ data: [{ id: 1 }] }, ctx())).toThrow();
  });
});

describe("regolo", () => {
  const records = PROVIDER_APIS.regolo.parse(fixture("regolo.json"), ctx({ currency: "EUR" }));

  it("keeps per-token prices and drops zeros", () => {
    expect(records.find((r) => r.model === "apertus-70b")).toMatchObject({
      unit: "token",
      prices: { input: "4e-7", output: "0.0000021" },
    });
    expect(records.find((r) => r.model === "brick-v1-beta")?.prices).toEqual({ input: undefined, output: undefined });
  });

  it("keeps the API's model casing", () => {
    expect(records.map((r) => r.model)).toContain("Qwen3-Embedding-8B");
  });
});

describe("infomaniak (hand-written fixture)", () => {
  const config = { currency_ids: { "1": "CHF" as const } };

  it("maps prices and currency ids", () => {
    const records = PROVIDER_APIS.infomaniak.parse(fixture("infomaniak.handwritten.json"), ctx(config));
    expect(records.find((r) => r.model === "swiss-ai/Apertus-v1.5-70B")).toMatchObject({
      currency: "CHF",
      unit: "1M_tokens",
      prices: { input: "0.7", output: "2.5" },
    });
    expect(records.find((r) => r.model === "whisper")).toMatchObject({
      unit: "minute",
      mode: "audio_transcription",
      prices: { input: "0.006" },
    });
  });

  it("fails hard on an unknown currency id", () => {
    expect(() => PROVIDER_APIS.infomaniak.parse(fixture("infomaniak.handwritten.json"), ctx())).toThrow(HardError);
  });

  it("fails hard when the currency differs from the pinned one", () => {
    expect(() =>
      PROVIDER_APIS.infomaniak.parse(fixture("infomaniak.handwritten.json"), ctx({ ...config, currency: "EUR" })),
    ).toThrow(HardError);
  });
});

describe("mistral (hand-written fixture)", () => {
  it("maps deprecation dates and has no prices", () => {
    const records = PROVIDER_APIS.mistral.parse(fixture("mistral.handwritten.json"), ctx());
    expect(records.find((r) => r.model === "mistral-large-2411")).toMatchObject({
      deprecation_date: "2026-11-30",
      prices: {},
      limits: { max_input_tokens: 131072 },
    });
  });
});

describe("models.dev", () => {
  it("only reads our providers, in USD per 1M tokens", async () => {
    const { providers } = await loadFixtureInputs();
    const records = parseModelsDev(fixture("models-dev.json"), providers, BUILT_AT);
    expect(new Set(records.map((r) => r.provider))).toEqual(new Set(["greenpt", "regolo", "infomaniak", "mistral"]));
    expect(records.find((r) => r.model === "green-s")).toMatchObject({ mode: "audio_transcription", prices: {} });
    expect(records.find((r) => r.model === "faster-whisper-large-v3")?.prices.input).toBeUndefined();
  });
});
