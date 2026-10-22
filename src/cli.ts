import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { buildOutputs } from "./build.js";
import { collectSources, fetchPreviousCatalog } from "./collect.js";
import { loadOverlay, loadProviders } from "./config.js";
import { loadLabs, loadProviderFacts } from "./facts.js";
import { fetchJson } from "./http.js";
import { HardError } from "./model.js";
import type { Rates } from "./money.js";
import { BIFROST_DATASHEET_URL, parseDatasheet } from "./sources/bifrost.js";
import { fetchEcb } from "./sources/ecb.js";
import { fetchHfLicenses } from "./sources/huggingface.js";
import { Warnings, toAnnotation } from "./warnings.js";

const PAGES_URL = "https://lmgarret.github.io/eu-model-catalog";

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      out: { type: "string", default: "dist" },
      previous: { type: "string", default: process.env.PREVIOUS_CATALOG_URL ?? `${PAGES_URL}/catalog.json` },
    },
  });
  const root = process.cwd();
  const out = path.resolve(root, values.out);
  const builtAt = new Date().toISOString();
  const warnings = new Warnings();

  const providers = await loadProviders(path.join(root, "providers.yaml"));
  const overlay = await loadOverlay(path.join(root, "overlay"), Object.keys(providers));
  const facts = await loadProviderFacts(path.join(root, "providers"), Object.keys(providers));
  const labs = await loadLabs(path.join(root, "labs"));
  const hfRepos = Object.values(labs).flatMap((l) => Object.values(l.models).flatMap((m) => (m.hf ? [m.hf] : [])));

  const previous = await fetchPreviousCatalog(values.previous);
  console.log(previous.note);

  const [datasheet, rates, sources, hf] = await Promise.all([
    fetchJson(BIFROST_DATASHEET_URL).then(
      (raw) => parseDatasheet(raw),
      (err: unknown) => {
        throw new HardError(`Bifrost datasheet unavailable, refusing to publish a partial sheet: ${String(err)}`);
      },
    ),
    fetchEcb().catch((err: unknown): Rates => {
      const prev = previous.catalog?.exchange_rates;
      if (!prev) throw new HardError(`ECB rates unavailable and no previous rates: ${String(err)}`);
      warnings.add({ code: "source_failed", message: `ECB rates failed (${String(err)}); reusing rates of ${prev.date}` });
      return prev;
    }),
    collectSources(providers, process.env, builtAt, previous.catalog, warnings),
    fetchHfLicenses(hfRepos),
  ]);
  if (hf.failed.length) {
    warnings.add({
      code: "source_failed",
      message: `Hugging Face: couldn't read ${hf.failed.length} model cards, so their licenses aren't checked: ${hf.failed.join(", ")}`,
    });
  }

  const { pricing, catalog } = buildOutputs(
    { builtAt, providers, overlay, facts, labs, hfLicenses: hf.licenses, datasheet, rates, sources },
    warnings,
  );

  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, "pricing.json"), JSON.stringify(pricing));
  await writeFile(path.join(out, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`);

  for (const w of warnings.items) console.log(toAnnotation(w));
  const ours = catalog.models.filter((m) => m.pricing_key).length;
  console.log(
    `Wrote ${Object.keys(pricing).length} pricing entries (${ours} from our providers) and ${catalog.models.length} catalog models to ${out}; ` +
      `EUR/USD ${rates.rates.USD}, EUR/CHF ${rates.rates.CHF} (ECB ${rates.date}); ${warnings.items.length} warnings`,
  );
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`::error title=${err instanceof HardError ? "build failed" : "unexpected error"}::${message.replace(/\n/g, "%0A")}`);
  process.exitCode = 1;
});
