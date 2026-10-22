import { z } from "zod";

/** Where a value came from, in increasing precedence. */
export const SOURCES = ["bifrost", "models.dev", "api", "overlay"] as const;
export type SourceKind = (typeof SOURCES)[number];

export const CURRENCIES = ["USD", "EUR", "CHF"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** The unit a price is quoted in. Token units are scaled to per-token; time units to per-second. */
export const UNITS = ["1M_tokens", "1K_tokens", "token", "page", "second", "minute", "hour", "character"] as const;
export type Unit = (typeof UNITS)[number];

export const PRICE_KEYS = ["input", "cached_input", "output"] as const;
export type PriceKey = (typeof PRICE_KEYS)[number];

/** Bifrost `mode` values we emit. */
export const MODES = [
  "chat",
  "embedding",
  "rerank",
  "ocr",
  "audio_transcription",
  "audio_speech",
  "image_generation",
] as const;
export type Mode = (typeof MODES)[number];

/** A decimal amount kept as a string so no float math happens on it. */
export const decimalString = z.string().regex(/^\d+(\.\d+)?(e-?\d+)?$/i, "not a non-negative decimal");

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

/** Model facts other than prices and limits: origin, license, lifecycle and features. */
export const modelInfoSchema = z
  .object({
    name: z.string(),
    family: z.string(),
    /** `<lab>/<model>`, as models.dev names the original of a rebranded or hosted model. */
    canonical_id: z.string(),
    /** Key in labs/. */
    lab: z.string(),
    license: z.string(),
    open_weights: z.boolean(),
    /** YYYY-MM or YYYY-MM-DD. */
    knowledge_cutoff: z.string(),
    release_date: z.string(),
    reasoning: z.boolean(),
    tool_call: z.boolean(),
    structured_output: z.boolean(),
    input_modalities: z.array(z.string()),
    output_modalities: z.array(z.string()),
  })
  .partial();
export type ModelInfo = z.infer<typeof modelInfoSchema>;
export const INFO_KEYS = Object.keys(modelInfoSchema.shape) as (keyof ModelInfo)[];

/** The common record every source module maps its response to. */
export const modelRecordSchema = z.object({
  provider: z.string(),
  model: z.string(),
  source: z.enum(SOURCES),
  currency: z.enum(CURRENCIES),
  unit: z.enum(UNITS),
  prices: z.partialRecord(z.enum(PRICE_KEYS), decimalString),
  limits: z.object({
    max_input_tokens: z.number().int().positive().optional(),
    max_output_tokens: z.number().int().positive().optional(),
  }),
  mode: z.enum(MODES).optional(),
  /** Billed on input only (e.g. decision models), so a missing output price is expected. */
  input_only: z.boolean().optional(),
  deprecation_date: isoDate.optional(),
  info: modelInfoSchema.optional(),
  source_url: z.string().optional(),
  /** ISO timestamp for fetched sources, the `checked` date for the overlay. */
  fetched_at: z.string(),
  stale_since: z.string().optional(),
});
export type ModelRecord = z.infer<typeof modelRecordSchema>;

/** A build-stopping error: bad overlay, unexpected currency, invalid output. */
export class HardError extends Error {
  override name = "HardError";
}
