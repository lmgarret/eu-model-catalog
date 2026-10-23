import { BENCHMARKS, BENCHMARK_INFO, SOURCES } from "./benchmarks.js";
import { date, fromUsd, money, tokens } from "./format.js";
import { type ModelGroup, type Offer, groupStats } from "./models.js";
import type { Score } from "./scores.js";
import type { Benchmark, Catalog, Currency } from "./types.js";

/** How many models the compare page shows side by side. */
export const MAX_COMPARE = 3;

/** One colour per compared model, in pick order. */
export const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)"] as const;

/** The compare page's hash: each key URL-encoded (so `/` and `,` are safe) and joined with `,`. */
export const compareHash = (keys: readonly string[]): string => `#/compare/${keys.map(encodeURIComponent).join(",")}`;

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s; // a hand-typed URL with a stray `%`
  }
};

/** The keys in a compare route's raw segment: decoded, without empty parts or duplicates (the first stays). */
export function parseCompare(segment: string | undefined): string[] {
  return [...new Set((segment ?? "").split(",").filter(Boolean).map(decode))];
}

/** The group for each key, in the same order; `undefined` for a key the catalog doesn't have. */
export const resolveKeys = (keys: readonly string[], groups: readonly ModelGroup[]): (ModelGroup | undefined)[] =>
  keys.map((k) => groups.find((g) => g.key === k));

/** Whether the Compare button is enabled for these picks, and if not, the reason it shows. */
export function canCompare(groups: readonly Pick<ModelGroup, "mode">[]): { ok: true } | { ok: false; reason: string } {
  if (groups.length > MAX_COMPARE) return { ok: false, reason: `Pick up to ${MAX_COMPARE} to compare` };
  if (groups.length < 2) return { ok: false, reason: `Pick 2 or ${MAX_COMPARE} to compare` };
  if (new Set(groups.map((g) => g.mode)).size > 1) return { ok: false, reason: "Pick models of the same type" };
  return { ok: true };
}

/** A rank in words: "Best" for 1, then "2nd", "3rd", "4th", "11th", "21st"… */
export function ordinal(n: number): string {
  if (n === 1) return "Best";
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

/** Which values tie for the best; none unless at least 2 are known and they aren't all equal. */
export function bestFlags(values: readonly (number | undefined)[], better: "higher" | "lower"): boolean[] {
  const known = values.filter((v): v is number => v !== undefined);
  const best = better === "higher" ? Math.max(...known) : Math.min(...known);
  const tag = known.length >= 2 && known.some((v) => v !== best);
  return values.map((v) => tag && v === best);
}

/** What the spec sheet needs beyond the groups: names, the display currency and each provider's scores. */
export interface SpecContext {
  catalog: Catalog;
  currency: Currency;
  providerScores: Record<string, { privacy?: Score; eco?: Score }>;
}

/** One model's value in a row; `text` is "–" when the value is missing. */
export interface SpecCell {
  text: string;
  best: boolean;
  sub?: string;
  /** 0..100, drawn as a bar in the model's colour. */
  bar?: number;
  /** Provider ids, shown as logos. */
  providers?: string[];
}

export interface SpecRow {
  group: "Benchmarks" | "Price" | "Hosting" | "Model";
  label: string;
  cells: SpecCell[];
  /** Whether the known models show different values. */
  differs: boolean;
}

const DASH = "–";

const maxOf = (xs: (number | undefined)[]) => {
  const v = xs.filter((x): x is number => x !== undefined);
  return v.length ? Math.max(...v) : undefined;
};

/** The spec sheet's column template: the label column, then one column per model. */
export const specGridColumns = (n: number): string => `10rem repeat(${n}, minmax(12rem, 1fr))`;

/** The narrowest the sheet gets before it scrolls sideways; matches `specGridColumns`. */
export const specGridMinWidth = (n: number): string => `${10 + 12 * n}rem`;

/**
 * The spec sheet's rows, one cell per column. An `undefined` column (an unknown key) gets dashes and
 * is ignored by "best" and "differs". Benchmarks are included only when every known model is a chat model.
 */
export function specRows(groups: readonly (ModelGroup | undefined)[], ctx: SpecContext): SpecRow[] {
  const known = groups.filter((g): g is ModelGroup => g !== undefined);
  const price = (usd: number) => money(fromUsd(usd, ctx.currency, ctx.catalog.exchange_rates), ctx.currency);
  const providers = (g: ModelGroup) => [...new Set(g.offers.map((o) => o.provider))];
  const scoreOf = (g: ModelGroup, kind: "privacy" | "eco") =>
    maxOf(g.offers.map((o) => ctx.providerScores[o.provider]?.[kind]?.value));
  // Per-unit models (per minute, page or 1M characters) show their unit; a per-token offer wins.
  const inputUnit = (g: ModelGroup) =>
    g.offers.every((o) => o.input === undefined && o.other) ? g.offers.find((o) => o.other)?.other?.per : undefined;
  const cheapestHost = (g: ModelGroup) => {
    const by = g.offers.some((o) => o.output !== undefined) ? (o: Offer) => o.output : (o: Offer) => o.input ?? o.other?.usd;
    const cheapest = g.offers.filter((o) => by(o) !== undefined).sort((a, b) => by(a)! - by(b)!)[0];
    return cheapest && (ctx.catalog.providers[cheapest.provider]?.facts?.name ?? cheapest.provider);
  };

  const rows: SpecRow[] = [];
  /**
   * Adds a row; `value` feeds "best" when the row has a direction, `cell` gives the text and extras.
   * "Best" follows the text shown: a cell reading the same as a best one is tagged too, and none are when all read the same.
   */
  function add(
    group: SpecRow["group"],
    label: string,
    cell: (g: ModelGroup) => Omit<SpecCell, "best"> | string | undefined,
    compare?: { value: (g: ModelGroup) => number | undefined; better: "higher" | "lower" },
  ) {
    const flags = compare ? bestFlags(groups.map((g) => g && compare.value(g)), compare.better) : [];
    const cells = groups.map((g, i): SpecCell => {
      const c = g && cell(g);
      const base = typeof c === "string" ? { text: c } : (c ?? { text: DASH });
      return { ...base, text: base.text || DASH, best: flags[i] ?? false };
    });
    const texts = cells.filter((_, i) => groups[i] !== undefined).map((c) => c.text);
    const differs = texts.length >= 2 && new Set(texts).size > 1;
    const bestTexts = new Set(cells.filter((c) => c.best).map((c) => c.text));
    for (const [i, c] of cells.entries()) c.best = differs && groups[i] !== undefined && bestTexts.has(c.text);
    rows.push({ group, label, cells, differs });
  }

  if (known.length && known.every((g) => g.mode === "chat")) {
    for (const b of BENCHMARKS) {
      const info = BENCHMARK_INFO[b];
      add(
        "Benchmarks",
        info.label,
        (g) => {
          const s = g.scores?.[b];
          return s ? { text: `${s.percentile} /100`, sub: info.raw(s), bar: s.percentile } : `Not rated by ${SOURCES[info.source].name}`;
        },
        { value: (g) => g.scores?.[b]?.percentile, better: "higher" },
      );
    }
  }

  const units = new Set(known.filter((g) => groupStats(g).input !== undefined).map(inputUnit));
  add(
    "Price",
    "Input /1M",
    (g) => {
      const usd = groupStats(g).input;
      const per = inputUnit(g);
      return usd === undefined ? undefined : per ? `${price(usd)} / ${per}` : price(usd);
    },
    units.size <= 1 ? { value: (g) => groupStats(g).input, better: "lower" } : undefined,
  );
  add(
    "Price",
    "Output /1M",
    (g) => {
      const usd = groupStats(g).output;
      return usd === undefined ? undefined : price(usd);
    },
    { value: (g) => groupStats(g).output, better: "lower" },
  );
  add("Price", "Cheapest host", cheapestHost);

  add("Hosting", "Hosts", (g) => ({ text: String(providers(g).length), providers: providers(g) }), {
    value: (g) => providers(g).length,
    better: "higher",
  });
  for (const [kind, label] of [["privacy", "Privacy"], ["eco", "Eco"]] as const) {
    add("Hosting", label, (g) => scoreOf(g, kind)?.toString(), { value: (g) => scoreOf(g, kind), better: "higher" });
  }

  const maxOutput = (g: ModelGroup) => maxOf(g.offers.map((o) => o.maxOutput));
  add("Model", "Context", (g) => tokens(groupStats(g).context), { value: (g) => groupStats(g).context, better: "higher" });
  add("Model", "Max output", (g) => tokens(maxOutput(g)), { value: maxOutput, better: "higher" });
  add("Model", "Released", (g) => g.released && date(g.released));
  add("Model", "Knowledge cutoff", (g) => g.knowledge && date(g.knowledge));
  add("Model", "Weights", (g) => (g.openWeights === undefined ? undefined : g.openWeights ? "Open" : "Closed"));
  add("Model", "License", (g) => g.license);
  const FEATURES = [
    ["tools", "Tool calling"],
    ["structured", "Structured output"],
    ["vision", "Image input"],
    ["audio", "Audio input"],
    ["reasoning", "Reasoning"],
  ] as const;
  for (const [key, label] of FEATURES) add("Model", label, (g) => (g[key] ? "✓" : DASH));
  return rows;
}

/** A model on the price scatter: `price` is USD per 1M output tokens, `score` a percentile. */
export interface PricePoint {
  key: string;
  name: string;
  price: number;
  score: number;
}

/** The chat models with both an output price and a score on `b`. */
export function scatterPoints(groups: readonly ModelGroup[], b: Benchmark): PricePoint[] {
  return groups.flatMap((g) => {
    const price = groupStats(g).output;
    const score = g.scores?.[b]?.percentile;
    return g.mode === "chat" && price !== undefined && score !== undefined ? [{ key: g.key, name: g.name, price, score }] : [];
  });
}

/** Why each model isn't on the scatter; "not rated" wins when both are missing. */
export function missingFromScatter(groups: readonly ModelGroup[], b: Benchmark): { name: string; why: "no price" | "not rated" }[] {
  return groups.flatMap((g) => {
    const why = !g.scores?.[b] ? "not rated" : groupStats(g).output === undefined ? "no price" : undefined;
    return why ? [{ name: g.name, why }] : [];
  });
}

/** The best-value line: the points no other point beats on both price and score, by ascending price. */
export function bestValueFrontier(points: readonly PricePoint[]): PricePoint[] {
  const beaten = (p: PricePoint) =>
    points.some((q) => (q.price <= p.price && q.score > p.score) || (q.price < p.price && q.score >= p.score));
  return points.filter((p) => !beaten(p)).sort((a, b) => a.price - b.price);
}
