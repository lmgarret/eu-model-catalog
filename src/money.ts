import { Decimal } from "decimal.js";
import type { Currency, PriceKey, Unit } from "./model.js";

/** ECB reference rates: how many units of each currency one EUR buys. */
export interface Rates {
  date: string;
  base: "EUR";
  rates: { USD: string; CHF: string };
  source: string;
}

/** The Bifrost datasheet fields we write prices to, all in USD per unit. */
export const BIFROST_PRICE_FIELDS = [
  "input_cost_per_token",
  "cache_read_input_token_cost",
  "output_cost_per_token",
  "ocr_cost_per_page",
  "input_cost_per_second",
  "input_cost_per_character",
] as const;
export type BifrostPriceField = (typeof BIFROST_PRICE_FIELDS)[number];

const UNIT_DIVISOR: Record<Unit, number> = {
  "1M_tokens": 1_000_000,
  "1K_tokens": 1_000,
  token: 1,
  page: 1,
  second: 1,
  minute: 60,
  hour: 3_600,
  character: 1,
};

/**
 * Which Bifrost field a price lands in. Non-token units only carry an input price;
 * returns undefined for combinations Bifrost has no field for.
 */
export function bifrostField(unit: Unit, key: PriceKey): BifrostPriceField | undefined {
  switch (unit) {
    case "1M_tokens":
    case "1K_tokens":
    case "token":
      return {
        input: "input_cost_per_token",
        cached_input: "cache_read_input_token_cost",
        output: "output_cost_per_token",
      }[key] as BifrostPriceField;
    case "page":
      return key === "input" ? "ocr_cost_per_page" : undefined;
    case "second":
    case "minute":
    case "hour":
      return key === "input" ? "input_cost_per_second" : undefined;
    case "character":
      return key === "input" ? "input_cost_per_character" : undefined;
  }
}

/** USD per one unit of `currency`. CHF goes through EUR. */
export function usdPer(currency: Currency, rates: Rates): Decimal {
  const eurUsd = new Decimal(rates.rates.USD);
  switch (currency) {
    case "USD":
      return new Decimal(1);
    case "EUR":
      return eurUsd;
    case "CHF":
      return eurUsd.div(rates.rates.CHF);
  }
}

/** Converts a price quoted in `currency` per `unit` to USD per Bifrost unit (token, page, second, character). */
export function toUsdPerUnit(amount: Decimal.Value, currency: Currency, unit: Unit, rates: Rates): Decimal {
  return new Decimal(amount).mul(usdPer(currency, rates)).div(UNIT_DIVISOR[unit]);
}

/** Relative difference |a - b| / max(|a|, |b|), 0 when both are 0. */
export function relativeDiff(a: Decimal, b: Decimal): Decimal {
  const max = Decimal.max(a.abs(), b.abs());
  return max.isZero() ? new Decimal(0) : a.sub(b).abs().div(max);
}

/** Decimal to a JSON number, trimmed to 12 significant digits so FX noise doesn't leak into the output. */
export function toJsonNumber(value: Decimal): number {
  return value.toSignificantDigits(12).toNumber();
}
