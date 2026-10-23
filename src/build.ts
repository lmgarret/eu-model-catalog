import { Decimal } from "decimal.js";
import {
  type Catalog,
  type CatalogInfo,
  type CatalogModel,
  type CatalogPrice,
  type Pricing,
  type SourceState,
  catalogSchema,
  pricingSchema,
} from "./catalog.js";
import type { Scores } from "./benchmarks.js";
import type { Overlay, OverlayEntry, ProvidersConfig } from "./config.js";
import { type Labs, type ProvidersFacts, claimsOf, isStale } from "./facts.js";
import { LabIndex } from "./labs.js";
import {
  HardError,
  INFO_KEYS,
  MODES,
  type Mode,
  type ModelInfo,
  type ModelRecord,
  PRICE_KEYS,
  type PriceKey,
  type SourceKind,
  SOURCES,
} from "./model.js";
import {
  BIFROST_PRICE_FIELDS,
  type BifrostPriceField,
  type Rates,
  bifrostField,
  relativeDiff,
  toJsonNumber,
  toUsdPerUnit,
} from "./money.js";
import { type Datasheet, type DatasheetEntry, datasheetModelName } from "./sources/bifrost.js";
import { hfModelUrl, sameLicense } from "./sources/huggingface.js";
import { providerApi } from "./sources/providers/index.js";
import { Warnings } from "./warnings.js";

/**
 * Relative difference above which an overlay price is reported as disagreeing. Prices quoted in
 * different currencies get more slack, since models.dev converts at its own exchange rate.
 */
export const MISMATCH_TOLERANCE = { sameCurrency: new Decimal("0.001"), crossCurrency: new Decimal("0.05") };

export interface BuildInputs {
  builtAt: string;
  providers: ProvidersConfig;
  overlay: Overlay;
  /** providers/<provider>.yaml */
  facts: ProvidersFacts;
  labs: Labs;
  /** License per Hugging Face repo, for lab models with `hf`. Missing repos weren't fetched. */
  hfLicenses: Map<string, string | undefined>;
  /** Benchmark scores per canonical id, already matched and resolved against the previous catalog. */
  benchmarks: Record<string, Scores>;
  datasheet: Datasheet;
  rates: Rates;
  /** models.dev and provider API states, already resolved against the previous catalog. */
  sources: SourceState[];
}

export interface BuildOutputs {
  pricing: Pricing;
  catalog: Catalog;
}

interface Candidate {
  value: Decimal;
  price: CatalogPrice["original"];
  source: SourceKind;
  at: string;
  stale_since?: string;
  source_url?: string;
}

interface Scalar<T> {
  value: T;
  source: SourceKind;
  at: string;
  stale_since?: string;
}

type InfoScalar = Scalar<unknown> & { url?: string };

/** Everything known about one model of one provider, per source. */
interface Group {
  names: Partial<Record<SourceKind, string>>;
  baseKey?: string;
  prices: Partial<Record<BifrostPriceField, Partial<Record<SourceKind, Candidate>>>>;
  mode: Partial<Record<SourceKind, Scalar<Mode>>>;
  maxInput: Partial<Record<SourceKind, Scalar<number>>>;
  maxOutput: Partial<Record<SourceKind, Scalar<number>>>;
  deprecation: Partial<Record<SourceKind, Scalar<string>>>;
  info: Partial<Record<keyof ModelInfo, Partial<Record<SourceKind, InfoScalar>>>>;
  /** Price keys some source gives a value for, in any unit. */
  priced: Set<PriceKey>;
  /** Sources that list the model with a 0 or missing price, per price key. */
  unpricedBy: Partial<Record<PriceKey, SourceKind[]>>;
  inputOnly: boolean;
}

const PRECEDENCE: readonly SourceKind[] = SOURCES;

/** The unit each Bifrost price field is quoted in. */
const FIELD_KEY: Record<BifrostPriceField, PriceKey> = {
  input_cost_per_token: "input",
  cache_read_input_token_cost: "cached_input",
  output_cost_per_token: "output",
  ocr_cost_per_page: "input",
  input_cost_per_second: "input",
  input_cost_per_character: "input",
};

const FIELD_UNIT: Record<BifrostPriceField, CatalogPrice["original"]["per"]> = {
  input_cost_per_token: "token",
  cache_read_input_token_cost: "token",
  output_cost_per_token: "token",
  ocr_cost_per_page: "page",
  input_cost_per_second: "second",
  input_cost_per_character: "character",
};

function winner<T>(bySource: Partial<Record<SourceKind, T>>): T | undefined {
  for (const s of [...PRECEDENCE].reverse()) if (bySource[s] !== undefined) return bySource[s];
  return undefined;
}

/** Bifrost's capability flags that map to model facts. */
const BIFROST_INFO: Partial<Record<keyof ModelInfo, string>> = {
  tool_call: "supports_function_calling",
  structured_output: "supports_response_schema",
  reasoning: "supports_reasoning",
};

function overlayToRecord(provider: string, model: string, e: OverlayEntry): ModelRecord {
  const info = Object.fromEntries(INFO_KEYS.filter((k) => k in e).map((k) => [k, e[k as keyof OverlayEntry]]));
  return {
    provider,
    model,
    source: "overlay",
    // Entries without prices may leave out currency and unit; nothing reads them then.
    currency: e.currency ?? "USD",
    unit: e.per ?? "1M_tokens",
    prices: { input: e.input, cached_input: e.cached_input, output: e.output },
    limits: { max_input_tokens: e.max_input_tokens, max_output_tokens: e.max_output_tokens },
    mode: e.mode,
    deprecation_date: e.deprecation_date,
    info,
    source_url: e.source,
    fetched_at: e.checked,
  };
}

/** Prices a model is expected to have: chat models are billed for output too, unless billed on input only. */
function expectedPrices(mode: Mode | undefined, inputOnly: boolean): ("input" | "output")[] {
  return (mode === undefined || mode === "chat") && !inputOnly ? ["input", "output"] : ["input"];
}

function describe(c: Candidate): string {
  return `${c.source}: ${toJsonNumber(c.value)} USD (${c.price.amount} ${c.price.currency}/${c.price.per})`;
}

class ProviderMerge {
  private readonly groups = new Map<string, Group>();

  constructor(
    private readonly provider: string,
    private readonly rates: Rates,
    private readonly warnings: Warnings,
  ) {}

  private group(model: string): Group {
    const id = model.toLowerCase();
    let g = this.groups.get(id);
    if (!g) {
      g = {
        names: {},
        prices: {},
        mode: {},
        maxInput: {},
        maxOutput: {},
        deprecation: {},
        info: {},
        priced: new Set(),
        unpricedBy: {},
        inputOnly: false,
      };
      this.groups.set(id, g);
    }
    return g;
  }

  addBase(key: string, entry: DatasheetEntry, at: string): void {
    const g = this.group(datasheetModelName(key));
    if (g.baseKey) return; // Same model under another key: leave that entry alone.
    g.baseKey = key;
    g.names.bifrost = datasheetModelName(key);
    for (const field of BIFROST_PRICE_FIELDS) {
      const v = entry[field];
      if (typeof v === "number" && v > 0) {
        g.priced.add(FIELD_KEY[field]);
        (g.prices[field] ??= {}).bifrost = {
          value: new Decimal(v),
          price: { amount: String(v), currency: "USD", per: FIELD_UNIT[field] },
          source: "bifrost",
          at,
          ...(typeof entry.source === "string" && { source_url: entry.source }),
        };
      }
    }
    const scalar = <T>(value: T): Scalar<T> => ({ value, source: "bifrost", at });
    if (typeof entry.mode === "string" && (MODES as readonly string[]).includes(entry.mode)) {
      g.mode.bifrost = scalar(entry.mode as Mode);
    }
    if (typeof entry.max_input_tokens === "number" && entry.max_input_tokens > 0) g.maxInput.bifrost = scalar(entry.max_input_tokens);
    if (typeof entry.max_output_tokens === "number" && entry.max_output_tokens > 0) g.maxOutput.bifrost = scalar(entry.max_output_tokens);
    if (typeof entry.deprecation_date === "string") g.deprecation.bifrost = scalar(entry.deprecation_date);
    for (const [key, flag] of Object.entries(BIFROST_INFO)) {
      if (typeof entry[flag] === "boolean") (g.info[key as keyof ModelInfo] ??= {}).bifrost = scalar(entry[flag]);
    }
  }

  addRecord(r: ModelRecord, checkPrices: boolean): void {
    const g = this.group(r.model);
    const s = r.source;
    g.names[s] = r.model;
    const prov = { source: s, at: r.fetched_at, stale_since: r.stale_since };
    for (const key of PRICE_KEYS) {
      const amount = r.prices[key];
      if (amount === undefined) continue;
      const field = bifrostField(r.unit, key);
      if (!field) continue;
      g.priced.add(key);
      (g.prices[field] ??= {})[s] = {
        value: toUsdPerUnit(amount, r.currency, r.unit, this.rates),
        price: { amount, currency: r.currency, per: r.unit },
        source_url: r.source_url,
        ...prov,
      };
    }
    if (r.mode) g.mode[s] = { value: r.mode, ...prov };
    if (r.limits.max_input_tokens) g.maxInput[s] = { value: r.limits.max_input_tokens, ...prov };
    if (r.limits.max_output_tokens) g.maxOutput[s] = { value: r.limits.max_output_tokens, ...prov };
    if (r.deprecation_date) g.deprecation[s] = { value: r.deprecation_date, ...prov };
    for (const [key, value] of Object.entries(r.info ?? {})) {
      if (value !== undefined) (g.info[key as keyof ModelInfo] ??= {})[s] = { value, ...prov, url: r.source_url };
    }

    if (r.input_only) g.inputOnly = true;

    if (checkPrices && r.source !== "overlay") {
      for (const key of ["input", "output"] as const) {
        if (r.prices[key] === undefined) (g.unpricedBy[key] ??= []).push(r.source);
      }
    }
  }

  /**
   * Warns once per model and price when a source lists a 0 or missing price (treated as missing,
   * never free) and no other source fills it in.
   */
  checkMissing(): void {
    for (const { group: g, name } of this.merged()) {
      for (const key of expectedPrices(winner(g.mode)?.value, g.inputOnly)) {
        const sources = g.unpricedBy[key];
        if (!sources?.length || g.priced.has(key)) continue;
        this.warnings.add({
          code: "missing_price",
          provider: this.provider,
          model: name,
          message: `${this.provider}/${name} has no ${key} price: ${sources.join(" and ")} ${sources.length > 1 ? "list" : "lists"} 0 or none, and no other source has one`,
          details: { price: key, sources },
        });
      }
    }
  }

  /** Warns when the overlay disagrees with models.dev or the API on a price. */
  checkOverlay(): void {
    for (const g of this.groups.values()) {
      for (const [field, bySource] of Object.entries(g.prices)) {
        const overlay = bySource.overlay;
        if (!overlay) continue;
        for (const other of [bySource["models.dev"], bySource.api]) {
          if (!other) continue;
          const tolerance =
            other.price.currency === overlay.price.currency
              ? MISMATCH_TOLERANCE.sameCurrency
              : MISMATCH_TOLERANCE.crossCurrency;
          if (relativeDiff(overlay.value, other.value).lte(tolerance)) continue;
          this.warnings.add({
            code: "price_mismatch",
            provider: this.provider,
            model: g.names.overlay,
            message: `${this.provider}/${g.names.overlay} ${field}: ${describe(overlay)} vs ${describe(other)}`,
            details: { field, overlay: toJsonNumber(overlay.value), [other.source]: toJsonNumber(other.value) },
          });
        }
      }
    }
  }

  /** Warns about overlay models the provider API no longer lists. */
  checkListed(listed: Set<string>): void {
    for (const g of this.groups.values()) {
      const name = g.names.overlay;
      if (name && !listed.has(name.toLowerCase())) {
        this.warnings.add({
          code: "overlay_unlisted",
          provider: this.provider,
          model: name,
          message: `overlay/${this.provider}.yaml has ${name}, which the ${this.provider} API no longer lists`,
        });
      }
    }
  }

  *merged(): Generator<{ group: Group; name: string }> {
    const sorted = [...this.groups.values()].map((group) => ({
      group,
      // The provider's own spelling wins, since that is what requests carry.
      name: group.names.api ?? group.names.overlay ?? group.names["models.dev"] ?? group.names.bifrost ?? "",
    }));
    sorted.sort((a, b) => a.name.localeCompare(b.name));
    yield* sorted;
  }
}

function toField<T>(s: Scalar<T> | undefined) {
  return s && { value: s.value, source: s.source, at: s.at, ...(s.stale_since && { stale_since: s.stale_since }) };
}

/** Lab model license per canonical id: the hand-kept one, else the Hugging Face card's. */
type LabLicenses = Map<string, { value: string; url: string; at: string }>;

/**
 * Merges model facts by precedence, then fills the lab and its model's facts from labs/, which
 * rank below the overlay and above every fetched source.
 */
function mergeInfo(
  g: Group,
  name: string,
  ctx: { index: LabIndex; licenses: LabLicenses; hostLab?: string; overlay?: OverlayEntry; today: string },
  warn: (code: "unattributed_model" | "unknown_lab_model", message: string) => void,
): { info: CatalogInfo; canonical: string | null } {
  const info: Record<string, CatalogInfo[keyof CatalogInfo]> = {};
  for (const [key, bySource] of Object.entries(g.info)) {
    const w = winner(bySource);
    if (w) info[key] = { value: w.value, source: w.source, at: w.at, ...(w.url && { url: w.url }) } as CatalogInfo[keyof CatalogInfo];
  }
  const merged = info as CatalogInfo;
  const resolved = ctx.index.resolve({
    model: name,
    hostLab: ctx.hostLab,
    overlay: ctx.overlay?.canonical,
    modelsDev: g.info.canonical_id?.["models.dev"]?.value as string | undefined,
  });
  if (!resolved) {
    warn("unattributed_model", `${name} maps to no lab; set \`canonical\` in its overlay entry`);
    return { info: merged, canonical: null };
  }
  merged.lab = { value: resolved.lab, source: "labs", at: ctx.today };
  const found = ctx.index.model(resolved);
  const m = found?.model;
  if (!m) {
    warn("unknown_lab_model", `${name} maps to ${resolved.id} (via ${resolved.via}), which labs/${resolved.lab}.yaml doesn't list`);
    return { info: merged, canonical: resolved.id };
  }
  const prov = { source: "labs" as const, at: m.checked, url: m.source };
  const set = <K extends keyof CatalogInfo>(key: K, value: unknown, p = prov) => {
    if (value !== undefined && merged[key]?.source !== "overlay") merged[key] = { value, ...p } as CatalogInfo[K];
  };
  set("name", m.name);
  const license = ctx.licenses.get(resolved.id);
  if (license) set("license", license.value, { source: "labs", at: license.at, url: license.url });
  set("open_weights", m.open_weights);
  set("release_date", m.release_date);
  set("knowledge_cutoff", m.knowledge_cutoff);
  return { info: merged, canonical: resolved.id };
}

/**
 * Each lab model's license: the one in labs/, else its Hugging Face card's. Warns when both exist
 * and disagree, or when a repo couldn't be fetched.
 */
function labLicenses(labs: Labs, hf: Map<string, string | undefined>, today: string, warnings: Warnings): LabLicenses {
  const out: LabLicenses = new Map();
  for (const [lab, l] of Object.entries(labs)) {
    for (const [slug, m] of Object.entries(l.models)) {
      const card = m.hf ? hf.get(m.hf) : undefined;
      if (m.license && card && !sameLicense(m.license, card)) {
        warnings.add({
          code: "license_mismatch",
          message: `labs/${lab}.yaml ${slug}: license "${m.license}", but ${m.hf} on Hugging Face says "${card}"`,
          details: { lab, model: slug, labs: m.license, huggingface: card },
        });
      }
      if (m.license) out.set(`${lab}/${slug}`, { value: m.license, url: m.source, at: m.checked });
      else if (card && m.hf) out.set(`${lab}/${slug}`, { value: card, url: hfModelUrl(m.hf), at: today });
    }
  }
  return out;
}

/** Warns about provider facts and lab models checked longer ago than STALE_AFTER_MONTHS. */
function checkStaleFacts(facts: ProvidersFacts, labs: Labs, today: string, warnings: Warnings): void {
  for (const [provider, f] of Object.entries(facts)) {
    for (const c of claimsOf(f)) {
      if (!isStale(c.checked, today)) continue;
      warnings.add({
        code: "stale_fact",
        provider,
        message: `providers/${provider}.yaml ${c.path} was last checked on ${c.checked}; recheck ${c.source}`,
        details: { path: c.path, checked: c.checked },
      });
    }
  }
  for (const [lab, l] of Object.entries(labs)) {
    const claims = [
      ...(l.eu_ai_act ? [{ path: "eu_ai_act", ...l.eu_ai_act }] : []),
      ...Object.entries(l.models).map(([slug, m]) => ({ path: `models.${slug}`, ...m })),
    ];
    for (const c of claims) {
      if (!isStale(c.checked, today)) continue;
      warnings.add({
        code: "stale_fact",
        message: `labs/${lab}.yaml ${c.path} was last checked on ${c.checked}; recheck ${c.source}`,
        details: { lab, path: c.path, checked: c.checked },
      });
    }
  }
}

export function buildOutputs(inputs: BuildInputs, warnings: Warnings): BuildOutputs {
  const { providers, datasheet, rates, builtAt, labs } = inputs;
  const today = builtAt.slice(0, 10);
  checkStaleFacts(inputs.facts, labs, today, warnings);
  const index = new LabIndex(labs);
  const licenses = labLicenses(labs, inputs.hfLicenses, today, warnings);
  const removed = new Set<string>();
  const ours: Pricing = {};
  const models: CatalogModel[] = [];

  for (const [provider, config] of Object.entries(providers)) {
    const bp = config.bifrost_provider;
    const merge = new ProviderMerge(provider, rates, warnings);

    for (const [key, entry] of Object.entries(datasheet)) {
      if (entry.provider === bp) merge.addBase(key, entry, today);
    }
    const states = inputs.sources.filter((s) => s.kind === "models.dev" || s.provider === provider);
    for (const kind of ["models.dev", "api"] as const) {
      for (const state of states.filter((s) => s.kind === kind)) {
        const checkPrices = kind === "models.dev" || (providerApi(provider)?.hasPrices ?? false);
        for (const r of state.records) if (r.provider === provider) merge.addRecord(r, checkPrices);
      }
    }
    for (const [model, entry] of Object.entries(inputs.overlay[provider] ?? {})) {
      merge.addRecord(overlayToRecord(provider, model, entry), false);
    }
    merge.checkOverlay();
    merge.checkMissing();
    const api = inputs.sources.find((s) => s.kind === "api" && s.provider === provider);
    if (api?.status === "ok") merge.checkListed(new Set(api.records.map((r) => r.model.toLowerCase())));

    for (const { group: g, name } of merge.merged()) {
      const prices: CatalogModel["prices"] = {};
      for (const field of BIFROST_PRICE_FIELDS) {
        const c = g.prices[field] && winner(g.prices[field]);
        if (!c) continue;
        prices[field] = {
          usd_per_unit: toJsonNumber(c.value),
          original: c.price,
          source: c.source,
          at: c.at,
          ...(c.stale_since && { stale_since: c.stale_since }),
          ...(c.source_url && { source_url: c.source_url }),
        };
      }
      const mode = winner(g.mode);
      const maxInput = winner(g.maxInput);
      const maxOutput = winner(g.maxOutput);
      const deprecation = winner(g.deprecation);
      const priced = Object.keys(prices).length > 0;
      // An unpriced entry would make Bifrost bill the model as free; leave it out unless Bifrost already has it.
      const key = priced || g.baseKey ? `${bp}/${name}` : null;

      if (key) {
        const base = g.baseKey ? datasheet[g.baseKey] : undefined;
        if (g.baseKey && g.baseKey !== key) removed.add(g.baseKey);
        const entry: Record<string, unknown> = { ...base, provider: bp, base_model: base?.base_model ?? name };
        entry.mode = mode?.value ?? base?.mode ?? "chat";
        for (const [field, p] of Object.entries(prices)) entry[field] = p.usd_per_unit;
        if (maxInput) entry.max_input_tokens = maxInput.value;
        if (maxOutput) entry.max_output_tokens = maxOutput.value;
        if (deprecation) {
          entry.deprecation_date = deprecation.value;
          entry.is_deprecated = deprecation.value <= today;
        }
        const top = prices.input_cost_per_token ?? Object.values(prices)[0];
        if (top?.source_url) entry.source = top.source_url;
        ours[key] = entry;
      }

      const { info, canonical } = mergeInfo(
        g,
        name,
        { index, licenses, hostLab: config.lab, overlay: g.names.overlay ? inputs.overlay[provider]?.[g.names.overlay] : undefined, today },
        (code, message) => warnings.add({ code, provider, model: name, message: `${provider}/${message}` }),
      );
      models.push({
        provider,
        bifrost_provider: bp,
        model: name,
        pricing_key: key,
        bifrost_id: `${bp}/${name}`,
        canonical_id: canonical,
        ...(mode && { mode: toField(mode) }),
        prices,
        limits: {
          ...(maxInput && { max_input_tokens: toField(maxInput) }),
          ...(maxOutput && { max_output_tokens: toField(maxOutput) }),
        },
        ...(deprecation && { deprecation_date: toField(deprecation) }),
        info,
        extra: {},
      });
    }
  }

  // The whole Bifrost base, in its order, then our entries: pricing_url replaces Bifrost's catalog.
  const pricing: Pricing = {};
  for (const [key, entry] of Object.entries(datasheet)) {
    if (!removed.has(key) && !(key in ours)) pricing[key] = entry;
  }
  Object.assign(pricing, ours);

  const catalog: Catalog = {
    schema_version: 1,
    built_at: builtAt,
    exchange_rates: rates,
    providers: Object.fromEntries(
      Object.entries(providers).map(([p, c]) => [
        p,
        {
          bifrost_provider: c.bifrost_provider,
          models_dev_id: c.models_dev_id,
          ...(c.currency && { currency: c.currency }),
          ...(inputs.facts[p] && { facts: inputs.facts[p] }),
        },
      ]),
    ),
    labs: Object.fromEntries(
      Object.entries(labs).map(([k, { aliases, models: labModels, ...lab }]) => [
        k,
        {
          ...lab,
          models: Object.fromEntries(
            Object.entries(labModels).map(([slug, { aliases, epoch, lmarena, ...m }]) => {
              const license = licenses.get(`${k}/${slug}`);
              const scores = inputs.benchmarks[`${k}/${slug}`];
              return [
                slug,
                {
                  ...m,
                  ...(license && { license: license.value, ...(license.url !== m.source && { license_url: license.url }) }),
                  ...(scores && { scores }),
                },
              ];
            }),
          ),
        },
      ]),
    ),
    warnings: warnings.items,
    sources: inputs.sources,
    models,
  };

  validateOutputs({ pricing, catalog }, providers);
  return { pricing, catalog };
}

/** The output's own schema check. A failure stops the build so a broken sheet never gets published. */
export function validateOutputs(outputs: BuildOutputs, providers: ProvidersConfig): void {
  const pricing = pricingSchema.safeParse(outputs.pricing);
  const catalog = catalogSchema.safeParse(outputs.catalog);
  const problems = [
    ...(pricing.success ? [] : pricing.error.issues.slice(0, 10).map((i) => `pricing.json ${i.path.join(".")}: ${i.message}`)),
    ...(catalog.success ? [] : catalog.error.issues.slice(0, 10).map((i) => `catalog.json ${i.path.join(".")}: ${i.message}`)),
  ];
  const ourProviders = new Set(Object.values(providers).map((p) => p.bifrost_provider));
  for (const m of outputs.catalog.models) {
    if (!m.pricing_key) continue;
    const entry = outputs.pricing[m.pricing_key];
    if (!entry) problems.push(`pricing.json is missing ${m.pricing_key}`);
    else if (!ourProviders.has(entry.provider as string) || typeof entry.mode !== "string") {
      problems.push(`pricing.json ${m.pricing_key}: Bifrost needs provider and mode to match requests`);
    }
  }
  if (problems.length) throw new HardError(`output failed its schema check:\n  ${problems.join("\n  ")}`);
}
