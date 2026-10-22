import type { ProviderKey } from "../../config.js";
import { greenpt } from "./greenpt.js";
import { infomaniak } from "./infomaniak.js";
import { mistral } from "./mistral.js";
import { regolo } from "./regolo.js";
import type { ProviderApi } from "./types.js";

export const PROVIDER_APIS: Record<ProviderKey, ProviderApi> = { greenpt, regolo, infomaniak, mistral };
