import type { Catalog, Currency, Unit } from "./types.js";

export const EUROPE = new Set([
  // EU
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU",
  "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  // EEA and Switzerland
  "IS", "LI", "NO", "CH",
]);

const COUNTRY_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

export function countryName(code: string): string {
  return COUNTRY_NAMES.of(code) ?? code;
}

/** Regional-indicator emoji for an ISO 3166-1 alpha-2 code. */
export function flag(code: string): string {
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Converts a USD amount to `currency` through the ECB rates (EUR base) the build used. */
export function fromUsd(usd: number, currency: Currency, rates: Catalog["exchange_rates"]): number {
  if (currency === "USD") return usd;
  const eur = usd / Number(rates.rates.USD);
  return currency === "EUR" ? eur : eur * Number(rates.rates.CHF);
}

/** Base units (token, page, second, character) in one quoted unit; usd_per_unit is per base unit. */
export const UNIT_SIZE: Record<Unit, number> = {
  "1M_tokens": 1e6,
  "1K_tokens": 1e3,
  token: 1,
  page: 1,
  second: 1,
  minute: 60,
  hour: 3600,
  character: 1,
};

const SYMBOL: Record<Currency, string> = { USD: "$", EUR: "€", CHF: "CHF " };

/** Short money string with enough significant digits for tiny per-unit prices. */
export function money(amount: number, currency: Currency): string {
  // Decide on the rounded amount, so 0.0999 shows as 0.10, not 0.1.
  const cents = Number(amount.toPrecision(2)) >= 0.1 || amount === 0;
  const options = cents ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumSignificantDigits: 2 };
  return `${SYMBOL[currency]}${new Intl.NumberFormat("en", options).format(amount)}`;
}

/** 128000 → "128K", 1048576 → "1M". */
export function tokens(n: number | undefined): string {
  if (n === undefined) return "";
  if (n >= 1_000_000) return `${+(n / 1_048_576).toFixed(n % 1_048_576 === 0 ? 0 : 1)}M`;
  return `${Math.round(n / 1000)}K`;
}

export function date(iso: string): string {
  return new Date(iso.length === 7 ? `${iso}-01` : iso).toLocaleDateString("en-GB", {
    day: iso.length === 7 ? undefined : "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ago(iso: string, now = new Date()): string {
  const days = Math.round((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 60) return `${days} days ago`;
  return `${Math.round(days / 30)} months ago`;
}

export const MODE_LABEL: Record<string, string> = {
  chat: "Chat",
  embedding: "Embeddings",
  rerank: "Rerank",
  ocr: "OCR",
  audio_transcription: "Transcription",
  audio_speech: "Speech",
  image_generation: "Image",
};
