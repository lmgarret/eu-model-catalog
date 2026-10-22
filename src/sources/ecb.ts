import { z } from "zod";
import { fetchText } from "../http.js";
import type { Rates } from "../money.js";

export const ECB_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

const ratesSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  USD: z.string().regex(/^\d+(\.\d+)?$/),
  CHF: z.string().regex(/^\d+(\.\d+)?$/),
});

/** Parses the ECB daily reference rates XML (EUR base). */
export function parseEcb(xml: string): Rates {
  const date = /<Cube\s+time=['"]([^'"]+)['"]/.exec(xml)?.[1];
  const rate = (currency: string) =>
    new RegExp(`<Cube\\s+currency=['"]${currency}['"]\\s+rate=['"]([^'"]+)['"]`).exec(xml)?.[1];
  const parsed = ratesSchema.parse({ date, USD: rate("USD"), CHF: rate("CHF") });
  return { date: parsed.date, base: "EUR", rates: { USD: parsed.USD, CHF: parsed.CHF }, source: ECB_URL };
}

export async function fetchEcb(): Promise<Rates> {
  return parseEcb(await fetchText(ECB_URL));
}
