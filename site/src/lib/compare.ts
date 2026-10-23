import type { ModelGroup } from "./models.js";

/** How many models the compare page shows side by side. */
export const MAX_COMPARE = 3;

/** One colour per compared model, in pick order. */
export const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)"] as const;

/** The compare page's hash: each key URL-encoded (so `/` and `,` are safe) and joined with `,`. */
export const compareHash = (keys: readonly string[]): string => `#/compare/${keys.map(encodeURIComponent).join(",")}`;

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s; // a hand-typed URL with a stray `%`
  }
};

/** The keys in a compare route's raw segment: decoded, without empty parts or duplicates (the first stays). */
export function parseCompare(segment: string | undefined): string[] {
  return [...new Set((segment ?? "").split(",").filter(Boolean).map(decode))];
}

/** The group for each key, in the same order; `undefined` for a key the catalog doesn't have. */
export const resolveKeys = (keys: readonly string[], groups: readonly ModelGroup[]): (ModelGroup | undefined)[] =>
  keys.map((k) => groups.find((g) => g.key === k));

/** A rank in words: "Best" for 1, then "2nd", "3rd", "4th", "11th", "21st"… */
export function ordinal(n: number): string {
  if (n === 1) return "Best";
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}
