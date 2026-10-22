import { countryName, flag } from "./format.js";
import type { ProviderFacts, SetupStep } from "./types.js";

/** Same as STALE_AFTER_MONTHS in src/facts.ts, which imports node modules and can't be bundled. */
const STALE_AFTER_MONTHS = 6;

export function isStale(checked: string, now = new Date()): boolean {
  const limit = new Date(now);
  limit.setMonth(limit.getMonth() - STALE_AFTER_MONTHS);
  return new Date(checked) < limit;
}

export interface Claim<T = unknown> {
  value: T;
  source: string;
  checked: string;
  note?: string;
  best?: { value: T; via: string };
}

/** The improvable privacy claims, by path. */
const IMPROVABLE = [
  ["privacy", "retention"],
  ["privacy", "zero_data_retention"],
  ["privacy", "training"],
  ["jurisdiction", "regions"],
] as const;

/**
 * The provider's facts at maximum privacy: each improvable claim takes its `best` value when the
 * step that unlocks it is self-serve. `via` maps each improved path to its step.
 */
export function maxPrivacy(f: ProviderFacts): { facts: ProviderFacts; via: Record<string, SetupStep> } {
  const steps = new Map(f.privacy_setup.map((s) => [s.id, s]));
  const facts = { ...f, privacy: { ...f.privacy }, jurisdiction: { ...f.jurisdiction } };
  const via: Record<string, SetupStep> = {};
  for (const [section, key] of IMPROVABLE) {
    const c = (f[section] as Record<string, Claim | undefined>)[key];
    const step = c?.best && steps.get(c.best.via);
    if (!c?.best || step?.access !== "self_serve") continue;
    (facts[section] as Record<string, Claim>)[key] = { ...c, value: c.best.value };
    via[`${section}.${key}`] = step;
  }
  return { facts, via };
}

type Tone = "good" | "warn" | "bad";

export interface FactRow {
  label: string;
  hint: string;
  claim?: Claim;
  text?: string;
  tone?: Tone;
  href?: string;
  /** What the strictest setup gives, and the step for it. */
  best?: { text: string; tone?: Tone; step?: SetupStep };
}

export interface FactSection {
  title: string;
  rows: FactRow[];
}

const humanize = (s: string) => s.replace(/_/g, " ");

function row<T>(
  label: string,
  hint: string,
  claim: Claim<T> | undefined,
  format: (v: T) => { text: string; tone?: Tone },
  steps: Map<string, SetupStep>,
): FactRow {
  if (!claim) return { label, hint };
  const best = claim.best && { ...format(claim.best.value), step: steps.get(claim.best.via) };
  return { label, hint, claim: claim as Claim, ...format(claim.value), ...(best && { best }) };
}

/** The provider's facts as the four tables of its page. Missing facts stay as empty rows. */
export function factSections(f: ProviderFacts): FactSection[] {
  const steps = new Map(f.privacy_setup.map((s) => [s.id, s]));
  const p = f.privacy;
  const j = f.jurisdiction;
  const s = f.sustainability;
  const o = f.operations;
  return [
    {
      title: "Data & privacy",
      rows: [
        row("Retention", "How long prompts and outputs are kept", p.retention, (v) => ({
          text: v.days === 0 ? "Not stored" : `${v.days} days`,
          tone: v.days === 0 ? "good" : v.days <= 30 ? "warn" : "bad",
        }), steps),
        row("Zero data retention", "Whether it's available, and how", p.zero_data_retention, (v) => ({
          text: { default: "On by default", available: "Available", on_request: "On request", no: "Not available" }[v],
          tone: v === "default" ? "good" : v === "no" ? "bad" : "warn",
        }), steps),
        row("Training on your data", "Never, opt-out or opt-in", p.training, (v) => ({
          text: { never: "Never", opt_in: "Only if you opt in", opt_out: "Unless you opt out" }[v],
          tone: v === "never" ? "good" : v === "opt_in" ? "warn" : "bad",
        }), steps),
        row("Data processing agreement", "Availability and sub-processors", p.dpa, (v) => ({
          text: v.available ? (v.subprocessors_url ? "Available, sub-processors public" : "Available") : "Not available",
          tone: v.available ? "good" : "bad",
        }), steps),
      ],
    },
    {
      title: "Jurisdiction & hosting",
      rows: [
        row("Regions", "Where requests may be processed", j.regions, (v) => ({
          text: v.map((r) => `${flag(r.country)} ${r.city ?? countryName(r.country)}`).join(", "),
        }), steps),
        row("Legal entity", "The company you contract with", j.legal_entity, (v) => ({
          text: `${flag(v.country)} ${v.name}`,
        }), steps),
        row("Parent company", "Plus US CLOUD Act exposure via a US parent", j.parent_company, (v) => ({
          text: `${flag(v.country)} ${v.name}${v.us_cloud_act ? " · CLOUD Act exposure" : ""}`,
          tone: v.us_cloud_act ? "bad" : "good",
        }), steps),
        row("Certifications", "ISO 27001, SOC 2, SecNumCloud, C5, HDS…", j.certifications, (v) => ({
          text: v.length ? v.join(", ") : "None listed",
        }), steps),
      ],
    },
    {
      title: "Sustainability",
      rows: [
        row("Renewable energy", "Share, and how it's backed", s.renewable_energy, (v) => ({
          text: `${v.share}% · ${v.backing === "unknown" ? "backing not stated" : humanize(v.backing)}`,
          tone: v.share >= 90 && v.backing !== "certificates" ? "good" : v.share >= 50 ? "warn" : "bad",
        }), steps),
        row("PUE", "Data center efficiency", s.pue, (v) => ({
          text: String(v),
          tone: v <= 1.2 ? "good" : v <= 1.4 ? "warn" : "bad",
        }), steps),
        row("CO₂", "Per request or per 1M tokens, where published", s.co2, (v) => ({
          text: `${v.grams} g CO₂e per ${v.per === "request" ? "request" : "1M tokens"}`,
        }), steps),
        row("Heat reuse", "Waste heat reused, e.g. for district heating", s.heat_reuse, (v) => ({
          text: v ? "Yes" : "No",
          tone: v ? "good" : undefined,
        }), steps),
      ],
    },
    {
      title: "Operational & commercial",
      rows: [
        row("SLA", "Guaranteed uptime", o.sla, (v) => ({ text: v.uptime ? `${v.uptime}% uptime` : "No figure published" }), steps),
        {
          label: "Status page",
          hint: "Where outages are reported",
          ...(o.status_page && { text: new URL(o.status_page).host, href: o.status_page }),
        },
        row("Rate limits", "Requests or tokens per period", o.rate_limits, (v) => ({ text: v }), steps),
        row("OpenAI-compatible API", "Drop-in for OpenAI clients", o.openai_compatible, (v) => ({
          text: v ? "Yes" : "No",
          tone: v ? "good" : undefined,
        }), steps),
        row("Batch discount", "Cheaper asynchronous processing", o.batch, (v) => ({ text: `−${v.discount_percent}%` }), steps),
        row("Billing", "Invoice currency, billing entity, minimum commitment", o.billing, (v) => ({
          text: [v.currency, v.entity, v.minimum_commitment].filter(Boolean).join(" · "),
        }), steps),
      ],
    },
  ];
}

/** Count of claims and setup steps, and of those checked too long ago. */
export function claimStats(f: ProviderFacts, now = new Date()): { total: number; stale: number } {
  const checked = [
    ...factSections(f).flatMap((s) => s.rows.flatMap((r) => (r.claim ? [r.claim.checked] : []))),
    ...f.privacy_setup.map((s) => s.checked),
  ];
  return { total: checked.length, stale: checked.filter((c) => isStale(c, now)).length };
}

export const ACCESS_LABEL: Record<SetupStep["access"], string> = {
  self_serve: "Self-serve",
  on_request: "On request",
  enterprise: "Enterprise",
};
