export const WARNING_CODES = [
  "price_mismatch",
  "missing_price",
  "source_failed",
  "source_skipped",
  "stale_data",
  "overlay_unlisted",
  "stale_fact",
  "unattributed_model",
  "unknown_lab_model",
  "license_mismatch",
  "unknown_benchmark_model",
] as const;
export type WarningCode = (typeof WARNING_CODES)[number];

export interface Warning {
  code: WarningCode;
  message: string;
  provider?: string;
  model?: string;
  details?: Record<string, unknown>;
}

export class Warnings {
  readonly items: Warning[] = [];

  add(warning: Warning): void {
    this.items.push(warning);
  }
}

/** Formats a warning as a GitHub Actions annotation. */
export function toAnnotation(w: Warning): string {
  const escape = (s: string) => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  const escapeProp = (s: string) => escape(s).replace(/:/g, "%3A").replace(/,/g, "%2C");
  const title = [w.code, w.provider, w.model].filter(Boolean).join(" ");
  return `::warning title=${escapeProp(title)}::${escape(w.message)}`;
}
