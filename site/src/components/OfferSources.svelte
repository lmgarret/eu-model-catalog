<script lang="ts">
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { UNIT_SIZE, date, fromUsd, money } from "$lib/format.js";
  import type { Offer } from "$lib/models.js";
  import { app } from "$lib/state.svelte.js";

  let { offer }: { offer: Offer } = $props();

  const PRICE_LABEL: Record<string, string> = {
    input_cost_per_token: "Input",
    cache_read_input_token_cost: "Cached input",
    output_cost_per_token: "Output",
    ocr_cost_per_page: "OCR",
    input_cost_per_second: "Audio",
    input_cost_per_character: "Characters",
  };
  const PER: Record<string, string> = {
    "1M_tokens": "1M tokens",
    "1K_tokens": "1K tokens",
    token: "token",
    page: "page",
    second: "second",
    minute: "minute",
    hour: "hour",
    character: "character",
  };
  const SOURCE: Record<string, string> = {
    bifrost: "Bifrost datasheet",
    "models.dev": "models.dev",
    api: "provider API",
    overlay: "hand-kept overlay",
    labs: "labs/",
  };

  const m = $derived(offer.m);
  const info = $derived(
    (
      [
        ["Canonical model", m.canonical_id ? { value: m.canonical_id, source: "labs", url: undefined } : undefined],
        ["License", m.info.license],
        ["Open weights", m.info.open_weights],
        ["Knowledge cutoff", m.info.knowledge_cutoff],
        ["Released", m.info.release_date],
        ["Input", m.info.input_modalities],
        ["Output", m.info.output_modalities],
      ] as const
    ).filter(([, f]) => f !== undefined),
  );
  const show = (v: unknown) => (Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? (v ? "yes" : "no") : String(v));
  const currency = $derived(app.currency.value);
</script>

<div class="grid gap-6 py-2 pl-12 text-xs md:grid-cols-[1.2fr_1fr]">
  <section>
    <h4 class="text-muted-foreground mb-1.5 font-medium tracking-wide uppercase">Prices</h4>
    {#if Object.keys(m.prices).length === 0}
      <p class="text-muted-foreground">No source prices this model, so it's left out of pricing.json.</p>
    {:else}
      <table class="w-full">
        <tbody>
          {#each Object.entries(m.prices) as [field, p] (field)}
            <tr class="border-t">
              <td class="py-1 pr-2">{PRICE_LABEL[field] ?? field}</td>
              <td class="py-1 pr-2 whitespace-nowrap tabular-nums">
                <span class="font-medium">{p.original.amount} {p.original.currency}</span>
                <span class="text-muted-foreground">/ {PER[p.original.per]}</span>
              </td>
              <td class="text-muted-foreground py-1 pr-2 whitespace-nowrap tabular-nums">
                {#if p.original.currency !== currency}
                  ≈ {money(fromUsd(p.usd_per_unit * UNIT_SIZE[p.original.per], currency, app.catalog!.exchange_rates), currency)}
                {/if}
              </td>
              <td class="text-muted-foreground py-1">
                {#if p.source_url}<a class="hover:text-foreground underline" href={p.source_url} target="_blank" rel="noreferrer">{SOURCE[p.source]}</a>{:else}{SOURCE[p.source]}{/if}
                · {date(p.at)}
                {#if p.stale_since}<Badge variant="outline" class="text-warn ml-1">stale since {date(p.stale_since)}</Badge>{/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
    <p class="text-muted-foreground mt-2">
      {#if m.pricing_key}In pricing.json as <code class="font-mono">{m.pricing_key}</code>{:else}Not in pricing.json{/if}
    </p>
  </section>
  <section>
    <h4 class="text-muted-foreground mb-1.5 font-medium tracking-wide uppercase">Model facts</h4>
    <table class="w-full">
      <tbody>
        {#each info as [label, f] (label)}
          <tr class="border-t">
            <td class="py-1 pr-2">{label}</td>
            <td class="py-1 pr-2">{show(f!.value)}</td>
            <td class="text-muted-foreground py-1">
              {#if f!.url}<a class="hover:text-foreground underline" href={f!.url} target="_blank" rel="noreferrer">{SOURCE[f!.source]}</a>{:else}{SOURCE[f!.source]}{/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>
</div>
