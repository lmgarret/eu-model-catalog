# eu-model-catalog

A catalog of AI models from European providers (GreenPT, Regolo.ai, Infomaniak, Mistral), with prices pulled from provider APIs and normalized to USD per token.

Published on GitHub Pages:

- `pricing.json`: a pricing datasheet in Bifrost's format, for Bifrost's `pricing_url`
- `/`: the catalog site: models grouped across hosts, a list of providers with privacy and eco scores and of AI labs, a page per provider (key facts, maximum-privacy setup, fact sheet) and per lab

See [docs/plan.md](docs/plan.md) for the design.

## Use with Bifrost

```json
"framework": { "pricing": {
  "pricing_url": "https://lmgarret.github.io/eu-model-catalog/pricing.json",
  "pricing_sync_interval": 86400
}}
```

`pricing.json` holds Bifrost's whole default datasheet plus our providers' prices, because `pricing_url` replaces the default. Bifrost matches an entry by model, the entry's `provider` field and `mode`. For custom providers, the `provider` field is the custom provider's name. The names in `providers.yaml` (`bifrost_provider`) must match the provider names in your Bifrost config.

## Local development

Requires Node 22 and pnpm.

```sh
pnpm install
pnpm build        # the site, then dist/pricing.json and dist/catalog.json
pnpm dev          # the site, served with dist/catalog.json (or the published one if missing)
pnpm test         # also: pnpm lint, pnpm typecheck
```

`pnpm build:site` empties `dist/`, so run it before `pnpm build:data`.

No secrets are needed. Without `INFOMANIAK_TOKEN` or `MISTRAL_API_KEY`, those provider APIs are skipped with a warning, and the build reuses their records from the published `catalog.json` when it can. `REGOLO_API_KEY` is optional.

- `providers.yaml` defines the providers: their ids in Bifrost and models.dev, invoice currency, and `lab` when the provider also develops its models. Adding a provider starts there; see the comment at the top of the file.
- `overlay/<provider>.yaml` holds hand-kept prices, written as the provider publishes them. They override every other source. See `overlay/greenpt.yaml` for the format.
- `providers/<provider>.yaml` holds provider facts: privacy, jurisdiction, sustainability and operations, plus `privacy_setup`, the steps to the provider's maximum privacy. A privacy fact can carry a `best` value and the step that unlocks it. Each fact is a claim with a `source` URL and a `checked` date; see `src/facts.ts`. They go to `catalog.json` only, never to `pricing.json`. Facts checked more than 6 months ago raise a `stale_fact` warning and are flagged on the site.
- `labs/<lab>.yaml` holds AI labs (country, EU AI Act status) and their models (license, open weights, Hugging Face repo, aliases). Every hosted model maps to a canonical `<lab>/<model>` id by exact lookups (`src/labs.ts`): the overlay's `canonical`, models.dev's canonical id, the host's own lab, an `<org>/<name>` model id. Unmatched models raise `unattributed_model` or `unknown_lab_model`. Licenses are checked against Hugging Face model cards (`license_mismatch`).
- Overlay entries can also set `canonical` and model facts (`license`, `open_weights`, `tool_call`, …), with or without prices.
- The site (`site/`, Svelte 5 + Vite + shadcn-svelte) reads `catalog.json` only. Scores are computed in the browser from the provider facts (`site/src/lib/scores.ts`); privacy assumes each provider's self-serve maximum-privacy steps. Score weights are kept in localStorage. Logos come from models.dev. Add shadcn-svelte components with `pnpm dlx shadcn-svelte@latest add <name>`.
- `test/fixtures/` holds trimmed source responses. To update the snapshot after an intended change, run `pnpm test -u`.
