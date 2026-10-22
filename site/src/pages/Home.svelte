<script lang="ts">
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import SearchIcon from "@lucide/svelte/icons/search";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Slider } from "$lib/components/ui/slider/index.js";
  import * as Tabs from "$lib/components/ui/tabs/index.js";
  import { Toggle } from "$lib/components/ui/toggle/index.js";
  import { FEATURES, filters } from "$lib/filters.svelte.js";
  import { EUROPE, MODE_LABEL, flag } from "$lib/format.js";
  import { app } from "$lib/state.svelte.js";
  import FilterSelect from "../components/FilterSelect.svelte";
  import ModelsTable from "../components/ModelsTable.svelte";
  import ProvidersTable from "../components/ProvidersTable.svelte";

  const catalog = $derived(app.catalog!);
  const base = $derived(filters.apply(app.offers));
  const modeCounts = $derived(base.reduce<Record<string, number>>((acc, g) => ((acc[g.mode] = (acc[g.mode] ?? 0) + 1), acc), {}));
  const shown = $derived(filters.mode === "all" ? base : base.filter((g) => g.mode === filters.mode));
  const totalGroups = $derived(app.groups(app.offers).length);

  const providerOptions = $derived(
    Object.entries(catalog.providers).map(([id, p]) => ({ id, name: p.facts?.name ?? id, logo: p.facts?.logo, color: p.facts?.color })),
  );
  const labOptions = $derived(
    Object.entries(catalog.labs)
      .map(([id, l]) => ({ id, name: l.name, logo: l.logo, color: l.color, hint: `${flag(l.country)}${EUROPE.has(l.country) ? " EU" : ""}` }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
  const toggleFeature = (key: string) =>
    (filters.features = filters.features.includes(key) ? filters.features.filter((f) => f !== key) : [...filters.features, key]);
</script>

<section class="mt-8">
  <div class="mb-3 flex items-baseline justify-between">
    <h2 class="text-lg font-semibold tracking-tight">Providers</h2>
  </div>
  <ProvidersTable />
</section>

<section class="mt-10">
  <div class="mb-3 flex items-baseline justify-between">
    <h2 class="text-lg font-semibold tracking-tight">Models</h2>
    <span class="text-muted-foreground text-sm">{shown.length} of {totalGroups} models</span>
  </div>

  <div class="mb-4 flex flex-col gap-3">
    <div class="flex flex-wrap items-center gap-2">
      <div class="relative min-w-64 flex-1">
        <SearchIcon class="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input bind:value={filters.q} placeholder="Search models, labs, licenses, Bifrost ids…" class="pl-8" />
      </div>
      <Tabs.Root bind:value={filters.mode}>
        <Tabs.List>
          <Tabs.Trigger value="all">All <span class="text-muted-foreground ml-1 text-xs tabular-nums">{base.length}</span></Tabs.Trigger>
          {#each Object.keys(MODE_LABEL).filter((m) => modeCounts[m]) as m (m)}
            <Tabs.Trigger value={m}>{MODE_LABEL[m]} <span class="text-muted-foreground ml-1 text-xs tabular-nums">{modeCounts[m]}</span></Tabs.Trigger>
          {/each}
        </Tabs.List>
      </Tabs.Root>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <FilterSelect label="Providers" options={providerOptions} bind:selected={filters.providers} />
      <FilterSelect label="Labs" options={labOptions} bind:selected={filters.labs} />
      <Toggle variant="outline" size="sm" bind:pressed={filters.euLab} title="Lab based in the EU, EEA or Switzerland">🇪🇺 European lab</Toggle>
      <Toggle variant="outline" size="sm" bind:pressed={filters.openWeights}>Open weights</Toggle>
      {#each FEATURES as [key, label] (key)}
        <Toggle variant="outline" size="sm" pressed={filters.features.includes(key)} onPressedChange={() => toggleFeature(key)}>{label}</Toggle>
      {/each}
    </div>
    <div class="text-muted-foreground flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
      <label class="flex items-center gap-3">
        <span class="whitespace-nowrap">Privacy ≥ <strong class="text-foreground inline-block w-6 tabular-nums">{filters.minPrivacy}</strong></span>
        <Slider type="single" bind:value={filters.minPrivacy} max={100} step={5} class="w-32" />
      </label>
      <label class="flex items-center gap-3">
        <span class="whitespace-nowrap">Eco ≥ <strong class="text-foreground inline-block w-6 tabular-nums">{filters.minEco}</strong></span>
        <Slider type="single" bind:value={filters.minEco} max={100} step={5} class="w-32" />
      </label>
      <label class="flex items-center gap-2"><Checkbox bind:checked={filters.hideDeprecated} /> Hide deprecated</label>
      <label class="flex items-center gap-2"><Checkbox bind:checked={filters.hideUnpriced} /> Hide unpriced</label>
      <Button variant="ghost" size="sm" class="ml-auto" onclick={() => filters.reset()}><RotateCcwIcon /> Reset</Button>
    </div>
  </div>

  <ModelsTable groups={shown} />
</section>
