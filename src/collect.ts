import { type Catalog, type SourceState, catalogSchema } from "./catalog.js";
import type { ProvidersConfig } from "./config.js";
import { fetchJson } from "./http.js";
import { HardError, type ModelRecord, modelRecordSchema } from "./model.js";
import { MODELS_DEV_URL, parseModelsDev } from "./sources/modelsdev.js";
import { providerApi } from "./sources/providers/index.js";
import type { ProviderApi } from "./sources/providers/types.js";
import type { Warnings } from "./warnings.js";

export type FetchOutcome =
  | { ok: true; records: ModelRecord[]; fetched_at: string }
  | { ok: false; skipped: boolean; error: string };

export interface SourceSpec {
  id: string;
  kind: SourceState["kind"];
  provider?: string;
}

/**
 * Turns a fetch outcome into a source state. A failed or skipped source reuses its records
 * from the previously published catalog, marked `stale_since`, so one outage doesn't drop a provider.
 */
export function resolveSource(
  spec: SourceSpec,
  outcome: FetchOutcome,
  previous: Catalog | undefined,
  warnings: Warnings,
): SourceState {
  if (outcome.ok) return { ...spec, status: "ok", fetched_at: outcome.fetched_at, records: outcome.records };

  warnings.add({
    code: outcome.skipped ? "source_skipped" : "source_failed",
    provider: spec.provider,
    message: `${spec.id} ${outcome.skipped ? "skipped" : "failed"}: ${outcome.error}`,
  });
  const prev = previous?.sources.find((s) => s.id === spec.id && s.records.length > 0);
  if (!prev) {
    return { ...spec, status: outcome.skipped ? "skipped" : "failed", error: outcome.error, records: [] };
  }
  const staleSince = prev.stale_since ?? prev.fetched_at ?? previous!.built_at;
  warnings.add({
    code: "stale_data",
    provider: spec.provider,
    message: `${spec.id}: reusing ${prev.records.length} records from the previous build, stale since ${staleSince}`,
    details: { stale_since: staleSince },
  });
  return {
    ...spec,
    status: "stale",
    fetched_at: prev.fetched_at,
    stale_since: staleSince,
    error: outcome.error,
    records: prev.records.map((r) => ({ ...r, stale_since: r.stale_since ?? staleSince })),
  };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.name === "ZodError") return `unexpected response shape: ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}

/** Drops undefined fields (as JSON would) and checks the record against the common schema. */
export function normalizeRecords(records: ModelRecord[]): ModelRecord[] {
  return records.map((r) => modelRecordSchema.parse(JSON.parse(JSON.stringify(r))));
}

async function attempt(run: () => Promise<ModelRecord[]>, fetchedAt: string): Promise<FetchOutcome> {
  try {
    return { ok: true, records: normalizeRecords(await run()), fetched_at: fetchedAt };
  } catch (err) {
    if (err instanceof HardError) throw err;
    return { ok: false, skipped: false, error: errorMessage(err) };
  }
}

async function fetchProviderApi(
  api: ProviderApi,
  providers: ProvidersConfig,
  env: NodeJS.ProcessEnv,
  fetchedAt: string,
): Promise<FetchOutcome> {
  const provider = api.provider;
  const key = api.auth && env[api.auth.env];
  if (api.auth?.required && !key) {
    return { ok: false, skipped: true, error: `${api.auth.env} is not set` };
  }
  const headers: Record<string, string> = key ? { authorization: `Bearer ${key}` } : {};
  return attempt(
    async () => api.parse(await fetchJson(api.url, headers), { config: providers[provider]!, fetchedAt }),
    fetchedAt,
  );
}

/** Fetches models.dev and every provider API in parallel and resolves each against the previous catalog. */
export async function collectSources(
  providers: ProvidersConfig,
  env: NodeJS.ProcessEnv,
  fetchedAt: string,
  previous: Catalog | undefined,
  warnings: Warnings,
): Promise<SourceState[]> {
  const jobs: [SourceSpec, Promise<FetchOutcome>][] = [
    [
      { id: "models.dev", kind: "models.dev" },
      attempt(async () => parseModelsDev(await fetchJson(MODELS_DEV_URL), providers, fetchedAt), fetchedAt),
    ],
    ...Object.keys(providers).flatMap((p): [SourceSpec, Promise<FetchOutcome>][] => {
      const api = providerApi(p);
      return api ? [[{ id: `api:${p}`, kind: "api", provider: p }, fetchProviderApi(api, providers, env, fetchedAt)]] : [];
    }),
  ];
  const outcomes = await Promise.all(jobs.map(([, job]) => job));
  return jobs.map(([spec], i) => resolveSource(spec, outcomes[i]!, previous, warnings));
}

/** The previously published catalog, or undefined on the first run or if it can't be read. */
export async function fetchPreviousCatalog(url: string): Promise<{ catalog?: Catalog; note: string }> {
  try {
    const result = catalogSchema.safeParse(await fetchJson(url));
    if (!result.success) return { note: `previous catalog at ${url} doesn't match the current schema; no fallback` };
    return { catalog: result.data, note: `previous catalog built at ${result.data.built_at}` };
  } catch (err) {
    return { note: `no previous catalog at ${url} (${errorMessage(err)}); no fallback` };
  }
}
