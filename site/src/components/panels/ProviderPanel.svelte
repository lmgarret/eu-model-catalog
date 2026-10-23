<script lang="ts">
  import { countryName, flag } from "$lib/format.js";
  import { scoreTone } from "$lib/scores.js";
  import { app } from "$lib/state.svelte.js";
  import KeyFacts from "../KeyFacts.svelte";
  import Logo from "../Logo.svelte";
  import PrivacySteps from "../PrivacySteps.svelte";

  let { id }: { id: string } = $props();

  const provider = $derived(app.catalog!.providers[id]);
  const facts = $derived(provider?.facts);
  const name = $derived(facts?.name ?? id);
  const entity = $derived(facts?.jurisdiction.legal_entity?.value);
  const scores = $derived(app.scores[id]);
  const models = $derived(app.groups(app.offers.filter((o) => o.provider === id && !o.deprecated)).length);
</script>

{#if !provider}
  <p class="text-muted-foreground">Unknown provider “{id}”.</p>
{:else}
  <header class="flex items-center gap-3">
    <Logo {name} logo={facts?.logo} color={facts?.color} size={44} class="rounded-xl" />
    <div class="min-w-0">
      <h2 class="text-xl font-semibold tracking-tight">{name}</h2>
      <p class="text-muted-foreground flex flex-wrap gap-x-3 text-sm">
        {#if entity}<span>{flag(entity.country)} {countryName(entity.country)}</span>{/if}
        {#if facts}<a class="hover:text-foreground" href={facts.website} target="_blank" rel="noreferrer">{new URL(facts.website).host} ↗</a>{/if}
        <span>{models} models</span>
      </p>
    </div>
    <div class="ml-auto flex gap-5">
      {#each [["Privacy", scores?.privacy], ["Eco", scores?.eco]] as const as [label, s] (label)}
        <div class="text-right">
          <span class="block text-3xl leading-none font-semibold tracking-tighter tabular-nums {scoreTone(s?.value)}">{s?.value ?? "–"}</span>
          <span class="text-muted-foreground text-xs">{label}</span>
        </div>
      {/each}
    </div>
  </header>

  {#if facts}
    <div class="mt-6"><KeyFacts {facts} compact /></div>
    {#if facts.privacy_setup.length}
      <div class="mt-7"><PrivacySteps steps={facts.privacy_setup} {name} compact /></div>
    {/if}
  {:else}
    <p class="text-muted-foreground mt-6 text-sm">No facts recorded yet.</p>
  {/if}
{/if}
