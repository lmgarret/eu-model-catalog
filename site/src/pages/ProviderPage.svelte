<script lang="ts">
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import { claimStats, factSections } from "$lib/facts.js";
  import { countryName, flag } from "$lib/format.js";
  import { scoreTone } from "$lib/scores.js";
  import { app, href } from "$lib/state.svelte.js";
  import FactsGrid from "../components/FactsGrid.svelte";
  import KeyFacts from "../components/KeyFacts.svelte";
  import Logo from "../components/Logo.svelte";
  import ModelsTable from "../components/ModelsTable.svelte";
  import PrivacySteps from "../components/PrivacySteps.svelte";
  import ScoreWhy from "../components/ScoreWhy.svelte";

  let { id, onTune }: { id: string; onTune: () => void } = $props();

  let tab = $state<"overview" | "facts" | "models">("overview");

  const provider = $derived(app.catalog!.providers[id]);
  const facts = $derived(provider?.facts);
  const name = $derived(facts?.name ?? id);
  const entity = $derived(facts?.jurisdiction.legal_entity?.value);
  const groups = $derived(app.groups(app.offers.filter((o) => o.provider === id && !o.deprecated)));
  const scores = $derived(app.scores[id]);
  const stats = $derived(facts && claimStats(facts));
  const known = $derived(facts ? factSections(facts).flatMap((s) => s.rows).filter((r) => r.text).length : 0);
  const TABS = $derived([
    { value: "overview", label: "Overview" },
    { value: "facts", label: "Fact sheet", count: known },
    { value: "models", label: "Models", count: groups.length },
  ] as const);
</script>

<a href={href.providers} class="text-muted-foreground hover:text-foreground mt-6 inline-flex items-center gap-1.5 text-sm"><ArrowLeftIcon class="size-3.5" /> Providers</a>

{#if !provider}
  <p class="text-muted-foreground mt-10">Unknown provider “{id}”.</p>
{:else}
  <header class="mt-5 flex flex-wrap items-center gap-4">
    <Logo {name} logo={facts?.logo} color={facts?.color} size={56} class="rounded-2xl" />
    <div>
      <h1 class="text-3xl font-semibold tracking-tight">{name}</h1>
      <p class="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-4 text-sm">
        {#if entity}<span>{flag(entity.country)} {countryName(entity.country)}</span>{/if}
        {#if facts}<a class="hover:text-foreground" href={facts.website} target="_blank" rel="noreferrer">{new URL(facts.website).host} ↗</a>{/if}
        <span>Bifrost <code class="bg-muted text-foreground rounded-md px-1.5 py-0.5 font-mono text-xs">{provider.bifrost_provider}</code></span>
      </p>
    </div>
    <div class="ml-auto flex gap-7">
      {#each [["Privacy", scores?.privacy], ["Eco", scores?.eco]] as const as [label, s] (label)}
        <button class="text-right" onclick={onTune} title={s ? `${Math.round(s.coverage * 100)}% of the weight known` : "No facts"}>
          <span class="block text-4xl leading-none font-semibold tracking-tighter tabular-nums {scoreTone(s?.value)}">{s?.value ?? "–"}</span>
          <span class="text-muted-foreground text-xs">{label}</span>
        </button>
      {/each}
    </div>
  </header>

  <div class="mt-7 flex gap-6 border-b text-sm" role="tablist">
    {#each TABS as t (t.value)}
      <button
        role="tab"
        aria-selected={tab === t.value}
        class="-mb-px border-b-2 pb-2.5 transition-colors {tab === t.value ? 'border-brand text-foreground' : 'text-muted-foreground hover:text-foreground border-transparent'}"
        onclick={() => (tab = t.value)}
      >
        {t.label}{#if "count" in t}<span class="text-muted-foreground/70 ml-1.5 text-xs tabular-nums">{t.count}</span>{/if}
      </button>
    {/each}
  </div>

  {#if tab === "overview"}
    {#if facts}
      <div class="mt-6"><KeyFacts {facts} /></div>
      <div class="mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-[1.15fr_1fr]">
        <div><PrivacySteps steps={facts.privacy_setup} {name} /></div>
        <div class="flex flex-col gap-10">
          <div><ScoreWhy score={scores?.privacy} label="Privacy" {onTune} /></div>
          <div><ScoreWhy score={scores?.eco} label="Eco" /></div>
        </div>
      </div>
    {:else}
      <p class="text-muted-foreground mt-6">No facts recorded yet. Add <code>providers/{id}.yaml</code>.</p>
    {/if}
  {:else if tab === "facts"}
    <div class="mt-6">
      {#if facts}<FactsGrid {facts} />{:else}<p class="text-muted-foreground">No facts recorded yet.</p>{/if}
    </div>
  {:else}
    <div class="mt-3"><ModelsTable {groups} /></div>
  {/if}

  {#if stats}
    <p class="text-muted-foreground/80 mt-10 flex items-center gap-2 text-xs">
      <span class="bg-muted-foreground/30 size-1.5 rounded-full"></span>
      Mostly {name}'s own claims, not independently verified; each links to its source.
      {#if stats.stale}<span class="text-warn">{stats.stale} of {stats.total} checked over 6 months ago.</span>{/if}
    </p>
  {/if}
{/if}
