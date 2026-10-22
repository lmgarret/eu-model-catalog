<script lang="ts">
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
  import { countryName, flag } from "$lib/format.js";
  import { app, href } from "$lib/state.svelte.js";
  import FactsGrid from "../components/FactsGrid.svelte";
  import Logo from "../components/Logo.svelte";
  import ModelsTable from "../components/ModelsTable.svelte";
  import PrivacyGuide from "../components/PrivacyGuide.svelte";
  import ScoreBreakdown from "../components/ScoreBreakdown.svelte";

  let { id, onTune }: { id: string; onTune: () => void } = $props();

  const provider = $derived(app.catalog!.providers[id]);
  const facts = $derived(provider?.facts);
  const name = $derived(facts?.name ?? id);
  const entity = $derived(facts?.jurisdiction.legal_entity?.value);
  const groups = $derived(app.groups(app.offers.filter((o) => o.provider === id && !o.deprecated)));
</script>

<a href={href.home} class="text-muted-foreground hover:text-foreground mt-6 inline-flex items-center gap-1 text-sm"><ArrowLeftIcon class="size-4" /> All providers</a>

{#if !provider}
  <p class="text-muted-foreground mt-10">Unknown provider “{id}”.</p>
{:else}
  <header class="mt-4 flex flex-wrap items-center gap-4">
    <Logo {name} logo={facts?.logo} color={facts?.color} size={56} />
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">{name}</h1>
      <p class="text-muted-foreground flex flex-wrap items-center gap-x-3 text-sm">
        {#if entity}<span>{flag(entity.country)} {entity.name}, {countryName(entity.country)}</span>{/if}
        {#if facts}<a class="hover:text-foreground inline-flex items-center gap-1" href={facts.website} target="_blank" rel="noreferrer">{new URL(facts.website).host} <ExternalLinkIcon class="size-3" /></a>{/if}
        <span>Bifrost provider <code class="font-mono">{provider.bifrost_provider}</code></span>
      </p>
    </div>
  </header>

  <p class="bg-warn/10 text-foreground mt-6 rounded-lg border border-(--warn)/25 px-4 py-3 text-sm">
    These are mostly <strong>{name}'s own claims</strong>, not independently verified. Each links to the page it
    comes from; claims checked over 6 months ago are marked stale.
  </p>

  {#if facts}
    <div class="mt-6 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <PrivacyGuide steps={facts.privacy_setup} {name} />
      <div class="flex flex-col gap-4">
        <ScoreBreakdown score={app.scores[id]?.privacy} label="Privacy" {onTune} />
        <ScoreBreakdown score={app.scores[id]?.eco} label="Eco" {onTune} />
      </div>
    </div>
    <h2 class="mt-10 mb-3 text-lg font-semibold tracking-tight">Fact sheet</h2>
    <FactsGrid {facts} />
  {:else}
    <p class="text-muted-foreground mt-6">No facts recorded yet. Add <code>providers/{id}.yaml</code>.</p>
  {/if}

  <h2 class="mt-10 mb-3 text-lg font-semibold tracking-tight">Models <span class="text-muted-foreground text-sm font-normal">{groups.length}</span></h2>
  <ModelsTable {groups} />
{/if}
