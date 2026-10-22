# eu-model-catalog

A catalog of AI models from European providers (GreenPT, Regolo.ai, Infomaniak, Mistral), with prices pulled from provider APIs and normalized to USD per token.

Published on GitHub Pages:

- `pricing.json`: a pricing datasheet in Bifrost's format, for Bifrost's `pricing_url`
- `/`: a sortable, filterable table of models and providers

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
pnpm build:data   # writes dist/pricing.json, dist/catalog.json and dist/index.html
pnpm test         # also: pnpm lint, pnpm typecheck
```

No secrets are needed. Without `INFOMANIAK_TOKEN` or `MISTRAL_API_KEY`, those provider APIs are skipped with a warning, and the build reuses their records from the published `catalog.json` when it can. `REGOLO_API_KEY` is optional.

- `providers.yaml` maps each provider's ids in Bifrost and models.dev, and pins its invoice currency.
- `overlay/<provider>.yaml` holds hand-kept prices, written as the provider publishes them. They override every other source. See `overlay/greenpt.yaml` for the format.
- `test/fixtures/` holds trimmed source responses. To update the snapshot after an intended change, run `pnpm test -u`.
