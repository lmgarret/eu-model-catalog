import type { Catalog, CatalogModel } from "./types.js";

export interface OtherPrice {
  /** USD per `per`. */
  usd: number;
  per: "1K pages" | "minute" | "1M chars";
}

/** One provider's offer of a model. Prices are USD per 1M tokens. */
export interface Offer {
  id: string;
  provider: string;
  model: string;
  /** What requests to Bifrost use as the model, e.g. `Regolo.ai/mistral-small-4-119b`. */
  bifrostId: string;
  mode: string;
  input?: number;
  cached?: number;
  output?: number;
  other?: OtherPrice;
  context?: number;
  maxOutput?: number;
  deprecation?: string;
  deprecated: boolean;
  /** In pricing.json, so Bifrost can bill it. */
  billable: boolean;
  /** Prices reused from an earlier build. */
  staleSince?: string;
  m: CatalogModel;
}

/** A model, as its lab names it, with every provider offering it. */
export interface ModelGroup {
  /** The canonical id, or the offer's own id for unattributed models. */
  key: string;
  canonical: string | null;
  name: string;
  lab?: string;
  mode: string;
  license?: string;
  licenseUrl?: string;
  openWeights?: boolean;
  knowledge?: string;
  released?: string;
  tools?: boolean;
  structured?: boolean;
  reasoning?: boolean;
  vision?: boolean;
  audio?: boolean;
  offers: Offer[];
}

function otherPrice(m: CatalogModel): OtherPrice | undefined {
  const p = m.prices;
  if (p.ocr_cost_per_page) return { usd: p.ocr_cost_per_page.usd_per_unit * 1000, per: "1K pages" };
  if (p.input_cost_per_second) return { usd: p.input_cost_per_second.usd_per_unit * 60, per: "minute" };
  if (p.input_cost_per_character) return { usd: p.input_cost_per_character.usd_per_unit * 1e6, per: "1M chars" };
  return undefined;
}

export function toOffer(m: CatalogModel, today: string): Offer {
  const perM = (f: keyof CatalogModel["prices"]) => {
    const usd = m.prices[f]?.usd_per_unit;
    return usd === undefined ? undefined : usd * 1e6;
  };
  const deprecation = m.deprecation_date?.value;
  return {
    id: `${m.provider}/${m.model}`,
    provider: m.provider,
    model: m.model,
    bifrostId: m.bifrost_id || `${m.bifrost_provider}/${m.model}`,
    mode: m.mode?.value ?? "chat",
    input: perM("input_cost_per_token"),
    cached: perM("cache_read_input_token_cost"),
    output: perM("output_cost_per_token"),
    other: otherPrice(m),
    context: m.limits.max_input_tokens?.value,
    maxOutput: m.limits.max_output_tokens?.value,
    deprecation,
    deprecated: deprecation !== undefined && deprecation <= today,
    billable: m.pricing_key !== null,
    staleSince: Object.values(m.prices).find((p) => p.stale_since)?.stale_since,
    m,
  };
}

/**
 * Groups offers by canonical model. Model facts come from the lab entry when there is one, else
 * from any offer that has them; features count when any host reports them.
 */
export function groupModels(catalog: Catalog, offers: Offer[]): ModelGroup[] {
  const groups = new Map<string, ModelGroup>();
  for (const o of offers) {
    const key = o.m.canonical_id ?? o.id;
    let g = groups.get(key);
    if (!g) {
      const [lab, slug] = o.m.canonical_id?.split("/") ?? [];
      const labModel = lab && slug ? catalog.labs[lab]?.models[slug] : undefined;
      g = {
        key,
        canonical: o.m.canonical_id,
        name: labModel?.name ?? o.m.info.name?.value ?? o.model,
        lab: o.m.info.lab?.value,
        mode: o.mode,
        license: labModel?.license,
        licenseUrl: labModel?.license_url ?? labModel?.source,
        openWeights: labModel?.open_weights,
        knowledge: labModel?.knowledge_cutoff,
        released: labModel?.release_date,
        offers: [],
      };
      groups.set(key, g);
    }
    const i = o.m.info;
    g.license ??= i.license?.value;
    g.openWeights ??= i.open_weights?.value;
    g.knowledge ??= i.knowledge_cutoff?.value;
    g.released ??= i.release_date?.value;
    g.tools ||= i.tool_call?.value;
    g.structured ||= i.structured_output?.value;
    g.reasoning ||= i.reasoning?.value;
    g.vision ||= i.input_modalities?.value.includes("image");
    g.audio ||= i.input_modalities?.value.includes("audio");
    g.offers.push(o);
  }
  return [...groups.values()];
}

const min = (xs: (number | undefined)[]) => {
  const v = xs.filter((x): x is number => x !== undefined);
  return v.length ? Math.min(...v) : undefined;
};
const max = (xs: (number | undefined)[]) => {
  const v = xs.filter((x): x is number => x !== undefined);
  return v.length ? Math.max(...v) : undefined;
};

export const groupStats = (g: ModelGroup) => ({
  input: min(g.offers.map((o) => o.input ?? o.other?.usd)),
  output: min(g.offers.map((o) => o.output)),
  context: max(g.offers.map((o) => o.context)),
});

/** Sorts with missing values last in both directions. */
export function compareBy<T>(get: (r: T) => string | number | undefined, dir: 1 | -1) {
  return (a: T, b: T) => {
    const x = get(a);
    const y = get(b);
    if (x === undefined && y === undefined) return 0;
    if (x === undefined) return 1;
    if (y === undefined) return -1;
    return (typeof x === "string" ? x.localeCompare(String(y)) : x - (y as number)) * dir;
  };
}
