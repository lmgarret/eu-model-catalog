import { z } from "zod";
import type { ProviderKey, ProvidersConfig } from "../config.js";
import type { Mode, ModelRecord } from "../model.js";
import { positiveInt, priceOf } from "./providers/types.js";

export const MODELS_DEV_URL = "https://models.dev/api.json";

const modelSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  cost: z
    .object({ input: z.number().nullish(), output: z.number().nullish(), cache_read: z.number().nullish() })
    .optional(),
  limit: z.object({ context: z.number().nullish(), input: z.number().nullish(), output: z.number().nullish() }).optional(),
});

const providerSchema = z.object({ models: z.record(z.string(), modelSchema) });

const MODE_BY_TYPE: Record<string, Mode> = {
  embedding: "embedding",
  reranking: "rerank",
  transcription: "audio_transcription",
  speech: "audio_speech",
  image: "image_generation",
};

/**
 * Maps models.dev entries (USD per 1M tokens) for our providers to common records.
 * Only our providers are validated, so unrelated changes elsewhere in api.json can't break the build.
 * A cost of 0 is dropped here and reported as missing by the merge.
 */
export function parseModelsDev(raw: unknown, providers: ProvidersConfig, fetchedAt: string): ModelRecord[] {
  const root = z.record(z.string(), z.unknown()).parse(raw);
  const records: ModelRecord[] = [];
  for (const [provider, config] of Object.entries(providers) as [ProviderKey, ProvidersConfig[ProviderKey]][]) {
    const entry = root[config.models_dev_id];
    if (entry === undefined) continue;
    for (const m of Object.values(providerSchema.parse(entry).models)) {
      records.push({
        provider,
        model: m.id,
        source: "models.dev",
        currency: "USD",
        unit: "1M_tokens",
        prices: {
          input: priceOf(m.cost?.input),
          cached_input: priceOf(m.cost?.cache_read),
          output: priceOf(m.cost?.output),
        },
        limits: {
          max_input_tokens: positiveInt(m.limit?.input ?? m.limit?.context),
          max_output_tokens: positiveInt(m.limit?.output),
        },
        mode: m.type ? MODE_BY_TYPE[m.type] : "chat",
        source_url: `https://models.dev/?search=${encodeURIComponent(config.models_dev_id)}`,
        fetched_at: fetchedAt,
      });
    }
  }
  return records;
}
