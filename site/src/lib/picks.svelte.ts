import { resolveKeys } from "./compare.js";
import type { ModelGroup } from "./models.js";
import { persisted } from "./persisted.svelte.js";
import { app } from "./state.svelte.js";

/** The models picked in the tables, in pick order, and whether Home shows only them. */
class Picks {
  /** Group keys; ones the catalog no longer has are skipped when read, but kept in case they come back. */
  keys = persisted<string[]>("picks", []);
  /** "Show only selected"; in memory only, like the filters. */
  only = $state(false);

  /** The picked groups the catalog knows, in pick order, from every offer including deprecated ones. */
  groups = $derived<ModelGroup[]>(resolveKeys(this.keys.value, app.groups(app.offers)).filter((g) => g !== undefined));

  has(key: string): boolean {
    return this.keys.value.includes(key);
  }

  /** Ticks or unticks `key`; a new pick goes last. Unticking the last known pick turns `only` off. */
  toggle(key: string) {
    this.keys.value = this.has(key) ? this.keys.value.filter((k) => k !== key) : [...this.keys.value, key];
    if (!this.groups.length) this.only = false;
  }

  /** Unticks everything and turns `only` off. */
  clear() {
    this.keys.value = [];
    this.only = false;
  }
}

export const picks = new Picks();
