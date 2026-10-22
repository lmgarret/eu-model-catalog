import { greenpt } from "./greenpt.js";
import { infomaniak } from "./infomaniak.js";
import { mistral } from "./mistral.js";
import { regolo } from "./regolo.js";
import type { ProviderApi } from "./types.js";

/** Price or model-listing APIs, by provider key. Providers without one rely on models.dev and the overlay. */
export const PROVIDER_APIS = { greenpt, regolo, infomaniak, mistral } satisfies Record<string, ProviderApi>;

export function providerApi(provider: string): ProviderApi | undefined {
  return (PROVIDER_APIS as Record<string, ProviderApi>)[provider];
}
