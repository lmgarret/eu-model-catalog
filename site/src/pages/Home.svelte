<script lang="ts">
  import SearchIcon from "@lucide/svelte/icons/search";
  import XIcon from "@lucide/svelte/icons/x";
  import { Input } from "$lib/components/ui/input/index.js";
  import { filters } from "$lib/filters.svelte.js";
  import { MODE_LABEL } from "$lib/format.js";
  import { picks } from "$lib/picks.svelte.js";
  import { app, href } from "$lib/state.svelte.js";
  import FiltersPanel from "../components/FiltersPanel.svelte";
  import ModelsTable from "../components/ModelsTable.svelte";
  import PillTabs from "../components/PillTabs.svelte";

  const catalog = $derived(app.catalog!);
  const base = $derived(filters.apply(app.offers));
  const modeCounts = $derived(base.reduce<Record<string, number>>((acc, g) => ((acc[g.mode] = (acc[g.mode] ?? 0) + 1), acc), {}));
  // "Show only selected" ignores search, filters and the type, so a pick never disappears.
  const shown = $derived(picks.only ? picks.groups : filters.mode === "all" ? base : base.filter((g) => g.mode === filters.mode));
  const totalGroups = $derived(app.groups(app.offers.filter((o) => !o.deprecated)).length);
  const labCount = $derived(new Set(app.groups(app.offers).map((g) => g.lab).filter(Boolean)).size);
  const modes = $derived([
    { value: "all", label: "All", count: base.length },
    ...Object.keys(MODE_LABEL)
      .filter((m) => modeCounts[m])
      .map((m) => ({ value: m, label: MODE_LABEL[m]!, count: modeCounts[m] })),
  ]);
</script>

<section class="pt-14 pb-10">
  <h1 class="text-4xl font-semibold tracking-tighter sm:text-[44px] sm:leading-[1.05]">
    AI models, <span class="text-brand">hosted in Europe.</span>
  </h1>
  <p class="text-muted-foreground mt-3.5 text-[15px]">
    {totalGroups} models from <a href={href.labs} class="text-foreground border-b hover:border-current">{labCount} labs</a>, served by
    <a href={href.providers} class="text-foreground border-b hover:border-current">{Object.keys(catalog.providers).length} European providers</a>.
    Compare price, privacy and footprint.
  </p>
</section>

<!-- The disabled controls ignore the pointer, so the title sits on their row. -->
<div class="flex items-center gap-2" title={picks.only ? "Paused while showing selected" : undefined}>
  <div class="relative flex-1">
    <SearchIcon class="text-muted-foreground absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
    <Input bind:value={filters.q} placeholder="Search models, labs, licenses, Bifrost ids…" class="h-10 rounded-xl pl-10" disabled={picks.only} />
  </div>
  <FiltersPanel count={shown.length} disabled={picks.only} />
</div>

<div class="mt-3.5 flex flex-wrap items-center justify-between gap-2">
  {#if picks.only}
    <button class="bg-brand/10 text-brand hover:bg-brand/15 inline-flex items-center gap-1 rounded-full py-1 pr-2 pl-3 text-xs" onclick={() => (picks.only = false)}>
      Selected only ({shown.length}) <XIcon class="size-3" />
    </button>
  {:else}
    <PillTabs options={modes} bind:value={filters.mode} />
  {/if}
  <span class="text-muted-foreground text-sm tabular-nums">{shown.length} of {totalGroups}</span>
</div>

{#if filters.chips.length && !picks.only}
  <div class="mt-3 flex flex-wrap items-center gap-1.5">
    {#each filters.chips as chip (chip.label)}
      <button class="bg-brand/10 text-brand hover:bg-brand/15 inline-flex items-center gap-1 rounded-full py-1 pr-2 pl-3 text-xs" onclick={chip.clear}>
        {chip.label} <XIcon class="size-3" />
      </button>
    {/each}
    <button class="text-muted-foreground hover:text-foreground px-2 text-xs" onclick={() => filters.reset()}>Clear all</button>
  </div>
{/if}

<div class="mt-3">
  <ModelsTable groups={shown} />
</div>
