import { z } from "zod";
import { fieldsSchema, scoresSchema } from "./benchmarks.js";
import { labModelSchema, labSchema, providerFactsSchema } from "./facts.js";
import { CURRENCIES, MODES, SOURCES, UNITS, isoDate, type ModelInfo, modelRecordSchema } from "./model.js";
import { BIFROST_PRICE_FIELDS } from "./money.js";
import { WARNING_CODES } from "./warnings.js";

/** One fetched input other than the Bifrost base, with its records so the next build can fall back to them. */
export const sourceStateSchema = z.object({
  id: z.string(),
  kind: z.enum(["models.dev", "api"]),
  provider: z.string().optional(),
  status: z.enum(["ok", "stale", "skipped", "failed"]),
  fetched_at: z.string().optional(),
  stale_since: z.string().optional(),
  error: z.string().optional(),
  records: z.array(modelRecordSchema),
});
export type SourceState = z.infer<typeof sourceStateSchema>;

const provenance = {
  source: z.enum(SOURCES),
  /** `fetched_at` for fetched sources, `checked` for the overlay. */
  at: z.string(),
  stale_since: z.string().optional(),
};

const field = <T extends z.ZodType>(value: T) => z.object({ value, ...provenance });

const priceSchema = z.object({
  usd_per_unit: z.number().nonnegative(),
  original: z.object({ amount: z.string(), currency: z.enum(CURRENCIES), per: z.enum(UNITS) }),
  source_url: z.string().optional(),
  ...provenance,
});
export type CatalogPrice = z.infer<typeof priceSchema>;

/** Model facts come from the price sources and from labs/, which ranks just below the overlay. */
export const INFO_SOURCES = ["bifrost", "models.dev", "api", "labs", "overlay"] as const;

const infoField = <T extends z.ZodType>(value: T) =>
  z.object({ value, source: z.enum(INFO_SOURCES), at: z.string(), url: z.string().optional() });

const str = infoField(z.string()).optional();
const bool = infoField(z.boolean()).optional();
const list = infoField(z.array(z.string())).optional();

export const catalogInfoSchema = z.object({
  name: str,
  family: str,
  canonical_id: str,
  lab: str,
  license: str,
  open_weights: bool,
  knowledge_cutoff: str,
  release_date: str,
  reasoning: bool,
  tool_call: bool,
  structured_output: bool,
  input_modalities: list,
  output_modalities: list,
} satisfies Record<keyof ModelInfo, z.ZodType>);
export type CatalogInfo = z.infer<typeof catalogInfoSchema>;

export const catalogModelSchema = z.object({
  provider: z.string(),
  bifrost_provider: z.string(),
  model: z.string(),
  /** Key in pricing.json, or null when no source prices the model. */
  pricing_key: z.string().nullable(),
  /** `<bifrost_provider>/<model>`, the model id requests to Bifrost use. */
  bifrost_id: z.string().default(""),
  /** `<lab>/<slug>`: the same canonical id means the same model on another host. Null when unattributed. */
  canonical_id: z.string().nullable().default(null),
  mode: field(z.enum(MODES)).optional(),
  prices: z.partialRecord(z.enum(BIFROST_PRICE_FIELDS), priceSchema),
  limits: z.object({
    max_input_tokens: field(z.number().int().positive()).optional(),
    max_output_tokens: field(z.number().int().positive()).optional(),
  }),
  deprecation_date: field(isoDate).optional(),
  /** Optional so catalogs from before model facts still parse as the previous catalog. */
  info: catalogInfoSchema.default({}),
  /** Open-ended, for benchmarks and other future data. */
  extra: z.record(z.string(), z.unknown()),
});
export type CatalogModel = z.infer<typeof catalogModelSchema>;

export const catalogSchema = z.object({
  schema_version: z.literal(1),
  built_at: z.string(),
  exchange_rates: z.object({
    date: isoDate,
    base: z.literal("EUR"),
    rates: z.object({ USD: z.string(), CHF: z.string() }),
    source: z.string(),
  }),
  providers: z.record(
    z.string(),
    z.object({
      bifrost_provider: z.string(),
      models_dev_id: z.string(),
      currency: z.enum(CURRENCIES).optional(),
      /** providers/<provider>.yaml. Optional so older catalogs still parse. */
      facts: providerFactsSchema.optional(),
    }),
  ),
  labs: z
    .record(
      z.string(),
      labSchema.omit({ aliases: true, models: true }).extend({
        models: z.record(
          z.string(),
          labModelSchema.omit({ aliases: true, epoch: true, lmarena: true }).extend({
            /** Set when the license comes from the Hugging Face model card. */
            license_url: z.string().optional(),
            /** Benchmark scores; each names the model as its source does. */
            scores: scoresSchema.optional(),
          }),
        ),
      }),
    )
    .default({}),
  /** Every model each benchmark's source rates. Scores per model are on `labs.<lab>.models.<slug>.scores`. */
  benchmarks: fieldsSchema.default({}),
  warnings: z.array(
    z.object({
      code: z.enum(WARNING_CODES),
      message: z.string(),
      provider: z.string().optional(),
      model: z.string().optional(),
      details: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
  sources: z.array(sourceStateSchema),
  models: z.array(catalogModelSchema),
});
export type Catalog = z.infer<typeof catalogSchema>;

/** Checks the fields Bifrost reads; everything else in an entry passes through. */
export const pricingSchema = z.record(
  z.string(),
  z
    .object({
      provider: z.string().optional(),
      mode: z.string().optional(),
      ...Object.fromEntries(BIFROST_PRICE_FIELDS.map((f) => [f, z.number().nonnegative().nullish()])),
      max_input_tokens: z.number().nullish(),
      max_output_tokens: z.number().nullish(),
    })
    .loose(),
);
export type Pricing = Record<string, Record<string, unknown>>;
