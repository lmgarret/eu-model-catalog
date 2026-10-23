import { readFileSync } from "node:fs";
import path from "node:path";
import type { BuildInputs } from "../src/build.js";
import type { SourceState } from "../src/catalog.js";
import { normalizeRecords } from "../src/collect.js";
import { loadOverlay, loadProviders } from "../src/config.js";
import { loadLabs, loadProviderFacts } from "../src/facts.js";
import { parseDatasheet } from "../src/sources/bifrost.js";
import { parseEcb } from "../src/sources/ecb.js";
import { parseModelsDev } from "../src/sources/modelsdev.js";
import { PROVIDER_APIS } from "../src/sources/providers/index.js";

export const FIXTURES = path.join(import.meta.dirname, "fixtures");
export const ROOT = path.join(import.meta.dirname, "..");
export const BUILT_AT = "2026-10-22T05:00:00.000Z";

export function fixture(name: string): unknown {
  return JSON.parse(readFileSync(path.join(FIXTURES, name), "utf8"));
}

export const API_FIXTURES: Record<keyof typeof PROVIDER_APIS, string> = {
  greenpt: "greenpt.json",
  regolo: "regolo.json",
  infomaniak: "infomaniak.handwritten.json",
  mistral: "mistral.handwritten.json",
};

export async function loadFixtureInputs(): Promise<BuildInputs> {
  const providers = await loadProviders(path.join(ROOT, "providers.yaml"));
  const sources: SourceState[] = [
    {
      id: "models.dev",
      kind: "models.dev",
      status: "ok",
      fetched_at: BUILT_AT,
      records: normalizeRecords(parseModelsDev(fixture("models-dev.json"), providers, BUILT_AT)),
    },
    ...(Object.keys(API_FIXTURES) as (keyof typeof PROVIDER_APIS)[]).map(
      (p): SourceState => ({
        id: `api:${p}`,
        kind: "api",
        provider: p,
        status: "ok",
        fetched_at: BUILT_AT,
        records: normalizeRecords(
          PROVIDER_APIS[p].parse(fixture(API_FIXTURES[p]), { config: providers[p]!, fetchedAt: BUILT_AT }),
        ),
      }),
    ),
  ];
  return {
    builtAt: BUILT_AT,
    providers,
    overlay: await loadOverlay(path.join(FIXTURES, "overlay"), Object.keys(providers)),
    facts: await loadProviderFacts(path.join(FIXTURES, "providers"), Object.keys(providers)),
    labs: await loadLabs(path.join(FIXTURES, "labs")),
    hfLicenses: new Map(),
    scores: {},
    benchmarks: {},
    datasheet: parseDatasheet(fixture("bifrost-datasheet.json"), 0),
    rates: parseEcb(readFileSync(path.join(FIXTURES, "ecb.xml"), "utf8")),
    sources,
  };
}
