<!--
  Up to three models side by side, from the URL: a sticky header with a column per model, then for
  chat models the benchmark strips and the price scatter, then the spec sheet.
-->
<script lang="ts">
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import XIcon from "@lucide/svelte/icons/x";
  import { BENCHMARKS, BENCHMARK_INFO, scoredOn } from "$lib/benchmarks.js";
  import { MAX_COMPARE, SERIES, resolveKeys, specGridColumns, specGridMinWidth, specRows } from "$lib/compare.js";
  import type { ModelGroup } from "$lib/models.js";
  import { app, href } from "$lib/state.svelte.js";
  import type { Benchmark } from "$lib/types.js";
  import BenchmarkField from "../components/BenchmarkField.svelte";
  import Logo from "../components/Logo.svelte";
  import ModelPicker from "../components/ModelPicker.svelte";
  import PriceScatter from "../components/PriceScatter.svelte";
  import SpecSheet from "../components/SpecSheet.svelte";

  /** The group keys from the URL, in order. */
  let { ids }: { ids: string[] } = $props();

  const catalog = $derived(app.catalog!);
  const all = $derived(app.groups(app.offers));
  const keys = $derived(ids.slice(0, MAX_COMPARE));
  const cols = $derived(resolveKeys(keys, all));
  const colors = $derived(cols.map((_, i) => SERIES[i]!));
  const known = $derived(cols.filter((g): g is ModelGroup => g !== undefined));
  const modes = $derived(new Set(known.map((g) => g.mode)));
  const highlights = $derived(cols.flatMap((g, i) => (g ? [{ key: g.key, color: SERIES[i]!, label: g.name, group: g }] : [])));
  const rows = $derived(specRows(cols, { catalog, currency: app.currency.value, providerScores: app.scores }));

  /** The scatter's benchmark; it starts on the table's, but changing it here leaves the table alone. */
  let benchmark = $state<Benchmark>(app.benchmark.value);

  /** Per benchmark, the compared models with a score on it and those without. */
  const strips = $derived(
    BENCHMARKS.map((b) => ({
      b,
      rated: highlights.filter((h) => h.group.scores?.[b]),
      unrated: highlights.filter((h) => !h.group.scores?.[b]).map((h) => h.group.name),
    })),
  );

  const remove = (key: string) => app.replaceCompare(keys.filter((k) => k !== key));
  const add = (key: string) => app.replaceCompare([...keys, key]);

  // On phones the header and the sheet scroll sideways together, so their columns stay lined up.
  let head = $state<HTMLElement>();
  let sheet = $state<HTMLElement>();
  const follow = (from: HTMLElement, to: HTMLElement | null | undefined) => {
    if (to && to.scrollLeft !== from.scrollLeft) to.scrollLeft = from.scrollLeft;
  };
</script>

<a href={href.home} class="text-muted-foreground hover:text-foreground mt-6 inline-flex items-center gap-1.5 text-sm"><ArrowLeftIcon class="size-3.5" /> Models</a>

{#if ids.length > MAX_COMPARE}
  <p class="text-muted-foreground mt-3 text-sm">Showing the first {MAX_COMPARE} of {ids.length}</p>
{/if}

<div class="bg-background/95 sticky top-(--site-header) z-15 mt-4 border-b backdrop-blur">
  <div bind:this={head} class="overflow-x-auto [scrollbar-width:none]" onscroll={() => sheet && follow(head!, sheet.querySelector(".overflow-x-auto"))}>
    <div class="grid" style:grid-template-columns={cols.length ? specGridColumns(cols.length) : "10rem"} style:min-width={specGridMinWidth(cols.length)}>
      <div class="bg-background sticky left-0 z-10 flex flex-col items-start justify-center gap-2 py-3 pr-3">
        <span class="text-muted-foreground text-xs font-medium tracking-wide uppercase">Models</span>
        {#if cols.length < MAX_COMPARE}
          <ModelPicker mode={known[0]?.mode ?? "chat"} exclude={keys} onpick={add} label="+ Add" />
        {/if}
      </div>
      {#each cols as g, i (keys[i])}
        {@const lab = g?.lab ? catalog.labs[g.lab] : undefined}
        <div class="flex min-w-0 items-center gap-2.5 px-3 py-3">
          <span class="size-2.5 shrink-0 rounded-full" style:background-color={colors[i]}></span>
          {#if g}
            <Logo name={lab?.name ?? g.name} logo={lab?.logo} color={lab?.color} size={28} />
            <div class="min-w-0 flex-1">
              <a href={href.model(g.key)} class="block truncate font-medium hover:underline" title={g.name}>{g.name}</a>
              <div class="text-muted-foreground truncate text-xs">{lab?.name ?? "Unattributed"}</div>
            </div>
          {:else}
            <div class="text-muted-foreground min-w-0 flex-1 truncate" title={keys[i]}>Unknown model</div>
          {/if}
          <button
            class="text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 rounded-md p-1"
            aria-label="Remove {g?.name ?? keys[i]}"
            onclick={() => remove(keys[i]!)}
          >
            <XIcon class="size-3.5" />
          </button>
        </div>
      {/each}
    </div>
  </div>
</div>

{#if known.length < 2}
  <p class="text-muted-foreground mt-10 text-center">Add another model to compare</p>
{:else}
  {#if modes.size > 1}
    <p class="bg-muted text-muted-foreground mt-6 rounded-lg px-3 py-2 text-sm">These models are of different types; only their specs are compared</p>
  {:else if known[0]!.mode === "chat"}
    <section class="mt-8 flex flex-col gap-8">
      {#each strips as { b, rated, unrated } (b)}
        <div>
          <h2 class="text-sm font-medium">
            {BENCHMARK_INFO[b].label}{#if unrated.length}<span class="text-muted-foreground font-normal">{` · not rated: ${unrated.join(", ")}`}</span>{/if}
          </h2>
          <BenchmarkField benchmark={b} field={catalog.benchmarks[b]} ours={scoredOn(all, b)} highlights={rated} size="wide" />
        </div>
      {/each}
    </section>
    <section class="mt-10">
      <h2 class="mb-3 text-lg font-semibold tracking-tight">Price vs benchmark</h2>
      <PriceScatter {all} {highlights} bind:benchmark />
    </section>
  {/if}
  <section class="mt-10">
    <h2 class="mb-3 text-lg font-semibold tracking-tight">Specs</h2>
    <div bind:this={sheet} onscrollcapture={(e) => follow(e.target as HTMLElement, head)}>
      <SpecSheet {rows} {colors} />
    </div>
  </section>
{/if}
