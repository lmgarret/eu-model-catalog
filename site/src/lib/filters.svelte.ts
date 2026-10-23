import { EUROPE } from "./format.js";
import type { ModelGroup, Offer } from "./models.js";
import { app } from "./state.svelte.js";

export const FEATURES = [
  ["tools", "Tool calling"],
  ["structured", "Structured output"],
  ["vision", "Vision"],
  ["reasoning", "Reasoning"],
] as const;

/** The model filters. A module singleton, so they survive a visit to a provider or lab page. */
class Filters {
  q = $state("");
  mode = $state("chat");
  providers = $state<string[]>([]);
  labs = $state<string[]>([]);
  euLab = $state(false);
  openWeights = $state(false);
  features = $state<string[]>([]);
  minPrivacy = $state(0);
  minEco = $state(0);
  hideDeprecated = $state(true);
  hideUnpriced = $state(false);

  /** Resets the filter panel; the search box and the type stay. */
  reset() {
    this.providers = [];
    this.labs = [];
    this.euLab = this.openWeights = this.hideUnpriced = false;
    this.features = [];
    this.minPrivacy = this.minEco = 0;
    this.hideDeprecated = true;
  }

  /** The panel's filters that differ from their defaults, as removable chips. */
  get chips(): { label: string; clear: () => void }[] {
    const labName = (id: string) => app.catalog?.labs[id]?.name ?? id;
    const chips: { label: string; clear: () => void }[] = [];
    if (this.providers.length)
      chips.push({ label: this.providers.map((p) => app.providerName(p)).join(", "), clear: () => (this.providers = []) });
    if (this.labs.length) chips.push({ label: this.labs.map(labName).join(", "), clear: () => (this.labs = []) });
    if (this.euLab) chips.push({ label: "European labs", clear: () => (this.euLab = false) });
    if (this.openWeights) chips.push({ label: "Open weights", clear: () => (this.openWeights = false) });
    for (const [key, label] of FEATURES) {
      if (this.features.includes(key)) chips.push({ label, clear: () => (this.features = this.features.filter((f) => f !== key)) });
    }
    if (this.minPrivacy) chips.push({ label: `Privacy ≥ ${this.minPrivacy}`, clear: () => (this.minPrivacy = 0) });
    if (this.minEco) chips.push({ label: `Eco ≥ ${this.minEco}`, clear: () => (this.minEco = 0) });
    if (!this.hideDeprecated) chips.push({ label: "With deprecated", clear: () => (this.hideDeprecated = true) });
    if (this.hideUnpriced) chips.push({ label: "Priced only", clear: () => (this.hideUnpriced = false) });
    return chips;
  }

  offer(o: Offer): boolean {
    if (this.hideDeprecated && o.deprecated) return false;
    if (this.hideUnpriced && !o.billable) return false;
    if (this.providers.length && !this.providers.includes(o.provider)) return false;
    if (this.minPrivacy && (app.scores[o.provider]?.privacy?.value ?? 0) < this.minPrivacy) return false;
    if (this.minEco && (app.scores[o.provider]?.eco?.value ?? 0) < this.minEco) return false;
    return true;
  }

  group(g: ModelGroup): boolean {
    const lab = g.lab ? app.catalog?.labs[g.lab] : undefined;
    if (this.labs.length && !(g.lab && this.labs.includes(g.lab))) return false;
    if (this.euLab && !(lab && EUROPE.has(lab.country))) return false;
    if (this.openWeights && !g.openWeights) return false;
    if (this.features.some((f) => !g[f as "tools"])) return false;
    const needle = this.q.trim().toLowerCase();
    if (needle) {
      const text = [g.name, g.canonical, lab?.name, g.license, ...g.offers.map((o) => o.bifrostId)].join(" ").toLowerCase();
      if (!text.includes(needle)) return false;
    }
    return true;
  }

  /** Groups whose offers pass, keeping only the passing offers; the mode filter is left to the caller. */
  apply(offers: Offer[]): ModelGroup[] {
    return app.groups(offers.filter((o) => this.offer(o))).filter((g) => this.group(g));
  }
}

export const filters = new Filters();
