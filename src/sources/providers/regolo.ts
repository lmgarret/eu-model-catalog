import { z } from "zod";
import type { Mode, ModelRecord } from "../../model.js";
import { type ProviderApi, checkCurrency, positiveInt, priceOf } from "./types.js";

const responseSchema = z.object({
  data: z.array(
    z.object({
      model_group: z.string(),
      mode: z.string().nullish(),
      input_cost_per_token: z.number().nullish(),
      output_cost_per_token: z.number().nullish(),
      ocr_cost_per_page: z.number().nullish(),
      input_cost_per_second: z.number().nullish(),
      max_input_tokens: z.number().nullish(),
      max_output_tokens: z.number().nullish(),
    }),
  ),
});

const MODE_BY_MODE: Record<string, Mode> = {
  chat: "chat",
  decision: "chat",
  embedding: "embedding",
  rerank: "rerank",
  ocr: "ocr",
  audio_transcription: "audio_transcription",
  audio_speech: "audio_speech",
  image_generation: "image_generation",
};

/**
 * Regolo serves a LiteLLM-style model_group listing priced per token (or page / second).
 * It has no currency field; Regolo bills in EUR.
 */
export const regolo: ProviderApi = {
  provider: "regolo",
  url: "https://api.regolo.ai/model_group/info",
  hasPrices: true,
  // Unauthenticated today, though the docs say a key is required.
  auth: { env: "REGOLO_API_KEY", required: false },
  parse(raw, { config, fetchedAt }) {
    checkCurrency("regolo", "EUR", config);
    return responseSchema.parse(raw).data.map((m): ModelRecord => {
      const base = {
        provider: "regolo",
        model: m.model_group,
        source: "api" as const,
        currency: "EUR" as const,
        limits: {
          max_input_tokens: positiveInt(m.max_input_tokens),
          max_output_tokens: positiveInt(m.max_output_tokens),
        },
        mode: m.mode ? MODE_BY_MODE[m.mode] : undefined,
        source_url: regolo.url,
        fetched_at: fetchedAt,
      };
      if (m.ocr_cost_per_page) return { ...base, unit: "page", prices: { input: priceOf(m.ocr_cost_per_page) } };
      if (m.input_cost_per_second) {
        return { ...base, unit: "second", prices: { input: priceOf(m.input_cost_per_second) } };
      }
      return {
        ...base,
        unit: "token",
        prices: { input: priceOf(m.input_cost_per_token), output: priceOf(m.output_cost_per_token) },
      };
    });
  },
};
