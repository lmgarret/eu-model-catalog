import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { CURRENCIES, HardError, MODES, UNITS, decimalString, isoDate, modelInfoSchema } from "./model.js";

const providerConfigSchema = z
  .object({
    /** Provider name as configured in Bifrost. Bifrost matches the datasheet entry's `provider` field against it. */
    bifrost_provider: z.string().min(1),
    models_dev_id: z.string().min(1),
    /** Pinned invoice currency. An API returning another currency fails the build. */
    currency: z.enum(CURRENCIES).optional(),
    /** Infomaniak only: its API returns a numeric `currency_id`. */
    currency_ids: z.record(z.string(), z.enum(CURRENCIES)).optional(),
    /** Set when the provider is also the lab behind its models: a key in labs/. */
    lab: z.string().optional(),
  })
  .strict();
export type ProviderConfig = z.infer<typeof providerConfigSchema>;

/** Each key is a provider; overlay/, providers/ and the provider API modules use the same keys. */
export const providersFileSchema = z.record(z.string().regex(/^[a-z0-9-]+$/), providerConfigSchema);
export type ProvidersConfig = z.infer<typeof providersFileSchema>;

/** YAML numbers arrive as JS numbers; keep them as decimal strings from here on. */
const amount = z.union([z.number().nonnegative(), decimalString]).transform((v) => String(v));

export const overlayEntrySchema = z
  .object({
    currency: z.enum(CURRENCIES).optional(),
    per: z.enum(UNITS).optional(),
    input: amount.optional(),
    cached_input: amount.optional(),
    output: amount.optional(),
    mode: z.enum(MODES).optional(),
    max_input_tokens: z.number().int().positive().optional(),
    max_output_tokens: z.number().int().positive().optional(),
    deprecation_date: isoDate.optional(),
    /** `<lab>/<model>`, for models no other source maps to their lab's model. */
    canonical: z.string().regex(/^[\w.-]+\/[\w.-]+$/).optional(),
    // Model facts. These override models.dev and labs/.
    ...modelInfoSchema.omit({ name: true, family: true, canonical_id: true, lab: true }).shape,
    source: z.url(),
    checked: isoDate,
  })
  .strict()
  .refine((e) => (e.input ?? e.cached_input ?? e.output) === undefined || (e.currency && e.per), {
    message: "prices need `currency` and `per`",
  });
export type OverlayEntry = z.infer<typeof overlayEntrySchema>;

/** An empty file parses to null: treat it as no entries. */
export const overlayFileSchema = z
  .record(z.string(), overlayEntrySchema)
  .nullable()
  .transform((v) => v ?? {});
export type Overlay = Record<string, Record<string, OverlayEntry>>;

function formatIssues(error: z.ZodError): string {
  return error.issues.map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
}

export async function loadProviders(file: string): Promise<ProvidersConfig> {
  const result = providersFileSchema.safeParse(parse(await readFile(file, "utf8")));
  if (!result.success) throw new HardError(`${file} is invalid:\n${formatIssues(result.error)}`);
  return result.data;
}

export function parseOverlay(file: string, text: string): Record<string, OverlayEntry> {
  const result = overlayFileSchema.safeParse(parse(text));
  if (!result.success) throw new HardError(`${file} is invalid:\n${formatIssues(result.error)}`);
  return result.data;
}

/** Loads `overlay/<provider>.yaml`. Files for providers missing from providers.yaml fail the build. */
export async function loadOverlay(dir: string, providers: readonly string[]): Promise<Overlay> {
  const overlay: Overlay = {};
  for (const name of (await readdir(dir)).sort()) {
    if (!/\.ya?ml$/.test(name)) continue;
    const provider = name.replace(/\.ya?ml$/, "");
    if (!providers.includes(provider)) {
      throw new HardError(`overlay/${name}: unknown provider "${provider}" (expected one of ${providers.join(", ")})`);
    }
    const file = path.join(dir, name);
    overlay[provider] = parseOverlay(file, await readFile(file, "utf8"));
  }
  return overlay;
}
