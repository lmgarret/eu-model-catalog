<script lang="ts">
  import { isStale } from "$lib/facts.js";
  import { EUROPE, MODE_LABEL, countryName, date, flag, fromUsd, money } from "$lib/format.js";
  import { cheapestChatInput } from "$lib/models.js";
  import { app, href, peek } from "$lib/state.svelte.js";
  import Logo from "../Logo.svelte";

  let { id }: { id: string } = $props();

  const catalog = $derived(app.catalog!);
  const lab = $derived(catalog.labs[id]);
  const groups = $derived(
    app
      .groups(app.offers.filter((o) => o.m.info.lab?.value === id && !o.deprecated))
      .sort((a, b) => (b.scores?.capabilities?.percentile ?? -1) - (a.scores?.capabilities?.percentile ?? -1) || a.name.localeCompare(b.name)),
  );
  const cheapest = $derived(cheapestChatInput(groups));
  const AI_ACT = {
    signatory: ["✓ Signed the EU AI Code of Practice", "bg-good/12 text-good"],
    partial: ["Partly signed the EU AI Code of Practice", "bg-warn/15 text-warn"],
    not_signatory: ["Didn't sign the EU AI Code of Practice", "bg-muted text-muted-foreground"],
  } as const;
</script>

{#if !lab}
  <p class="text-muted-foreground">Unknown lab “{id}”.</p>
{:else}
  <header class="flex items-center gap-3">
    <Logo name={lab.name} logo={lab.logo} color={lab.color} size={44} class="rounded-xl" />
    <div>
      <h2 class="text-xl font-semibold tracking-tight">{lab.name}</h2>
      <p class="text-muted-foreground flex flex-wrap gap-x-3 text-sm">
        <span>{flag(lab.country)} {countryName(lab.country)}</span>
        <a class="hover:text-foreground" href={lab.website} target="_blank" rel="noreferrer">{new URL(lab.website).host} ↗</a>
      </p>
    </div>
  </header>

  <div class="mt-4 flex flex-wrap gap-1.5 text-xs">
    {#if EUROPE.has(lab.country)}<span class="bg-brand/10 text-brand rounded-full px-2.5 py-1">🇪🇺 European lab</span>{/if}
    {#if lab.eu_ai_act}
      {@const [text, tone] = AI_ACT[lab.eu_ai_act.value]}
      <a href={lab.eu_ai_act.source} target="_blank" rel="noreferrer" class="rounded-full px-2.5 py-1 {tone}" title="Checked {date(lab.eu_ai_act.checked)}{isStale(lab.eu_ai_act.checked) ? ' (stale)' : ''}">{text}</a>
    {/if}
  </div>

  <div class="mt-6 flex gap-10 border-b pb-5">
    <div>
      <div class="text-2xl font-semibold tracking-tight tabular-nums">{groups.length}</div>
      <div class="text-muted-foreground text-xs">models in Europe</div>
    </div>
    <div>
      <div class="text-2xl font-semibold tracking-tight tabular-nums">{groups.filter((g) => g.openWeights).length}</div>
      <div class="text-muted-foreground text-xs">open weights</div>
    </div>
    {#if cheapest !== undefined}
      <div>
        <div class="text-2xl font-semibold tracking-tight tabular-nums">{money(fromUsd(cheapest, app.currency.value, catalog.exchange_rates), app.currency.value)}</div>
        <div class="text-muted-foreground text-xs">cheapest chat, per 1M input</div>
      </div>
    {/if}
  </div>

  <h3 class="mt-6 mb-2 text-sm font-medium">Models</h3>
  <ul class="divide-y rounded-xl border">
    {#each groups as g (g.key)}
      {@const cap = g.scores?.capabilities}
      <li>
        <a href={href.model(g.key)} onclick={(e) => peek(e, { kind: "model", id: g.key })} class="hover:bg-muted/50 flex items-center gap-3 px-3.5 py-2.5">
          <span class="min-w-0 flex-1">
            <span class="block truncate font-medium">{g.name}</span>
            <span class="text-muted-foreground text-xs">{MODE_LABEL[g.mode] ?? g.mode}{g.license ? ` · ${g.license}` : ""}</span>
          </span>
          <span class="flex -space-x-1">
            {#each [...new Set(g.offers.map((o) => o.provider))] as p (p)}
              {@const f = catalog.providers[p]?.facts}
              <Logo name={f?.name ?? p} logo={f?.logo} color={f?.color} size={20} class="ring-background ring-2" />
            {/each}
          </span>
          <span class="w-8 text-right font-mono text-[13px] tabular-nums" title="Capabilities percentile">{cap ? cap.percentile : ""}</span>
        </a>
      </li>
    {/each}
  </ul>
{/if}
