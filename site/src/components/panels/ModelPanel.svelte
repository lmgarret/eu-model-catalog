<script lang="ts">
  import AudioLinesIcon from "@lucide/svelte/icons/audio-lines";
  import BracesIcon from "@lucide/svelte/icons/braces";
  import BrainIcon from "@lucide/svelte/icons/brain";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import WrenchIcon from "@lucide/svelte/icons/wrench";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { MODE_LABEL, breakable, date, flag, fromUsd, money, tokens } from "$lib/format.js";
  import { groupStats } from "$lib/models.js";
  import { app, href, peek } from "$lib/state.svelte.js";
  import BenchmarkCards from "../BenchmarkCards.svelte";
  import CopyButton from "../CopyButton.svelte";
  import Logo from "../Logo.svelte";
  import OfferSources from "../OfferSources.svelte";
  import ScoreBadge from "../ScoreBadge.svelte";

  let { id }: { id: string } = $props();

  let sources = $state<string | null>(null);

  const catalog = $derived(app.catalog!);
  const g = $derived(app.groups(app.offers).find((x) => x.key === id));
  const lab = $derived(g?.lab ? catalog.labs[g.lab] : undefined);
  const stats = $derived(g && groupStats(g));
  const price = (usd: number | undefined) =>
    usd === undefined ? "–" : money(fromUsd(usd, app.currency.value, catalog.exchange_rates), app.currency.value);

  const FEATURES = [
    ["tools", "Tools", WrenchIcon],
    ["structured", "Structured output", BracesIcon],
    ["vision", "Vision", EyeIcon],
    ["audio", "Audio", AudioLinesIcon],
    ["reasoning", "Reasoning", BrainIcon],
  ] as const;
</script>

{#if !g || !stats}
  <p class="text-muted-foreground">Unknown model “{id}”.</p>
{:else}
  <header class="flex items-center gap-3">
    <Logo name={lab?.name ?? g.name} logo={lab?.logo} color={lab?.color} size={44} class="rounded-xl" />
    <div class="min-w-0">
      <h2 class="text-xl font-semibold tracking-tight">{g.name}</h2>
      <p class="text-muted-foreground flex flex-wrap gap-x-3 text-sm">
        {#if lab && g.lab}
          <a class="hover:text-foreground hover:underline" href={href.lab(g.lab)} onclick={(e) => peek(e, { kind: "lab", id: g.lab! })}>{flag(lab.country)} {lab.name}</a>
        {/if}
        <span>{MODE_LABEL[g.mode] ?? g.mode}</span>
        {#if stats.context}<span>{tokens(stats.context)} context</span>{/if}
        {#if g.knowledge}<span>Cutoff {date(g.knowledge)}</span>{/if}
      </p>
    </div>
  </header>

  <div class="mt-4 flex flex-wrap gap-1.5 text-xs">
    {#if g.openWeights !== undefined}
      <span class="rounded-full px-2.5 py-1 {g.openWeights ? 'bg-good/12 text-good' : 'bg-muted text-muted-foreground'}">{g.openWeights ? "Open weights" : "Closed weights"}</span>
    {/if}
    {#if g.license}<a href={g.licenseUrl} target="_blank" rel="noreferrer" class="bg-muted hover:text-foreground rounded-full px-2.5 py-1">{g.license}</a>{/if}
    {#each FEATURES as [key, label, Icon] (key)}
      {#if g[key]}<span class="bg-muted inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"><Icon class="size-3" />{label}</span>{/if}
    {/each}
  </div>

  {#if g.mode === "chat"}
    <h3 class="mt-7 mb-3 text-sm font-medium">Benchmarks</h3>
    <BenchmarkCards group={g} compact />
  {/if}

  <h3 class="mt-7 mb-2 text-sm font-medium">
    Hosts <span class="text-muted-foreground font-normal">{g.offers.length} · prices per 1M tokens</span>
  </h3>
  <div class="divide-y rounded-xl border">
    {#each g.offers as o (o.id)}
      {@const f = catalog.providers[o.provider]?.facts}
      {@const s = app.scores[o.provider]}
      <div class="p-3.5 {o.deprecated ? 'opacity-55' : ''}">
        <div class="flex items-start gap-3">
          <Logo name={f?.name ?? o.provider} logo={f?.logo} color={f?.color} size={24} />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-1">
              <a href={href.provider(o.provider)} class="mr-0.5 font-medium hover:underline" onclick={(e) => peek(e, { kind: "provider", id: o.provider })}>{f?.name ?? o.provider}</a>
              {#if o.deprecated}<Badge variant="destructive">deprecated</Badge>
              {:else if o.deprecation}<Badge variant="outline" class="text-warn">until {date(o.deprecation)}</Badge>{/if}
              {#if !o.billable}<Badge variant="outline">unpriced</Badge>{/if}
              {#if o.staleSince}<Badge variant="outline" class="text-warn">stale prices</Badge>{/if}
            </div>
            <div class="text-muted-foreground flex items-center gap-0.5 font-mono text-xs">
              <span>{#each breakable(o.bifrostId) as part, i (i)}{part}<wbr />{/each}</span>
              <CopyButton text={o.bifrostId} label="Copy Bifrost model id" />
            </div>
          </div>
          <div class="flex gap-1.5">
            <ScoreBadge score={s?.privacy} label="Privacy" />
            <ScoreBadge score={s?.eco} label="Eco" />
          </div>
        </div>
        <div class="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 pl-9 text-xs">
          {#each [["in", o.other && o.input === undefined ? `${price(o.other.usd)} / ${o.other.per}` : price(o.input)], ["out", price(o.output)], ["cached", o.cached === undefined ? undefined : price(o.cached)]] as [label, value] (label)}
            {#if value}<span class="whitespace-nowrap"><span class="font-mono text-[13px]">{value}</span> <span class="text-muted-foreground">{label}</span></span>{/if}
          {/each}
          <button class="text-muted-foreground hover:text-foreground ml-auto underline-offset-2 hover:underline" onclick={() => (sources = sources === o.id ? null : o.id)}>
            {sources === o.id ? "Hide sources" : "Sources"}
          </button>
        </div>
        {#if sources === o.id}<div class="mt-3 pl-9"><OfferSources offer={o} /></div>{/if}
      </div>
    {/each}
  </div>
{/if}
