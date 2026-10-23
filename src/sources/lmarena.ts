import { parquetReadObjects } from "hyparquet";
import { z } from "zod";
import type { SourceScores } from "../benchmarks.js";
import { fetchBytes } from "../http.js";

/**
 * The current text leaderboard with style control, the arena's default view. CC BY 4.0, see
 * https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset.
 */
export const LMARENA_URL =
  "https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset/resolve/main/text_style_control/latest-00000-of-00001.parquet";

const COLUMNS = ["model_name", "category", "rating", "rating_lower", "rating_upper", "vote_count"];

const rowSchema = z.object({
  model_name: z.string(),
  category: z.string(),
  rating: z.number(),
  rating_lower: z.number(),
  rating_upper: z.number(),
  // INT64 columns read as bigint.
  vote_count: z.coerce.number(),
});

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Coding ratings per arena model name, with their confidence interval and vote count. */
export function parseLmarena(rows: unknown[]): SourceScores {
  const out: SourceScores = new Map();
  for (const r of z.array(rowSchema).parse(rows)) {
    if (r.category !== "coding") continue;
    out.set(r.model_name, {
      coding: { value: round1(r.rating), ci: [round1(r.rating_lower), round1(r.rating_upper)], votes: Math.round(r.vote_count) },
    });
  }
  return out;
}

export async function fetchLmarena(): Promise<SourceScores> {
  const file = await fetchBytes(LMARENA_URL);
  return parseLmarena(await parquetReadObjects({ file, columns: COLUMNS }));
}
