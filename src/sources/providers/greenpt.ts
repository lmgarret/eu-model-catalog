import { z } from "zod";
import type { Mode, ModelRecord } from "../../model.js";
import { type ProviderApi, checkCurrency, positiveInt, priceOf } from "./types.js";

const responseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      contextWindowTokens: z.number().nullish(),
      maxOutputTokens: z.number().nullish(),
      pricing: z
        .object({
          promptToken: z.number().nullish(),
          completionToken: z.number().nullish(),
          cachedPromptToken: z.number().nullish(),
          /** Pre-recorded audio. Despite the name, docs.greenpt.ai quotes this rate per hour. */
          listenSecond: z.number().nullish(),
        })
        .loose(),
    }),
  ),
});

const MODE_BY_TYPE: Record<string, Mode> = {
  LLM: "chat",
  EMBEDDINGS: "embedding",
  RERANK: "rerank",
  STT: "audio_transcription",
  DECISION: "chat",
};

/**
 * GreenPT has no currency field: every price is in EUR (https://docs.greenpt.ai/docs/pricing).
 * Token prices are per 1M tokens, speech-to-text per hour of audio.
 */
export const greenpt: ProviderApi = {
  provider: "greenpt",
  url: "https://api.greenpt.ai/v1/pricing",
  hasPrices: true,
  parse(raw, { config, fetchedAt }) {
    checkCurrency("greenpt", "EUR", config);
    return responseSchema.parse(raw).data.map((m): ModelRecord => {
      const mode = MODE_BY_TYPE[m.type];
      const base = {
        provider: "greenpt",
        model: m.id,
        source: "api" as const,
        currency: "EUR" as const,
        limits: {
          max_input_tokens: positiveInt(m.contextWindowTokens),
          max_output_tokens: positiveInt(m.maxOutputTokens),
        },
        mode,
        source_url: greenpt.url,
        fetched_at: fetchedAt,
      };
      if (mode === "audio_transcription") {
        return { ...base, unit: "hour", prices: { input: priceOf(m.pricing.listenSecond) } };
      }
      return {
        ...base,
        unit: "1M_tokens",
        prices: {
          input: priceOf(m.pricing.promptToken),
          cached_input: priceOf(m.pricing.cachedPromptToken),
          output: priceOf(m.pricing.completionToken),
        },
      };
    });
  },
};
