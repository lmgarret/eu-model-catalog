import { type ModelGroup, type Offer, groupModels, toOffer } from "./models.js";
import { compareHash, parseCompare } from "./compare.js";
import { persisted } from "./persisted.svelte.js";
import { type Score, type Weights, defaultWeights, score } from "./scores.js";
import type { Benchmark, Catalog, Currency } from "./types.js";

export type Route =
  | { page: "home" }
  | { page: "providers" }
  | { page: "labs" }
  | { page: "provider"; id: string }
  | { page: "lab"; id: string }
  | { page: "model"; id: string }
  | { page: "compare"; ids: string[] };

function parseRoute(hash: string): Route {
  const [, kind, id] = hash.match(/^#\/(providers|labs|models|compare)(?:\/(.*))?$/) ?? [];
  if (kind === "compare") return { page: "compare", ids: parseCompare(id) };
  if (kind === "providers") return id ? { page: "provider", id: decodeURIComponent(id) } : { page: "providers" };
  if (kind === "labs") return id ? { page: "lab", id: decodeURIComponent(id) } : { page: "labs" };
  if (kind === "models" && id) return { page: "model", id: decodeURIComponent(id) };
  return { page: "home" };
}

export const href = {
  home: "#/",
  providers: "#/providers",
  labs: "#/labs",
  provider: (id: string) => `#/providers/${encodeURIComponent(id)}`,
  lab: (id: string) => `#/labs/${encodeURIComponent(id)}`,
  /** A model group's key: its canonical id, or the offer id for unattributed models. */
  model: (key: string) => `#/models/${encodeURIComponent(key)}`,
  compare: compareHash,
};

/** Something shown in the side panel; `id` as in its page's route. */
export type Panel = { kind: "model" | "provider" | "lab"; id: string };

export const pageOf = (p: Panel) => (p.kind === "model" ? href.model(p.id) : p.kind === "lab" ? href.lab(p.id) : href.provider(p.id));

const samePanel = (a?: Panel, b?: Panel) => a?.kind === b?.kind && a?.id === b?.id;

/** The page and the open panel in a hash such as `#/labs?p=model:mistral%2Fmistral-large-4`. */
function splitHash(hash: string): { path: string; panel?: Panel } {
  const [path = "", query = ""] = hash.split("?");
  const [, kind, id] = new URLSearchParams(query).get("p")?.match(/^(model|provider|lab):(.+)$/) ?? [];
  return { path: path || href.home, panel: kind && id ? { kind: kind as Panel["kind"], id } : undefined };
}

/** Everything the pages share: the catalog, the route, preferences and the derived scores and groups. */
class AppState {
  catalog = $state<Catalog>();
  error = $state<string>();
  route = $state<Route>(parseRoute(splitHash(location.hash).path));
  currency = persisted<Currency>("currency", "EUR");
  weights = persisted<Weights>("weights", defaultWeights());
  /** The side panel's history; the last one is shown and in the URL, so links share it and Back closes it. */
  panels = $state<Panel[]>(splitHash(location.hash).panel ? [splitHash(location.hash).panel!] : []);
  /** The benchmark the models table shows, sorts and filters on. */
  benchmark = persisted<Benchmark>("benchmark", "capabilities");

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

  /** The page part of the hash, without the panel. */
  private path = splitHash(location.hash).path;
  /** History entries the panels added, so closing goes back past all of them. */
  private pushed = 0;

  constructor() {
    addEventListener("hashchange", () => {
      const { path, panel } = splitHash(location.hash);
      if (path !== this.path) {
        this.path = path;
        this.route = parseRoute(path);
        this.panels = panel ? [panel] : [];
        this.pushed = 0;
        scrollTo({ top: 0 });
      } else if (!panel) {
        this.panels = [];
        this.pushed = 0;
      } else if (samePanel(panel, this.panels.at(-2))) {
        this.panels = this.panels.slice(0, -1);
        this.pushed = Math.max(0, this.pushed - 1);
      } else if (!samePanel(panel, this.panels.at(-1))) {
        this.panels = [...this.panels, panel];
      }
    });
    fetch("catalog.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`catalog.json: HTTP ${r.status}`))))
      .then(
        (c: Catalog) => (this.catalog = c),
        (e: unknown) => (this.error = String(e)),
      );
  }

  /** Shows `p` in the side panel; links inside the panel replace its content, with a way back. */
  peek(p: Panel) {
    if (samePanel(p, this.panels.at(-1))) return;
    this.pushed++;
    location.hash = `${this.path}?p=${p.kind}:${encodeURIComponent(p.id)}`;
  }

  /** Back to the previous panel. */
  backPanel() {
    history.back();
  }

  closePanel() {
    if (this.pushed) return history.go(-this.pushed);
    // Opened from a shared link: drop the panel from the URL without leaving the page.
    history.replaceState(null, "", this.path);
    this.panels = [];
  }

  /** Swaps the compared models in the URL without adding a history entry or reloading the page. */
  replaceCompare(keys: string[]) {
    const hash = compareHash(keys);
    history.replaceState(null, "", hash);
    this.path = hash;
    this.route = parseRoute(hash);
    this.panels = [];
    this.pushed = 0;
  }

  providerName(id: string): string {
    return this.catalog?.providers[id]?.facts?.name ?? id;
  }

  groups(offers: Offer[]): ModelGroup[] {
    return this.catalog ? groupModels(this.catalog, offers) : [];
  }
}

export const app = new AppState();

/**
 * Click handler for links to a model, provider or lab: opens the side panel instead, unless a
 * modifier key or middle click asks for the full page.
 */
export function peek(e: MouseEvent, p: Panel) {
  e.stopPropagation();
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  app.peek(p);
}
