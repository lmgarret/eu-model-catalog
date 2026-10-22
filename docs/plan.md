# eu-model-catalog: initial plan

## Goal

Bifrost (the AI gateway) calculates request costs from a pricing datasheet it downloads from `pricing_url` (default: `https://getbifrost.ai/datasheet`). That default has three problems for us:

1. It doesn't cover, or is outdated for, the European providers we use: GreenPT, Regolo.ai, Infomaniak, Mistral.
2. These providers bill in EUR/CHF, and Bifrost only supports USD.
3. Providers publish prices per 1M tokens, and Bifrost wants them per token.

This repo builds a merged datasheet every day, publishes it on GitHub Pages for Bifrost to fetch, and serves a browsable catalog of models and providers on the same site.

Bifrost config, once published:

```json
"framework": { "pricing": {
  "pricing_url": "https://lmgarret.github.io/eu-model-catalog/pricing.json",
  "pricing_sync_interval": 86400
}}
```

## Sources and precedence

Later sources override earlier ones, field by field:

1. **Bifrost datasheet** (`https://getbifrost.ai/datasheet`): the base. Keep every entry, because `pricing_url` replaces Bifrost's whole catalog. Dropping entries would lose pricing for other providers.
2. **models.dev** (`https://models.dev/api.json`), only for our four providers. Costs are USD per 1M tokens (`cost.input`, `cost.output`, `cost.cache_read`); limits are in `limit.context` and `limit.output`; `type: "embedding"` marks embeddings.
3. **Provider APIs**, which give prices in invoice currency:

   | Provider | Endpoint | Auth | Shape / notes |
   |---|---|---|---|
   | GreenPT | `GET https://api.greenpt.ai/v1/pricing` | none | `data[].pricing.{promptToken, completionToken, cachedPromptToken}`, `type` (`LLM`, `EMBEDDINGS`, …), `contextWindowTokens`, `maxOutputTokens`. **No currency field**: pin EUR in config. Unit is assumed to be per 1M tokens; check against https://docs.greenpt.ai pricing page. |
   | Regolo.ai | `GET https://api.regolo.ai/model_group/info` | none today (docs say a Bearer key is required) | LiteLLM-style, per token: `input_cost_per_token`, `output_cost_per_token`, `ocr_cost_per_page`, `input_cost_per_token_batches`, `mode`, `max_input_tokens`, … **No currency field**: pin EUR (per docs). Send `REGOLO_API_KEY` if set, in case unauthenticated access gets closed. |
   | Infomaniak | `GET https://api.infomaniak.com/1/ai/models` | Bearer token | Returns prices **with a currency field**. Response shape not yet inspected: capture a fixture with a real token first. |
   | Mistral | `GET https://api.mistral.ai/v1/models` | Bearer key | No prices. Use for `deprecation_date` and a "still listed" check. Mistral prices come from the overlay (in EUR) or models.dev. |

4. **Overlay** (`overlay/<provider>.yaml`), maintained by hand in git. It is the final word. Expected content: Mistral EUR prices, OCR/STT/TTS rates for models not covered by the APIs, and corrections.

## Overlay format

One file per provider, with prices written exactly as the provider publishes them:

```yaml
# overlay/greenpt.yaml
green-l:
  currency: EUR          # EUR | CHF | USD
  per: 1M_tokens         # 1M_tokens | 1K_tokens | token | page | second | minute | hour | character
  input: 0.25
  cached_input: 0.05
  output: 0.80
  source: https://docs.greenpt.ai/pricing
  checked: 2026-10-22
```

Validate with a schema (zod). `source` and `checked` are required.

## Provider config

`providers.yaml` maps each provider's ids and settings:

```yaml
greenpt:
  bifrost_provider: greenpt      # provider name as configured in our Bifrost
  models_dev_id: greenpt
  currency: EUR                  # pinned, for APIs without a currency field
regolo:
  bifrost_provider: regolo
  models_dev_id: regolo-ai
  currency: EUR
infomaniak:
  bifrost_provider: infomaniak
  models_dev_id: infomaniak
mistral:
  bifrost_provider: mistral
  models_dev_id: mistral
```

The `bifrost_provider` values are placeholders. Confirm them against our Bifrost config.

## Build

TypeScript on Node 22, pnpm, vitest. Use decimal.js for all money math (never floats), zod to validate every external response, and the `yaml` package.

Steps:

1. Fetch all sources. Each provider has its own module that maps its response to a common record: `{provider, model, currency, unit, prices, limits, mode, deprecation_date, source, fetched_at}`.
2. **Exchange rates:** use the ECB daily reference rates, `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml` (EUR base, includes USD and CHF, no key). Convert CHF to USD through EUR. Write the rates and their date into the output.
3. Merge by precedence, field by field. Record the source of each field (`bifrost` | `models.dev` | `api` | `overlay`).
4. Convert to USD per unit:
   - per 1M tokens: divide by 1e6
   - per page: `ocr_cost_per_page`
   - per second: `input_cost_per_second`
   - per character: `input_cost_per_character`
5. Emit warnings, both as GitHub Actions `::warning::` annotations and in `catalog.json`:
   - overlay and models.dev (or the provider API) disagree on a price; show both values
   - models.dev lists a price of 0 or none (treat 0 as missing, never as free)
   - a provider API failed (see fallback below)
   - a model is in the overlay but no longer listed by the provider
6. **Hard failures:**
   - an API returns a currency that differs from the pinned one
   - schema validation fails on the overlay
   - the output fails its own schema check
7. **Fallback:** if a provider API is unreachable, reuse that provider's records from the previously published `catalog.json` (fetched from the Pages URL), mark them `stale_since`, and warn. One provider's outage must not break the build.

Outputs (in the site's static folder):

- **`pricing.json`**: Bifrost datasheet format. This is LiteLLM's `model_prices_and_context_window.json` format, except Bifrost uses `provider` instead of `litellm_provider` and adds `base_model`. Keys are `<bifrost_provider>/<model>`. Relevant fields:
  - `input_cost_per_token`, `output_cost_per_token`, `cache_read_input_token_cost`
  - `ocr_cost_per_page`, `input_cost_per_second`, `input_cost_per_character`
  - `max_input_tokens`, `max_output_tokens`
  - `mode`: `chat` | `embedding` | `ocr` | `audio_transcription` | `audio_speech` | `rerank` | …
  - `deprecation_date`, `source`, `provider`, `base_model`
- **`catalog.json`**: the rich data for the site. Contains:
  - original currency and unit prices next to the USD values
  - the source and `checked`/`fetched_at` date of each field
  - the exchange rates used
  - warnings
  - an open-ended `extra` object per model, for future benchmarks

## GitHub Actions

- Triggers: push to `main`, daily cron (e.g. 05:00 UTC, after ECB publishes), and manual dispatch.
- Jobs: test, build data, build site, deploy to Pages (`actions/upload-pages-artifact` + `actions/deploy-pages`).
- Secrets:
  - `INFOMANIAK_TOKEN` (required)
  - `MISTRAL_API_KEY` (required)
  - `REGOLO_API_KEY` (optional)
- The repo is public: Pages on private repos needs Enterprise, and Bifrost can't send auth headers.

## Site

SvelteKit with `adapter-static`, base path `/eu-model-catalog`. It reads `catalog.json` only, so the site and `pricing.json` can't disagree.

- One table with sortable, filterable columns:
  - provider and model
  - mode
  - input, cached-input and output price (USD and original currency, per 1M tokens for readability)
  - other unit prices
  - context and max output
  - deprecation date
  - source of each price
  - date last checked
- A banner with build time, exchange rates and active warnings.
- No backend, no analytics.

## Phases

1. **Data pipeline:**
   - scaffold, `providers.yaml`, provider modules with recorded fixtures
   - merge, exchange rates, warnings, fallback
   - `pricing.json`
   - unit tests (fixtures in, `pricing.json` snapshot out)
   - Actions and Pages deploy (a placeholder `index.html` is fine)
2. **Site:** the Svelte table.
3. **Provider facts:** `providers/<provider>.yaml`, shown on the site and never in `pricing.json`. Every claim has a `source` URL and a `checked` date. The site labels them as provider claims and flags entries checked more than 6 months ago. Start with:
   - regions, legal entity country, parent company country (US CLOUD Act exposure)
   - data retention, zero-data-retention option, training on customer data
   - renewable energy share (contracts vs certificates)
   - certifications (ISO 27001, SOC 2, SecNumCloud, C5, …)

   Optional later: DPA and sub-processors, EU AI Act status, PUE, gCO₂ per request, heat reuse, model license and origin, SLA and status page, billing entity.
4. **Later, out of scope for now:**
   - benchmarks in `extra` (e.g. Artificial Analysis API)
   - latency measured from our own Bifrost logs
   - an LLM job that reads pricing pages for providers without a price API and opens PRs against the overlay
   - an optional LiteLLM-format output

## Open questions to resolve during phase 1

Answers found during phase 1 are marked **Answer**. They are based on Bifrost's source (`framework/modelcatalog/datasheet/`).

- **How Bifrost looks up prices for custom providers:** by the provider name configured in Bifrost, or by the base provider type? This decides the `bifrost_provider` keys. Check `framework/modelcatalog` in https://github.com/maximhq/bifrost.
  - **Answer:** by the custom provider's own name. There is no fallback to the base provider type, and none to the model alone.
  - Each datasheet row is stored as `model|provider|mode`:
    - the model is the map key with everything up to the first `/` removed
    - the provider comes from the entry's `provider` field; the key's prefix is ignored
    - the mode comes from `mode`
  - A request matches on the exact model, then on the lowercased model. So every entry needs the right `provider` and `mode`, and `bifrost_provider` must equal the custom provider's name.
  - `normalizeProvider` matches by substring: a custom name containing `together`, `bedrock`, `cohere`, `runwayml`, `fireworks_ai` or `vertex_ai` is rewritten to the built-in name. Avoid those names.
- **Whether Bifrost uses the non-token fields** (`ocr_cost_per_page`, `input_cost_per_second`, `input_cost_per_character`) to cost OCR, transcription and TTS requests.
  - **Answer:** yes.
    - **OCR:** pages × `ocr_cost_per_page`, plus `annotation_cost_per_page` for annotated requests.
    - **Transcription:** audio or prompt tokens when the provider reports them. Otherwise `usage.seconds` × `input_cost_per_audio_per_second`, falling back to `input_cost_per_second`.
    - **TTS:** characters × `input_cost_per_character`. Without that field, Bifrost multiplies the characters by the input token rate.
  - Other notes:
    - `cache_read_input_token_cost` and `input_cost_per_token_batches` are used.
    - `deprecation_date` is ignored; Bifrost only reads the boolean `is_deprecated`, so the build sets both.
    - With a database config store, a sync upserts rows and never deletes them. Without one, the in-memory catalog is replaced.
    - `pricing_sync_interval` is in seconds, with a minimum of 3600.
- **Infomaniak's `/1/ai/models` response shape**, and whether it needs a product id.
  - **Answer, from Infomaniak's OpenAPI spec:** no product id is needed.
  - Prices are only included with `?with=pricing`, as `prices[]` of `{input_amount_excl_vat, output_amount_excl_vat, amount_excl_vat, currency_id, unit: {type: "tokens" | "minute", amount: N}}`.
  - The currency is a numeric `currency_id`. `providers.yaml` maps id 1 to CHF, taken from the spec's example. An unknown id fails the build.
  - Still to do: capture a real response to confirm the shape.
- **GreenPT's pricing unit:** confirm it's per 1M tokens and in EUR.
  - **Answer:** confirmed by https://docs.greenpt.ai/docs/pricing: EUR, per 1M tokens, for the EU endpoint `api.greenpt.ai`.
  - The speech-to-text fields `listenSecond` / `liveSecond` are in fact **per hour** (green-s costs €0.23 per hour of pre-recorded audio). The build uses the pre-recorded rate.
- **The OCR, transcription and TTS models served by bifrost-adapters:** which models, under which Bifrost provider names, at which rates. Ask the repo owner.
  - Still open. Add them to the overlay once known.
