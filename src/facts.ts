import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { CURRENCIES, HardError, isoDate } from "./model.js";

/** A fact as someone claims it, usually the provider itself. Every claim has a source and a check date. */
export const claim = <T extends z.ZodType>(value: T) =>
  z
    .object({
      value,
      source: z.url(),
      checked: isoDate,
      note: z.string().optional(),
    })
    .strict();

/**
 * A privacy claim that a setup step can improve: `value` is the default, `best.value` what you get
 * after the step `best.via` from `privacy_setup`.
 */
const improvable = <T extends z.ZodType>(value: T) =>
  claim(value).extend({ best: z.object({ value, via: z.string() }).strict().optional() });

/** Facts checked longer ago than this are flagged as stale, on the site and as build warnings. */
export const STALE_AFTER_MONTHS = 6;

const country = z.string().regex(/^[A-Z]{2}$/, "expected an ISO 3166-1 alpha-2 country code");
const color = z.string().regex(/^#[0-9a-f]{6}$/i, "expected a #rrggbb color");

export const ZDR = ["default", "available", "on_request", "no"] as const;
export const TRAINING = ["never", "opt_in", "opt_out"] as const;
export const AI_ACT = ["signatory", "partial", "not_signatory"] as const;
export const ENERGY_BACKING = ["own_generation", "ppa", "mixed", "certificates", "unknown"] as const;
/** Only self-serve steps count toward the max-privacy score. */
export const SETUP_ACCESS = ["self_serve", "on_request", "enterprise"] as const;

/** One step of a provider's maximum-privacy setup guide. */
const setupStepSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+$/, "expected snake_case"),
    title: z.string(),
    how: z.string(),
    access: z.enum(SETUP_ACCESS),
    /** Price premium or plan needed, if any. */
    cost: z.string().optional(),
    source: z.url(),
    checked: isoDate,
  })
  .strict();
export type SetupStep = z.infer<typeof setupStepSchema>;

export const providerFactsSchema = z
  .object({
    name: z.string(),
    website: z.url(),
    /** File name in site/public/logos, without extension. */
    logo: z.string().optional(),
    color: color.optional(),
    privacy: z
      .object({
        /** How long prompts and outputs are kept. 0 means not stored. */
        retention: improvable(z.object({ days: z.number().nonnegative() }).strict()).optional(),
        zero_data_retention: improvable(z.enum(ZDR)).optional(),
        training: improvable(z.enum(TRAINING)).optional(),
        dpa: claim(z.object({ available: z.boolean(), subprocessors_url: z.url().optional() }).strict()).optional(),
      })
      .strict()
      .default({}),
    jurisdiction: z
      .object({
        /** Where requests may be processed by default; `best` with the strictest setup. */
        regions: improvable(z.array(z.object({ country, city: z.string().optional() }).strict()).min(1)).optional(),
        legal_entity: claim(z.object({ name: z.string(), country }).strict()).optional(),
        /** `us_cloud_act`: exposed to the US CLOUD Act through a US parent. */
        parent_company: claim(z.object({ name: z.string(), country, us_cloud_act: z.boolean() }).strict()).optional(),
        certifications: claim(z.array(z.string())).optional(),
      })
      .strict()
      .default({}),
    sustainability: z
      .object({
        renewable_energy: claim(
          z.object({ share: z.number().min(0).max(100), backing: z.enum(ENERGY_BACKING) }).strict(),
        ).optional(),
        pue: claim(z.number().min(1)).optional(),
        co2: claim(z.object({ grams: z.number().nonnegative(), per: z.enum(["request", "1M_tokens"]) }).strict()).optional(),
        heat_reuse: claim(z.boolean()).optional(),
      })
      .strict()
      .default({}),
    operations: z
      .object({
        sla: claim(z.object({ uptime: z.number().min(0).max(100).optional() }).strict()).optional(),
        status_page: z.url().optional(),
        rate_limits: claim(z.string()).optional(),
        openai_compatible: claim(z.boolean()).optional(),
        batch: claim(z.object({ discount_percent: z.number().min(0).max(100) }).strict()).optional(),
        billing: claim(
          z
            .object({
              currency: z.enum(CURRENCIES),
              entity: z.string().optional(),
              minimum_commitment: z.string().optional(),
            })
            .strict(),
        ).optional(),
      })
      .strict()
      .default({}),
    /** Steps to reach the provider's maximum privacy, in order. */
    privacy_setup: z.array(setupStepSchema).default([]),
  })
  .strict()
  .superRefine((f, ctx) => {
    const steps = new Set(f.privacy_setup.map((s) => s.id));
    const bests = [
      ["privacy", "retention", f.privacy.retention?.best],
      ["privacy", "zero_data_retention", f.privacy.zero_data_retention?.best],
      ["privacy", "training", f.privacy.training?.best],
      ["jurisdiction", "regions", f.jurisdiction.regions?.best],
    ] as const;
    for (const [section, key, best] of bests) {
      if (best && !steps.has(best.via)) {
        ctx.addIssue({ code: "custom", path: [section, key, "best", "via"], message: `no privacy_setup step "${best.via}"` });
      }
    }
  });
export type ProviderFacts = z.infer<typeof providerFactsSchema>;
export type ProvidersFacts = Record<string, ProviderFacts>;

/** A model as its lab publishes it. Keyed by the lab's own model slug, e.g. `qwen3.5-122b-a10b`. */
export const labModelSchema = z
  .object({
    name: z.string(),
    license: z.string().optional(),
    open_weights: z.boolean().optional(),
    /** Hugging Face repo, `<org>/<name>`. Its license is checked against `license` at build time. */
    hf: z.string().regex(/^[\w.-]+\/[\w.-]+$/).optional(),
    /** Other ids the lab serves it under, e.g. `mistral-small-latest`. */
    aliases: z.array(z.string()).default([]),
    release_date: z.string().optional(),
    knowledge_cutoff: z.string().optional(),
    /** The model's exact name in Epoch AI's Capabilities Index (`Model` column), for its benchmark scores. */
    epoch: z.string().optional(),
    /** The model's exact name on LMArena's text leaderboard, for its coding rating. */
    lmarena: z.string().optional(),
    source: z.url(),
    checked: isoDate,
    note: z.string().optional(),
  })
  .strict();
export type LabModel = z.infer<typeof labModelSchema>;

/** An AI lab: who develops the models. `labs/<lab>.yaml`; the key matches models.dev where it has one. */
export const labSchema = z
  .object({
    name: z.string(),
    country,
    website: z.url(),
    logo: z.string().optional(),
    color: color.optional(),
    /** Other prefixes meaning this lab in model ids: Hugging Face orgs, models.dev ids. */
    aliases: z.array(z.string()).default([]),
    /** Status under the EU GPAI Code of Practice. */
    eu_ai_act: claim(z.enum(AI_ACT)).optional(),
    models: z.record(z.string(), labModelSchema).default({}),
  })
  .strict();
export type Lab = z.infer<typeof labSchema>;
export type Labs = Record<string, Lab>;

function formatIssues(error: z.ZodError): string {
  return error.issues.map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
}

function parseWith<T extends z.ZodType>(schema: T, file: string, text: string): z.infer<T> {
  const result = schema.safeParse(parse(text));
  if (!result.success) throw new HardError(`${file} is invalid:\n${formatIssues(result.error)}`);
  return result.data;
}

export const parseProviderFacts = (file: string, text: string) => parseWith(providerFactsSchema, file, text);
export const parseLab = (file: string, text: string) => parseWith(labSchema, file, text);

async function readYamlDir(dir: string): Promise<[string, string][]> {
  const out: [string, string][] = [];
  for (const file of (await readdir(dir)).sort()) {
    if (/\.ya?ml$/.test(file)) out.push([file.replace(/\.ya?ml$/, ""), await readFile(path.join(dir, file), "utf8")]);
  }
  return out;
}

/** Loads `providers/<provider>.yaml`. Files for providers missing from providers.yaml fail the build. */
export async function loadProviderFacts(dir: string, providers: readonly string[]): Promise<ProvidersFacts> {
  const facts: ProvidersFacts = {};
  for (const [name, text] of await readYamlDir(dir)) {
    if (!providers.includes(name)) {
      throw new HardError(`providers/${name}.yaml: unknown provider "${name}" (expected one of ${providers.join(", ")})`);
    }
    facts[name] = parseProviderFacts(path.join(dir, `${name}.yaml`), text);
  }
  return facts;
}

/** Loads `labs/<lab>.yaml`. Lab keys and aliases must be unique, case-insensitively. */
export async function loadLabs(dir: string): Promise<Labs> {
  const labs: Labs = {};
  const seen = new Map<string, string>();
  for (const [name, text] of await readYamlDir(dir)) {
    const lab = parseLab(path.join(dir, `${name}.yaml`), text);
    for (const id of [name, ...lab.aliases].map((a) => a.toLowerCase())) {
      const other = seen.get(id);
      if (other) throw new HardError(`labs/${name}.yaml: "${id}" is already used by labs/${other}.yaml`);
      seen.set(id, name);
    }
    labs[name] = lab;
  }
  return labs;
}

/** True when `checked` is more than STALE_AFTER_MONTHS before `today` (both YYYY-MM-DD). */
export function isStale(checked: string, today: string): boolean {
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCMonth(limit.getUTCMonth() - STALE_AFTER_MONTHS);
  return new Date(`${checked}T00:00:00Z`) < limit;
}

/** Every claim and setup step in a provider's facts, with its dotted path, e.g. `privacy.retention`. */
export function claimsOf(facts: ProviderFacts): { path: string; checked: string; source: string }[] {
  const out: { path: string; checked: string; source: string }[] = [];
  for (const section of ["privacy", "jurisdiction", "sustainability", "operations"] as const) {
    for (const [name, c] of Object.entries(facts[section])) {
      if (c && typeof c === "object" && "checked" in c) out.push({ path: `${section}.${name}`, checked: c.checked, source: c.source });
    }
  }
  for (const s of facts.privacy_setup) out.push({ path: `privacy_setup.${s.id}`, checked: s.checked, source: s.source });
  return out;
}
