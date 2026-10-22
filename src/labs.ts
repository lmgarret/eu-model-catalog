import type { Lab, LabModel, Labs } from "./facts.js";

/** Quantization and format suffixes hosts append to a lab's model name, e.g. `Qwen3.5-122B-A10B-FP8`. */
const VARIANT_SUFFIX = /[-_.](fp8|fp4|nvfp4|int4|int8|w4a16|w8a8|awq|gptq|bf16|gguf|mlx)$/i;

export interface Resolved {
  /** `<lab>/<slug>`. */
  id: string;
  lab: string;
  slug: string;
  /** Which rule found it, for debugging attributions. */
  via: "overlay" | "models.dev" | "host is lab" | "model id" | "unique slug";
}

/**
 * Maps model ids to canonical `<lab>/<slug>` ids by exact lookups: lab keys and aliases for the
 * prefix, model keys and aliases for the name. No pattern matching.
 */
export class LabIndex {
  private readonly prefixes = new Map<string, string>();
  private readonly models = new Map<string, Map<string, string>>();
  /** Slug → canonical ids, across all labs, for ids without a prefix. */
  private readonly slugs = new Map<string, string[]>();

  constructor(readonly labs: Labs) {
    for (const [key, lab] of Object.entries(labs)) {
      for (const p of [key, ...lab.aliases]) this.prefixes.set(p.toLowerCase(), key);
      const names = new Map<string, string>();
      for (const [slug, m] of Object.entries(lab.models)) {
        for (const n of [slug, ...m.aliases]) {
          names.set(n.toLowerCase(), slug);
          const ids = this.slugs.get(n.toLowerCase()) ?? [];
          this.slugs.set(n.toLowerCase(), [...ids, `${key}/${slug}`]);
        }
      }
      this.models.set(key, names);
    }
  }

  /** The lab key for a prefix such as `Qwen`, `alibaba` or `mistralai`. */
  labOf(prefix: string): string | undefined {
    return this.prefixes.get(prefix.toLowerCase());
  }

  /** `<lab>/<slug>` for a model name within a lab, through the lab's aliases and minus variant suffixes. */
  inLab(lab: string, name: string): { lab: string; slug: string } {
    const names = this.models.get(lab);
    const lower = name.toLowerCase();
    const slug = names?.get(lower) ?? names?.get(lower.replace(VARIANT_SUFFIX, "")) ?? lower.replace(VARIANT_SUFFIX, "");
    return { lab, slug };
  }

  /** Normalizes `<prefix>/<name>`; undefined when the prefix isn't a known lab. */
  normalize(id: string): { lab: string; slug: string } | undefined {
    const slash = id.indexOf("/");
    if (slash < 0) return undefined;
    const lab = this.labOf(id.slice(0, slash));
    return lab === undefined ? undefined : this.inLab(lab, id.slice(slash + 1));
  }

  /**
   * Resolves a hosted model, first match wins: the overlay's `canonical`, models.dev's
   * `canonical_model_id`, a model the host's own lab lists, a `<org>/<name>` model id, a slug that
   * only one lab uses, then the host's lab even if it doesn't list the model.
   */
  resolve(m: { model: string; hostLab?: string; overlay?: string; modelsDev?: string }): Resolved | undefined {
    const found = (r: { lab: string; slug: string } | undefined, via: Resolved["via"]) =>
      r && { ...r, id: `${r.lab}/${r.slug}`, via };
    const unique = this.slugs.get(m.model.toLowerCase());
    const hosted = m.hostLab && this.labs[m.hostLab] ? this.inLab(m.hostLab, m.model) : undefined;
    return (
      found(m.overlay ? this.normalize(m.overlay) : undefined, "overlay") ??
      found(m.modelsDev ? this.normalize(m.modelsDev) : undefined, "models.dev") ??
      found(hosted && this.listed(hosted) ? hosted : undefined, "host is lab") ??
      found(this.normalize(m.model), "model id") ??
      (unique?.length === 1 ? found(this.normalize(unique[0]!), "unique slug") : undefined) ??
      // Last resort: a model of the host's own lab that labs/ doesn't list yet.
      found(hosted, "host is lab")
    );
  }

  private listed(r: { lab: string; slug: string }): boolean {
    return this.labs[r.lab]?.models[r.slug] !== undefined;
  }

  model(r: { lab: string; slug: string }): { lab: Lab; model?: LabModel } | undefined {
    const lab = this.labs[r.lab];
    return lab && { lab, model: lab.models[r.slug] };
  }
}
