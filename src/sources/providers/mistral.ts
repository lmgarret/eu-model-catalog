import { z } from "zod";
import type { ModelRecord } from "../../model.js";
import { type ProviderApi, positiveInt } from "./types.js";

const responseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      max_context_length: z.number().nullish(),
      // Mistral calls it `deprecation` (an ISO timestamp); accept `deprecation_date` too.
      deprecation: z.string().nullish(),
      deprecation_date: z.string().nullish(),
    }),
  ),
});

/**
 * Mistral's model list has no prices. It supplies the deprecation date, context length and
 * the "still listed" check; prices come from the Bifrost datasheet, models.dev or the overlay.
 */
export const mistral: ProviderApi = {
  provider: "mistral",
  url: "https://api.mistral.ai/v1/models",
  hasPrices: false,
  auth: { env: "MISTRAL_API_KEY", required: true },
  parse(raw, { config, fetchedAt }) {
    return responseSchema.parse(raw).data.map(
      (m): ModelRecord => ({
        provider: "mistral",
        model: m.id,
        source: "api",
        currency: config.currency ?? "EUR",
        unit: "1M_tokens",
        prices: {},
        limits: { max_input_tokens: positiveInt(m.max_context_length) },
        deprecation_date: (m.deprecation ?? m.deprecation_date)?.slice(0, 10),
        source_url: mistral.url,
        fetched_at: fetchedAt,
      }),
    );
  },
};
