<script lang="ts">
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { isStale } from "$lib/facts.js";
  import { EUROPE, countryName, date, flag } from "$lib/format.js";
  import { app, href } from "$lib/state.svelte.js";
  import Logo from "../components/Logo.svelte";
  import ModelsTable from "../components/ModelsTable.svelte";

  let { id }: { id: string } = $props();

  const lab = $derived(app.catalog!.labs[id]);
  const groups = $derived(app.groups(app.offers.filter((o) => o.m.info.lab?.value === id && !o.deprecated)));
  const AI_ACT = {
    signatory: "Signed the EU GPAI Code of Practice",
    partial: "Partly signed the EU GPAI Code of Practice",
    not_signatory: "Did not sign the EU GPAI Code of Practice",
  } as const;
</script>

<a href={href.home} class="text-muted-foreground hover:text-foreground mt-6 inline-flex items-center gap-1 text-sm"><ArrowLeftIcon class="size-4" /> All models</a>

{#if !lab}
  <p class="text-muted-foreground mt-10">Unknown lab “{id}”.</p>
{:else}
  <header class="mt-4 flex flex-wrap items-center gap-4">
    <Logo name={lab.name} logo={lab.logo} color={lab.color} size={56} />
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">{lab.name}</h1>
      <p class="text-muted-foreground flex flex-wrap items-center gap-x-3 text-sm">
        <span>{flag(lab.country)} {countryName(lab.country)}{EUROPE.has(lab.country) ? " · European lab" : ""}</span>
        <a class="hover:text-foreground inline-flex items-center gap-1" href={lab.website} target="_blank" rel="noreferrer">{new URL(lab.website).host} <ExternalLinkIcon class="size-3" /></a>
      </p>
    </div>
  </header>

  {#if lab.eu_ai_act}
    <div class="mt-6 flex flex-wrap items-center gap-2 text-sm">
      <Badge variant="outline" class={lab.eu_ai_act.value === "signatory" ? "text-good" : lab.eu_ai_act.value === "not_signatory" ? "text-bad" : "text-warn"}>
        EU AI Act
      </Badge>
      {AI_ACT[lab.eu_ai_act.value]}
      <span class="text-muted-foreground text-xs">
        · <a class="underline underline-offset-2" href={lab.eu_ai_act.source} target="_blank" rel="noreferrer">source</a>, checked {date(lab.eu_ai_act.checked)}
        {#if isStale(lab.eu_ai_act.checked)}<Badge variant="outline" class="text-warn ml-1">stale</Badge>{/if}
      </span>
    </div>
    {#if lab.eu_ai_act.note}<p class="text-muted-foreground mt-1 text-xs">{lab.eu_ai_act.note}</p>{/if}
  {/if}

  <h2 class="mt-10 mb-3 text-lg font-semibold tracking-tight">
    Models hosted by EU providers <span class="text-muted-foreground text-sm font-normal">{groups.length}</span>
  </h2>
  <ModelsTable {groups} />
{/if}
