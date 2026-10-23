import { type ModelGroup, type Offer, groupModels, toOffer } from "./models.js";
import { persisted } from "./persisted.svelte.js";
import { type Score, type Weights, defaultWeights, score } from "./scores.js";
import type { Catalog, Currency } from "./types.js";

export type Route =
  | { page: "home" }
  | { page: "providers" }
  | { page: "labs" }
  | { page: "provider"; id: string }
  | { page: "lab"; id: string };

function parseRoute(hash: string): Route {
  const [, kind, id] = hash.match(/^#\/(providers|labs)(?:\/(.+))?$/) ?? [];
  if (kind === "providers") return id ? { page: "provider", id: decodeURIComponent(id) } : { page: "providers" };
  if (kind === "labs") return id ? { page: "lab", id: decodeURIComponent(id) } : { page: "labs" };
  return { page: "home" };
}

export const href = {
  home: "#/",
  providers: "#/providers",
  labs: "#/labs",
  provider: (id: string) => `#/providers/${encodeURIComponent(id)}`,
  lab: (id: string) => `#/labs/${encodeURIComponent(id)}`,
};

/** Everything the pages share: the catalog, the route, preferences and the derived scores and groups. */
class AppState {
  catalog = $state<Catalog>();
  error = $state<string>();
  route = $state<Route>(parseRoute(location.hash));
  currency = persisted<Currency>("currency", "EUR");
  weights = persisted<Weights>("weights", defaultWeights());

  scores = $derived.by(() => {
    const out: Record<string, { privacy?: Score; eco?: Score }> = {};
    for (const [id, p] of Object.entries(this.catalog?.providers ?? {})) {
      out[id] = { privacy: score("privacy", p.facts, this.weights.value), eco: score("eco", p.facts, this.weights.value) };
    }
    return out;
  });

  offers = $derived<Offer[]>(
    this.catalog ? this.catalog.models.map((m) => toOffer(m, new Date().toISOString().slice(0, 10))) : [],
  );

  constructor() {
    addEventListener("hashchange", () => {
      this.route = parseRoute(location.hash);
      scrollTo({ top: 0 });
    });
    fetch("catalog.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`catalog.json: HTTP ${r.status}`))))
      .then(
        (c: Catalog) => (this.catalog = c),
        (e: unknown) => (this.error = String(e)),
      );
  }

  providerName(id: string): string {
    return this.catalog?.providers[id]?.facts?.name ?? id;
  }

  groups(offers: Offer[]): ModelGroup[] {
    return this.catalog ? groupModels(this.catalog, offers) : [];
  }
}

export const app = new AppState();
