import { Decimal } from "decimal.js";
import { z } from "zod";
import { type Currency, HardError, type Mode, type ModelRecord, type Unit } from "../../model.js";
import { type ProviderApi, checkCurrency, positiveInt, priceOf } from "./types.js";

// Shape taken from Infomaniak's OpenAPI spec (AiModel / AIPrice), not yet from a real response.
const priceSchema = z.object({
  label: z.string().optional(),
  model: z.string().optional(),
  input_amount_excl_vat: z.number().nullish(),
  output_amount_excl_vat: z.number().nullish(),
  amount_excl_vat: z.number().nullish(),
  currency_id: z.number().int(),
  unit: z.object({ type: z.string(), amount: z.number().int().positive() }),
});

const responseSchema = z.object({
  result: z.literal("success"),
  data: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      max_token_input: z.number().nullish(),
      prices: z.array(priceSchema).optional(),
    }),
  ),
});

function modeOf(type: string): Mode | undefined {
  const t = type.toLowerCase();
  if (t.includes("embed")) return "embedding";
  if (t.includes("rerank")) return "rerank";
  if (t.includes("stt") || t.includes("transcri") || t.includes("whisper")) return "audio_transcription";
  if (t.includes("tts") || t.includes("speech")) return "audio_speech";
  if (t.includes("image")) return "image_generation";
  if (t.includes("llm") || t.includes("chat") || t.includes("text")) return "chat";
  return undefined;
}

/**
 * Prices are quoted per N tokens or per N minutes, with N varying by model (e.g. 10000 tokens).
 * Rescale to per 1M tokens or per minute, with exact decimal math.
 */
function normalizeUnit(type: string, per: number): { unit: Unit; scale: (amount: number | null | undefined) => string | undefined } {
  const rescale = (factor: Decimal) => (amount: number | null | undefined) => {
    const value = priceOf(amount);
    return value === undefined ? undefined : new Decimal(value).mul(factor).toString();
  };
  if (type === "tokens") return { unit: "1M_tokens", scale: rescale(new Decimal(1_000_000).div(per)) };
  if (type === "minute") return { unit: "minute", scale: rescale(new Decimal(1).div(per)) };
  throw new Error(`unsupported Infomaniak price unit: ${per} ${type}`);
}

/**
 * Infomaniak lists models with prices when asked `with=pricing`. Prices carry a numeric
 * `currency_id`, mapped to a code by `currency_ids` in providers.yaml.
 */
export const infomaniak: ProviderApi = {
  provider: "infomaniak",
  url: "https://api.infomaniak.com/1/ai/models?with=pricing",
  hasPrices: true,
  auth: { env: "INFOMANIAK_TOKEN", required: true },
  parse(raw, { config, fetchedAt }) {
    const records: ModelRecord[] = [];
    for (const m of responseSchema.parse(raw).data) {
      const price = m.prices?.[0];
      let currency: Currency = config.currency ?? "CHF";
      let unit: Unit = "1M_tokens";
      let prices: ModelRecord["prices"] = {};
      if (price) {
        const mapped = config.currency_ids?.[String(price.currency_id)];
        if (!mapped) {
          throw new HardError(
            `infomaniak API returned unknown currency_id ${price.currency_id}; map it in providers.yaml (infomaniak.currency_ids)`,
          );
        }
        checkCurrency("infomaniak", mapped, config);
        currency = mapped;
        const normalized = normalizeUnit(price.unit.type, price.unit.amount);
        unit = normalized.unit;
        prices = {
          input: normalized.scale(price.input_amount_excl_vat ?? price.amount_excl_vat),
          output: normalized.scale(price.output_amount_excl_vat),
        };
      }
      records.push({
        provider: "infomaniak",
        model: m.name,
        source: "api",
        currency,
        unit,
        prices,
        limits: { max_input_tokens: positiveInt(m.max_token_input) },
        mode: modeOf(m.type),
        source_url: "https://api.infomaniak.com/1/ai/models",
        fetched_at: fetchedAt,
      });
    }
    return records;
  },
};
