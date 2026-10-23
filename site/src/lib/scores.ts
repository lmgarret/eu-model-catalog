import { maxPrivacy } from "./facts.js";
import { EUROPE, countryName } from "./format.js";
import type { ProviderFacts, SetupStep } from "./types.js";

/** One scored criterion. `rate` returns 0..1 with a reason, or undefined when the fact is unknown. */
export interface Criterion {
  id: string;
  label: string;
  weight: number;
  /** How the rating is derived, shown in the rubric. */
  rule: string;
  /** The improvable claim it rates, so the score can name the setup step behind a best value. */
  field?: string;
  rate(f: ProviderFacts): { value: number; reason: string } | undefined;
}

export type ScoreKind = "privacy" | "eco";

const TRAINING = { never: 1, opt_in: 0.8, opt_out: 0.2 } as const;
const ZDR = { default: 1, available: 0.8, on_request: 0.6, no: 0 } as const;
const BACKING = { own_generation: 1, ppa: 1, mixed: 0.8, certificates: 0.5, unknown: 0.6 } as const;
const ENV_CERTS = ["ISO14001", "ISO50001"];

export const CRITERIA: Record<ScoreKind, Criterion[]> = {
  privacy: [
    {
      id: "training",
      label: "No training on your data",
      weight: 25,
      field: "privacy.training",
      rule: "never 100%, opt-in 80%, opt-out 20%",
      rate: (f) => {
        const t = f.privacy.training?.value;
        return t && { value: TRAINING[t], reason: t.replace("_", "-") };
      },
    },
    {
      id: "retention",
      label: "Short retention",
      weight: 20,
      field: "privacy.retention",
      rule: "not stored 100%, ≤ 7 days 80%, ≤ 30 days 50%, longer 20%",
      rate: (f) => {
        const d = f.privacy.retention?.value.days;
        if (d === undefined) return undefined;
        return { value: d === 0 ? 1 : d <= 7 ? 0.8 : d <= 30 ? 0.5 : 0.2, reason: d === 0 ? "not stored" : `${d} days` };
      },
    },
    {
      id: "zdr",
      label: "Zero data retention",
      weight: 10,
      field: "privacy.zero_data_retention",
      rule: "by default 100%, available 80%, on request 60%, no 0%",
      rate: (f) => {
        const z = f.privacy.zero_data_retention?.value;
        return z && { value: ZDR[z], reason: z.replace("_", " ") };
      },
    },
    {
      id: "dpa",
      label: "Data processing agreement",
      weight: 10,
      rule: "available 100%, with a public sub-processor list; 80% without",
      rate: (f) => {
        const d = f.privacy.dpa?.value;
        if (!d) return undefined;
        if (!d.available) return { value: 0, reason: "none" };
        return d.subprocessors_url
          ? { value: 1, reason: "with sub-processor list" }
          : { value: 0.8, reason: "sub-processors not public" };
      },
    },
    {
      id: "entity",
      label: "European legal entity",
      weight: 15,
      rule: "contracting entity in the EU, EEA or Switzerland",
      rate: (f) => {
        const c = f.jurisdiction.legal_entity?.value.country;
        return c ? { value: EUROPE.has(c) ? 1 : 0, reason: countryName(c) } : undefined;
      },
    },
    {
      id: "cloud_act",
      label: "No US CLOUD Act exposure",
      weight: 15,
      rule: "no US parent company",
      rate: (f) => {
        const p = f.jurisdiction.parent_company?.value;
        return p && { value: p.us_cloud_act ? 0 : 1, reason: `${p.name}, ${countryName(p.country)}` };
      },
    },
    {
      id: "regions",
      label: "European data centers",
      weight: 5,
      field: "jurisdiction.regions",
      rule: "share of listed regions in the EU, EEA or Switzerland",
      rate: (f) => {
        const r = f.jurisdiction.regions?.value;
        if (!r) return undefined;
        const eu = r.filter((x) => EUROPE.has(x.country)).length;
        return { value: eu / r.length, reason: `${eu} of ${r.length} in Europe` };
      },
    },
  ],
  eco: [
    {
      id: "renewable",
      label: "Renewable energy",
      weight: 35,
      rule: "share × backing: own generation or PPA 1, mixed 0.8, unstated 0.6, certificates only 0.5",
      rate: (f) => {
        const e = f.sustainability.renewable_energy?.value;
        return e && { value: (e.share / 100) * BACKING[e.backing], reason: `${e.share}%, ${e.backing.replace("_", " ")}` };
      },
    },
    {
      id: "pue",
      label: "Data center efficiency",
      weight: 25,
      rule: "PUE 1.0 → 100%, linear to 1.6 → 0%",
      rate: (f) => {
        const p = f.sustainability.pue?.value;
        return p === undefined ? undefined : { value: Math.min(1, Math.max(0, (1.6 - p) / 0.6)), reason: `PUE ${p}` };
      },
    },
    {
      id: "heat",
      label: "Heat reuse",
      weight: 20,
      rule: "waste heat is reused",
      rate: (f) => {
        const h = f.sustainability.heat_reuse?.value;
        return h === undefined ? undefined : { value: h ? 1 : 0, reason: h ? "yes" : "no" };
      },
    },
    {
      id: "co2",
      label: "Published CO₂ per request",
      weight: 10,
      rule: "publishes gCO₂ per request or per tokens",
      rate: (f) => {
        const c = f.sustainability.co2?.value;
        return c && { value: 1, reason: `${c.grams} g per ${c.per === "request" ? "request" : "1M tokens"}` };
      },
    },
    {
      id: "env_cert",
      label: "Environmental certification",
      weight: 10,
      rule: "ISO 14001 or ISO 50001",
      rate: (f) => {
        const certs = f.jurisdiction.certifications?.value;
        if (!certs) return undefined;
        const found = certs.filter((c) => ENV_CERTS.includes(c.replace(/[\s:-]/g, "").toUpperCase()));
        return { value: found.length ? 1 : 0, reason: found.length ? found.join(", ") : "none listed" };
      },
    },
  ],
};

export type Weights = Record<string, number>;

export function defaultWeights(): Weights {
  return Object.fromEntries(Object.values(CRITERIA).flat().map((c) => [c.id, c.weight]));
}

export interface Score {
  /** 0..100. Unknown facts count as 0. */
  value: number;
  /** Share of the total weight backed by a known fact, 0..1. */
  coverage: number;
  parts: { criterion: Criterion; weight: number; rating?: { value: number; reason: string }; via?: SetupStep }[];
}

/**
 * Scores a provider out of 100. Privacy assumes its maximum self-serve setup: claims a self-serve
 * step improves are rated at their best value.
 */
export function score(kind: ScoreKind, facts: ProviderFacts | undefined, weights: Weights): Score | undefined {
  if (!facts) return undefined;
  const { facts: rated, via } = kind === "privacy" ? maxPrivacy(facts) : { facts, via: {} as Record<string, SetupStep> };
  const parts = CRITERIA[kind].map((criterion) => ({
    criterion,
    weight: weights[criterion.id] ?? criterion.weight,
    rating: criterion.rate(rated),
    via: criterion.field ? via[criterion.field] : undefined,
  }));
  const total = parts.reduce((s, p) => s + p.weight, 0);
  if (total === 0) return { value: 0, coverage: 0, parts };
  const earned = parts.reduce((s, p) => s + p.weight * (p.rating?.value ?? 0), 0);
  const known = parts.reduce((s, p) => s + (p.rating ? p.weight : 0), 0);
  return { value: Math.round((earned / total) * 100), coverage: known / total, parts };
}

/** Text colour class for a 0–100 score: good from 70, warn from 40, bad below. */
export function scoreTone(value: number | undefined): string {
  if (value === undefined) return "text-muted-foreground";
  return value >= 70 ? "text-good" : value >= 40 ? "text-warn" : "text-bad";
}
