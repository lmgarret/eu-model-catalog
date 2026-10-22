import { z } from "zod";

export const BIFROST_DATASHEET_URL = "https://getbifrost.ai/datasheet";

/** One datasheet entry. Kept loose: we pass every field we don't override through unchanged. */
export type DatasheetEntry = Record<string, unknown> & { provider?: string; mode?: string };
export type Datasheet = Record<string, DatasheetEntry>;

const datasheetSchema = z.record(z.string(), z.record(z.string(), z.unknown()));

/** `minEntries` guards against a truncated download wiping Bifrost's whole catalog. */
export function parseDatasheet(raw: unknown, minEntries = 1000): Datasheet {
  const sheet = datasheetSchema.parse(raw) as Datasheet;
  if (Object.keys(sheet).length < minEntries) {
    throw new Error(`Bifrost datasheet has only ${Object.keys(sheet).length} entries`);
  }
  return sheet;
}

/** Bifrost stores an entry under the key with everything up to the first "/" removed. */
export function datasheetModelName(key: string): string {
  const slash = key.indexOf("/");
  return slash === -1 ? key : key.slice(slash + 1);
}
