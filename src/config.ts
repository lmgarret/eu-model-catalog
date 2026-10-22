import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { CURRENCIES, HardError, MODES, UNITS, decimalString, isoDate } from "./model.js";

export const PROVIDER_KEYS = ["greenpt", "regolo", "infomaniak", "mistral"] as const;
export type ProviderKey = (typeof PROVIDER_KEYS)[number];

const providerConfigSchema = z
  .object({
    /** Provider name as configured in Bifrost. Bifrost matches the datasheet entry's `provider` field against it. */
    bifrost_provider: z.string().min(1),
    models_dev_id: z.string().min(1),
    /** Pinned invoice currency. An API returning another currency fails the build. */
    currency: z.enum(CURRENCIES).optional(),
    /** Infomaniak only: its API returns a numeric `currency_id`. */
    currency_ids: z.record(z.string(), z.enum(CURRENCIES)).optional(),
  })
  .strict();
export type ProviderConfig = z.infer<typeof providerConfigSchema>;

export const providersFileSchema = z.object(
  Object.fromEntries(PROVIDER_KEYS.map((k) => [k, providerConfigSchema])) as Record<
    ProviderKey,
    typeof providerConfigSchema
  >,
);
export type ProvidersConfig = z.infer<typeof providersFileSchema>;

/** YAML numbers arrive as JS numbers; keep them as decimal strings from here on. */
const amount = z.union([z.number().nonnegative(), decimalString]).transform((v) => String(v));

export const overlayEntrySchema = z
  .object({
    currency: z.enum(CURRENCIES),
    per: z.enum(UNITS),
    input: amount.optional(),
    cached_input: amount.optional(),
    output: amount.optional(),
    mode: z.enum(MODES).optional(),
    max_input_tokens: z.number().int().positive().optional(),
    max_output_tokens: z.number().int().positive().optional(),
    deprecation_date: isoDate.optional(),
    source: z.url(),
    checked: isoDate,
  })
  .strict();
export type OverlayEntry = z.infer<typeof overlayEntrySchema>;

/** An empty file parses to null: treat it as no entries. */
export const overlayFileSchema = z
  .record(z.string(), overlayEntrySchema)
  .nullable()
  .transform((v) => v ?? {});
export type Overlay = Partial<Record<ProviderKey, Record<string, OverlayEntry>>>;

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

/** Loads `overlay/<provider>.yaml`. Files for unknown providers fail the build. */
export async function loadOverlay(dir: string): Promise<Overlay> {
  const overlay: Overlay = {};
  for (const name of (await readdir(dir)).sort()) {
    if (!/\.ya?ml$/.test(name)) continue;
    const provider = name.replace(/\.ya?ml$/, "");
    if (!(PROVIDER_KEYS as readonly string[]).includes(provider)) {
      throw new HardError(`overlay/${name}: unknown provider "${provider}" (expected one of ${PROVIDER_KEYS.join(", ")})`);
    }
    const file = path.join(dir, name);
    overlay[provider as ProviderKey] = parseOverlay(file, await readFile(file, "utf8"));
  }
  return overlay;
}
