import { z } from "zod";
import { fetchJson } from "../http.js";

export const hfModelUrl = (repo: string) => `https://huggingface.co/${repo}`;
const apiUrl = (repo: string) => `https://huggingface.co/api/models/${repo}`;

const responseSchema = z.object({
  cardData: z
    .object({
      license: z.union([z.string(), z.array(z.string())]).optional(),
      license_name: z.string().optional(),
    })
    .loose()
    .optional(),
});

/** Hugging Face license ids to the names labs/ uses. Others are shown as given. */
const LICENSE_NAMES: Record<string, string> = {
  "apache-2.0": "Apache-2.0",
  mit: "MIT",
  "cc-by-4.0": "CC-BY-4.0",
  "cc-by-nc-4.0": "CC-BY-NC-4.0",
  "cc-by-sa-4.0": "CC-BY-SA-4.0",
  "llama3.3": "Llama 3.3 Community License",
  "llama3.1": "Llama 3.1 Community License",
  gemma: "Gemma Terms of Use",
  mrl: "Mistral Research License",
  "minimax-community": "MiniMax Community License",
  "kimi-k3": "Kimi K3 License",
  "glm-5.3": "GLM-5.3 License",
};

/** The license on a repo's model card, or undefined when the card has none. */
export function parseHfLicense(raw: unknown): string | undefined {
  const card = responseSchema.parse(raw).cardData;
  const id = Array.isArray(card?.license) ? card.license[0] : card?.license;
  const name = id === "other" ? card?.license_name : id;
  return name && (LICENSE_NAMES[name] ?? name);
}

/** Compares license names loosely: case, spaces and hyphens don't matter. */
export function sameLicense(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");
  return norm(a) === norm(b);
}

/** Fetches licenses for the given repos, a few at a time. Failed repos are returned separately. */
export async function fetchHfLicenses(
  repos: string[],
  concurrency = 8,
): Promise<{ licenses: Map<string, string | undefined>; failed: string[] }> {
  const licenses = new Map<string, string | undefined>();
  const failed: string[] = [];
  const queue = [...new Set(repos)];
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      for (let repo = queue.shift(); repo !== undefined; repo = queue.shift()) {
        try {
          licenses.set(repo, parseHfLicense(await fetchJson(apiUrl(repo))));
        } catch {
          failed.push(repo);
        }
      }
    }),
  );
  return { licenses, failed };
}
