<script lang="ts">
  import BracesIcon from "@lucide/svelte/icons/braces";
  import BrainIcon from "@lucide/svelte/icons/brain";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import SlidersHorizontalIcon from "@lucide/svelte/icons/sliders-horizontal";
  import WrenchIcon from "@lucide/svelte/icons/wrench";
  import { BENCHMARKS, BENCHMARK_INFO, SCALE } from "$lib/benchmarks.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import { Slider } from "$lib/components/ui/slider/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { FEATURES, filters } from "$lib/filters.svelte.js";
  import { EUROPE, flag } from "$lib/format.js";
  import { app } from "$lib/state.svelte.js";
  import FilterSelect from "./FilterSelect.svelte";
  import Logo from "./Logo.svelte";

  /** `count`: how many models the current filters show, for the footer button; `disabled` pauses the trigger. */
  let { count, disabled = false }: { count: number; disabled?: boolean } = $props();

  let open = $state(false);

  const catalog = $derived(app.catalog!);
  const providers = $derived(
    Object.entries(catalog.providers).map(([id, p]) => ({ id, name: p.facts?.name ?? id, logo: p.facts?.logo, color: p.facts?.color })),
  );
  const labOptions = $derived(
    Object.entries(catalog.labs)
      .map(([id, l]) => ({ id, name: l.name, logo: l.logo, color: l.color, hint: `${flag(l.country)}${EUROPE.has(l.country) ? " EU" : ""}` }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
  const ICONS = { tools: WrenchIcon, structured: BracesIcon, vision: EyeIcon, reasoning: BrainIcon } as const;

  const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const pill = (on: boolean) =>
    `inline-flex h-7.5 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors ${
      on ? "border-brand/30 bg-brand/10 text-brand" : "hover:bg-muted"
    }`;
</script>

{#snippet slider(label: string, get: () => number, set: (v: number) => void)}
  <div class="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-3 py-2 text-sm">
    {label}
    <Slider type="single" bind:value={get, set} max={100} step={5} />
    <span class="text-right font-mono text-xs {get() ? '' : 'text-muted-foreground'}">{get() ? `≥ ${get()}` : "any"}</span>
  </div>
{/snippet}

{#snippet section(title: string)}
  <h5 class="text-muted-foreground mb-2.5 text-xs font-medium">{title}</h5>
{/snippet}

<Popover.Root bind:open>
  <Popover.Trigger {disabled}>
    {#snippet child({ props })}
      <Button {...props} variant="outline" class="h-10 gap-2 rounded-xl px-4">
        <SlidersHorizontalIcon class="text-muted-foreground" /> Filters
        {#if filters.chips.length}<span class="bg-brand text-brand-foreground rounded-full px-1.5 text-xs leading-4.5 tabular-nums">{filters.chips.length}</span>{/if}
      </Button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content align="end" class="w-[28rem] gap-0 rounded-2xl p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
    <div class="border-b p-4">
      {@render section("Hosted by")}
      <div class="flex flex-wrap gap-1.5">
        {#each providers as p (p.id)}
          <button class="{pill(filters.providers.includes(p.id))} pl-1.5" onclick={() => (filters.providers = toggleIn(filters.providers, p.id))}>
            <Logo name={p.name} logo={p.logo} color={p.color} size={20} class="rounded-full" />
            {p.name}
          </button>
        {/each}
      </div>
    </div>

    <div class="border-b p-4">
      <div class="flex items-start justify-between">
        {@render section("Made by")}
        <FilterSelect label="Labs" options={labOptions} bind:selected={filters.labs} />
      </div>
      <label class="flex items-center justify-between gap-4 py-1.5 text-sm">
        <span>European labs only <span class="text-muted-foreground block text-xs">Based in the EU, EEA or Switzerland</span></span>
        <Switch bind:checked={filters.euLab} />
      </label>
      <label class="flex items-center justify-between gap-4 py-1.5 text-sm">
        Open weights only
        <Switch bind:checked={filters.openWeights} />
      </label>
    </div>

    <div class="border-b p-4">
      {@render section("Can do")}
      <div class="flex flex-wrap gap-1.5">
        {#each FEATURES as [key, label] (key)}
          {@const Icon = ICONS[key]}
          <button class={pill(filters.features.includes(key))} onclick={() => (filters.features = toggleIn(filters.features, key))}>
            <Icon class="size-3.5" />
            {label}
          </button>
        {/each}
      </div>
    </div>

    <div class="border-b p-4">
      {@render section("Minimum score")}
      {#each [["Privacy", "minPrivacy"], ["Eco", "minEco"]] as const as [label, key] (key)}
        {@render slider(label, () => filters[key], (v) => (filters[key] = v))}
      {/each}
    </div>

    <div class="border-b p-4">
      <h5 class="text-muted-foreground mb-2.5 text-xs font-medium" title={SCALE}>
        Benchmarks <span class="text-muted-foreground/70">· a minimum hides models without that score</span>
      </h5>
      {#each BENCHMARKS as b (b)}
        {@render slider(BENCHMARK_INFO[b].label, () => filters.minScores[b], (v) => (filters.minScores[b] = v))}
      {/each}
    </div>

    <div class="p-4">
      {@render section("Also show")}
      <label class="flex items-center justify-between py-1.5 text-sm">
        Deprecated models
        <Switch checked={!filters.hideDeprecated} onCheckedChange={(v) => (filters.hideDeprecated = !v)} />
      </label>
      <label class="flex items-center justify-between py-1.5 text-sm">
        Unpriced models
        <Switch checked={!filters.hideUnpriced} onCheckedChange={(v) => (filters.hideUnpriced = !v)} />
      </label>
    </div>

    <div class="flex items-center justify-between border-t px-4 py-3">
      <Button variant="ghost" onclick={() => filters.reset()}>Reset</Button>
      <Button variant="brand" onclick={() => (open = false)}>Show {count} models</Button>
    </div>
  </Popover.Content>
</Popover.Root>
