import { describe, expect, it } from "vitest";
import { buildOutputs } from "../src/build.js";
import { type ProviderFacts, providerFactsSchema } from "../src/facts.js";
import { Warnings } from "../src/warnings.js";
import { isStale } from "../site/src/lib/facts.js";
import { fromUsd, money, tokens } from "../site/src/lib/format.js";
import { groupModels, toOffer } from "../site/src/lib/models.js";
import { defaultWeights, score } from "../site/src/lib/scores.js";
import { loadFixtureInputs } from "./helpers.js";

const claim = <T>(value: T) => ({ value, source: "https://example.com", checked: "2026-10-22" });

const facts = (patch: Partial<Record<string, unknown>> = {}): ProviderFacts =>
  providerFactsSchema.parse({ name: "X", website: "https://example.com", ...patch });

describe("scores", () => {
  it("counts unknown facts as 0 and reports coverage", () => {
    const s = score("privacy", facts({ privacy: { training: claim("never") } }), defaultWeights())!;
    expect(s.value).toBe(25);
    expect(s.coverage).toBe(0.25);
  });

  it("gives full marks to a provider with every privacy fact at its best", () => {
    const f = facts({
      privacy: {
        training: claim("never"),
        retention: claim({ days: 0 }),
        zero_data_retention: claim("default"),
        dpa: claim({ available: true, subprocessors_url: "https://example.com/sub" }),
      },
      jurisdiction: {
        legal_entity: claim({ name: "X SA", country: "CH" }),
        parent_company: claim({ name: "X SA", country: "CH", us_cloud_act: false }),
        regions: claim([{ country: "CH" }]),
      },
    });
    expect(score("privacy", f, defaultWeights())).toMatchObject({ value: 100, coverage: 1 });
  });

  it("penalizes a US parent and certificate-only energy, and follows custom weights", () => {
    const f = facts({
      jurisdiction: { parent_company: claim({ name: "Big Inc", country: "US", us_cloud_act: true }) },
      sustainability: { renewable_energy: claim({ share: 100, backing: "certificates" }) },
    });
    expect(score("privacy", f, defaultWeights())!.value).toBe(0);
    expect(score("eco", f, defaultWeights())!.value).toBe(18); // 35 × 0.5 of 100
    expect(score("eco", f, { ...defaultWeights(), renewable: 100, pue: 0, heat: 0, co2: 0, env_cert: 0 })!.value).toBe(50);
  });

  it("has no score without facts", () => {
    expect(score("eco", undefined, defaultWeights())).toBeUndefined();
  });
});

describe("max privacy", () => {
  const setup = (access: string) => ({
    privacy: {
      retention: { ...claim({ days: 30 }), best: { value: { days: 0 }, via: "zdr" } },
      training: { ...claim("opt_out"), best: { value: "never", via: "toggle" } },
    },
    privacy_setup: [
      { id: "toggle", title: "Turn off training", how: "…", access: "self_serve", source: "https://example.com", checked: "2026-10-22" },
      { id: "zdr", title: "Ask for ZDR", how: "…", access, source: "https://example.com", checked: "2026-10-22" },
    ],
  });

  it("rates improvable claims at their best value only when a self-serve step unlocks it", () => {
    const s = score("privacy", facts(setup("on_request")), defaultWeights())!;
    const part = (id: string) => s.parts.find((p) => p.criterion.id === id)!;
    expect(part("training")).toMatchObject({ rating: { value: 1 }, via: { id: "toggle" } });
    expect(part("retention")).toMatchObject({ rating: { value: 0.5 } });
    expect(part("retention").via).toBeUndefined();
    const selfServe = score("privacy", facts(setup("self_serve")), defaultWeights())!;
    expect(selfServe.parts.find((p) => p.criterion.id === "retention")?.rating?.value).toBe(1);
  });

  it("rejects a best value pointing at a missing step", () => {
    expect(() => facts({ privacy: { training: { ...claim("opt_out"), best: { value: "never", via: "nope" } } } })).toThrow();
  });
});

describe("model groups", () => {
  it("groups offers by canonical model, with lab facts", async () => {
    const { catalog } = buildOutputs(await loadFixtureInputs(), new Warnings());
    const offers = catalog.models.map((m) => toOffer(m, "2026-10-22"));
    const groups = groupModels(catalog, offers);
    const small = groups.find((g) => g.key === "mistral/mistral-small-2506")!;
    expect(small).toMatchObject({ name: "Mistral Small 3.2", lab: "mistral", license: "Apache-2.0", tools: true });
    expect(small.offers.map((o) => o.bifrostId).sort()).toEqual(["GreenPT/green-l", "mistral/mistral-small-latest"]);
    const whisper = offers.find((o) => o.id === "regolo/faster-whisper-large-v3")!;
    expect(whisper.other).toMatchObject({ per: "minute" });
    expect(whisper.other!.usd).toBeCloseTo(0.00016851 * 60);
    // Unattributed models stay on their own.
    expect(groups.find((g) => g.key === "regolo/brick-v1-beta")?.canonical).toBeNull();
  });
});

describe("format", () => {
  const rates = { date: "2026-10-21", base: "EUR" as const, rates: { USD: "1.25", CHF: "0.9" }, source: "" };

  it("converts USD through EUR", () => {
    expect(fromUsd(1.25, "EUR", rates)).toBe(1);
    expect(fromUsd(1.25, "CHF", rates)).toBeCloseTo(0.9);
  });

  it("formats prices and token counts", () => {
    expect([money(1.5, "EUR"), money(0.5, "USD"), money(0.0225, "EUR"), money(0.0999, "EUR"), money(0, "CHF")]).toEqual([
      "€1.50",
      "$0.50",
      "€0.023",
      "€0.10",
      "CHF 0.00",
    ]);
    expect([tokens(128000), tokens(1048576), tokens(262144)]).toEqual(["128K", "1M", "262K"]);
  });

  it("flags facts checked more than six months ago", () => {
    const now = new Date("2026-10-22");
    expect(isStale("2026-04-21", now)).toBe(true);
    expect(isStale("2026-04-23", now)).toBe(false);
  });
});
