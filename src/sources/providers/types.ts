import type { ProviderConfig, ProviderKey } from "../../config.js";
import { type Currency, HardError, type ModelRecord } from "../../model.js";

export interface ParseContext {
  config: ProviderConfig;
  fetchedAt: string;
}

/** A provider's pricing or model-listing API. */
export interface ProviderApi {
  provider: ProviderKey;
  url: string;
  /** Env var sent as a Bearer token. When `required` and unset, the module is skipped. */
  auth?: { env: string; required: boolean };
  /** False for listing-only APIs, so missing prices aren't reported. */
  hasPrices: boolean;
  /** Validates the response with zod and maps it to common records. */
  parse(raw: unknown, ctx: ParseContext): ModelRecord[];
}

/** Fails the build when an API's currency differs from the one pinned in providers.yaml. */
export function checkCurrency(provider: ProviderKey, actual: Currency, config: ProviderConfig): void {
  if (config.currency && config.currency !== actual) {
    throw new HardError(`${provider} API returned prices in ${actual}, but providers.yaml pins ${config.currency}`);
  }
}

/** Number to decimal string; null, undefined and 0 become undefined (0 means "not priced", never free). */
export function priceOf(value: number | null | undefined): string | undefined {
  return value ? String(value) : undefined;
}

export function positiveInt(value: number | null | undefined): number | undefined {
  return value && value > 0 ? Math.round(value) : undefined;
}
