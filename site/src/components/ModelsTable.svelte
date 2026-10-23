<script lang="ts">
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import AudioLinesIcon from "@lucide/svelte/icons/audio-lines";
  import BracesIcon from "@lucide/svelte/icons/braces";
  import BrainIcon from "@lucide/svelte/icons/brain";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import WrenchIcon from "@lucide/svelte/icons/wrench";
  import { BENCHMARKS, BENCHMARK_INFO, SCALE } from "$lib/benchmarks.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import { MODE_LABEL, breakable, date, fromUsd, money, tokens } from "$lib/format.js";
  import { type ModelGroup, compareBy, groupStats } from "$lib/models.js";
  import { picks } from "$lib/picks.svelte.js";
  import { app, href, peek } from "$lib/state.svelte.js";
  import type { Benchmark } from "$lib/types.js";
  import BenchmarkCell from "./BenchmarkCell.svelte";
  import CopyButton from "./CopyButton.svelte";
  import Logo from "./Logo.svelte";
  import ScoreBadge from "./ScoreBadge.svelte";

  /** `showLab` is off on a lab's own page, where every row has the same lab. */
  let { groups, showLab = true }: { groups: ModelGroup[]; showLab?: boolean } = $props();

  type SortKey = "name" | "hosts" | "input" | "output" | "bench" | "context" | "privacy" | "eco";
  let sort = $state<{ key: SortKey; dir: 1 | -1 }>({ key: "hosts", dir: -1 });
  const bench = app.benchmark;
  let open = $state<Set<string>>(new Set());

  const catalog = $derived(app.catalog!);
  const mixedModes = $derived(new Set(groups.map((g) => g.mode)).size > 1);
  const bestScore = (g: ModelGroup, kind: "privacy" | "eco") =>
    g.offers.map((o) => app.scores[o.provider]?.[kind]).filter((s) => s !== undefined).sort((a, b) => b.value - a.value)[0];

  const KEY: Record<SortKey, (g: ModelGroup) => string | number | undefined> = {
    name: (g) => g.name.toLowerCase(),
    hosts: (g) => g.offers.length,
    input: (g) => groupStats(g).input,
    output: (g) => groupStats(g).output,
    bench: (g) => g.scores?.[bench.value]?.percentile,
    context: (g) => groupStats(g).context,
    privacy: (g) => bestScore(g, "privacy")?.value,
    eco: (g) => bestScore(g, "eco")?.value,
  };
  // Ties keep a stable, readable order: by name.
  const sorted = $derived(
    [...groups].sort((a, b) => compareBy(KEY[sort.key], sort.dir)(a, b) || a.name.localeCompare(b.name)),
  );

  function sortBy(key: SortKey) {
    const first = ["hosts", "bench", "privacy", "eco", "context"].includes(key) ? -1 : 1;
    sort = sort.key === key ? { key, dir: sort.dir === 1 ? -1 : 1 } : { key, dir: first };
  }

  function pickBenchmark(b: Benchmark) {
    bench.value = b;
    sort = { key: "bench", dir: -1 };
  }

  function toggle(key: string) {
    const next = new Set(open);
    if (!next.delete(key)) next.add(key);
    open = next;
  }

  const price = (usd: number | undefined) =>
    usd === undefined ? undefined : money(fromUsd(usd, app.currency.value, catalog.exchange_rates), app.currency.value);

  // Fixed widths, so expanding a row never moves the columns; the model column takes the rest.
  const COLUMNS: { key?: SortKey; label: string; class?: string; title?: string }[] = [
    { label: "", class: "w-10" },
    { key: "name", label: "Model" },
    { key: "hosts", label: "Hosts", class: "w-24" },
    { key: "input", label: "Input /1M", class: "w-28 text-right", title: "Cheapest per 1M tokens, or per unit shown" },
    { key: "output", label: "Output /1M", class: "w-24 text-right", title: "Cheapest per 1M tokens" },
    { key: "bench", label: "Benchmark", class: "w-32", title: `Benchmark of the lab's model, chat models only. ${SCALE}` },
    { key: "context", label: "Context", class: "w-20 text-right" },
    { label: "", class: "w-30" },
    { key: "privacy", label: "Privacy", class: "w-18 text-center", title: "Best host's privacy score" },
    { key: "eco", label: "Eco", class: "w-16 text-center", title: "Best host's sustainability score" },
  ];
  const FEATURES = [
    ["tools", "Tool calling", WrenchIcon],
    ["structured", "Structured output", BracesIcon],
    ["vision", "Image input", EyeIcon],
    ["audio", "Audio input", AudioLinesIcon],
    ["reasoning", "Reasoning", BrainIcon],
  ] as const;
</script>

{#snippet sortButton(key: SortKey, label: string)}
  <button class="hover:text-foreground inline-flex items-center gap-1 {sort.key === key ? 'text-foreground' : ''}" onclick={() => sortBy(key)}>
    {label}
    {#if sort.key === key}
      {#if sort.dir === 1}<ArrowUpIcon class="size-3" />{:else}<ArrowDownIcon class="size-3" />{/if}
    {/if}
  </button>
{/snippet}

<Table.Root class="min-w-[66rem] table-fixed">
  <Table.Header>
    <Table.Row class="hover:bg-transparent">
      {#each COLUMNS as c, i (i)}
        <Table.Head class="text-muted-foreground h-10 px-3 text-xs font-medium {c.class ?? ''}" title={c.title}>
          {#if c.key === "bench"}
            <span class="inline-flex items-center gap-0.5">
              {@render sortButton("bench", BENCHMARK_INFO[bench.value].label)}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger class="hover:text-foreground rounded p-0.5" title="Pick a benchmark">
                  <ChevronDownIcon class="size-3.5" />
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="start" class="w-80">
                  <DropdownMenu.RadioGroup value={bench.value} onValueChange={(v) => pickBenchmark(v as Benchmark)}>
                    {#each BENCHMARKS as b (b)}
                      <DropdownMenu.RadioItem value={b} closeOnSelect class="items-start">
                        <div>
                          <div class="font-medium">{BENCHMARK_INFO[b].label}</div>
                          <div class="text-muted-foreground text-xs">{BENCHMARK_INFO[b].about}</div>
                        </div>
                      </DropdownMenu.RadioItem>
                    {/each}
                  </DropdownMenu.RadioGroup>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </span>
          {:else if c.key}
            {@render sortButton(c.key, c.label)}
          {:else}
            {c.label}
          {/if}
        </Table.Head>
      {/each}
      <Table.Head class="w-8"></Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#each sorted as g (g.key)}
      {@const lab = g.lab ? catalog.labs[g.lab] : undefined}
      {@const stats = groupStats(g)}
      {@const isOpen = open.has(g.key)}
      {@const allDeprecated = g.offers.every((o) => o.deprecated)}
      <Table.Row class="cursor-pointer {allDeprecated ? 'opacity-55' : ''}" data-state={isOpen ? "selected" : undefined} onclick={() => toggle(g.key)}>
        <!-- Ticking a model never expands its row. -->
        <Table.Cell class="pr-0 pl-3" onclick={(e) => e.stopPropagation()}>
          <Checkbox checked={picks.has(g.key)} onCheckedChange={() => picks.toggle(g.key)} aria-label="Select {g.name}" />
        </Table.Cell>
        <Table.Cell class="px-3 py-3 whitespace-normal">
          <div class="flex min-w-56 items-center gap-3">
            {#if showLab}<Logo name={lab?.name ?? g.name} logo={lab?.logo} color={lab?.color} size={28} />{/if}
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 font-medium">
                <a href={href.model(g.key)} class="hover:underline" onclick={(e) => peek(e, { kind: "model", id: g.key })}>{g.name}</a>
                {#if allDeprecated}<Badge variant="destructive">deprecated</Badge>{/if}
              </div>
              <div class="text-muted-foreground/80 text-xs">
                {#if showLab}
                  {#if lab && g.lab}
                    <a href={href.lab(g.lab)} class="hover:text-foreground hover:underline" onclick={(e) => peek(e, { kind: "lab", id: g.lab! })}>{lab.name}</a>
                  {:else}
                    <span title="No lab claims this model yet">Unattributed</span>
                  {/if}
                {/if}
                {#if g.license || g.openWeights !== undefined}
                  {#if showLab}·{/if}
                  <span
                    class={g.openWeights ? "text-good" : ""}
                    title="{g.license ?? ''}{g.openWeights ? ', open weights' : g.openWeights === false ? ', closed weights' : ''}"
                  >
                    {g.license ?? (g.openWeights ? "Open weights" : "Closed weights")}
                  </span>
                {/if}
                {#if mixedModes}· {MODE_LABEL[g.mode] ?? g.mode}{/if}
              </div>
            </div>
          </div>
        </Table.Cell>
        <Table.Cell class="px-3">
          <div class="flex items-center gap-1">
            <span class="flex -space-x-1">
              {#each [...new Set(g.offers.map((o) => o.provider))] as p (p)}
                {@const f = catalog.providers[p]?.facts}
                <a href={href.provider(p)} onclick={(e) => peek(e, { kind: "provider", id: p })}>
                  <Logo name={f?.name ?? p} logo={f?.logo} color={f?.color} size={22} class="ring-background ring-2" />
                </a>
              {/each}
            </span>
            {#if g.offers.length === 1}<CopyButton text={g.offers[0]!.bifrostId} label="Copy Bifrost model id" />{/if}
          </div>
        </Table.Cell>
        <Table.Cell class="px-3 text-right font-mono text-[13px] tabular-nums">
          {#if stats.input !== undefined}
            {#if g.offers.length > 1}<span class="text-muted-foreground/70 mr-1 font-sans text-xs">from</span>{/if}{price(stats.input)}{#if g.offers.every((o) => o.input === undefined && o.other)}<span class="text-muted-foreground font-sans text-xs"> / {g.offers.find((o) => o.other)?.other?.per}</span>{/if}
          {:else}<span class="text-muted-foreground">–</span>{/if}
        </Table.Cell>
        <Table.Cell class="px-3 text-right font-mono text-[13px] tabular-nums">
          {#if stats.output !== undefined}{price(stats.output)}{:else}<span class="text-muted-foreground">–</span>{/if}
        </Table.Cell>
        <Table.Cell class="px-3">
          <BenchmarkCell group={g} benchmark={bench.value} />
        </Table.Cell>
        <Table.Cell class="px-3 text-right font-mono text-[13px] tabular-nums">{tokens(stats.context)}</Table.Cell>
        <Table.Cell class="px-3">
          <div class="text-muted-foreground/70 flex gap-1.5">
            {#each FEATURES as [key, label, Icon] (key)}
              {#if g[key]}<span title={label}><Icon class="size-3.5" /></span>{/if}
            {/each}
          </div>
        </Table.Cell>
        <Table.Cell class="px-3 text-center"><ScoreBadge score={bestScore(g, "privacy")} label="Privacy" /></Table.Cell>
        <Table.Cell class="px-3 text-center"><ScoreBadge score={bestScore(g, "eco")} label="Eco" /></Table.Cell>
        <Table.Cell class="pr-3 pl-0">
          <ChevronDownIcon class="text-muted-foreground/60 size-4 transition-transform {isOpen ? 'rotate-180' : ''}" />
        </Table.Cell>
      </Table.Row>

      {#if isOpen}
        {#each g.offers as o (o.id)}
          {@const f = catalog.providers[o.provider]?.facts}
          {@const s = app.scores[o.provider]}
          <Table.Row class="bg-muted/30 hover:bg-muted/40 {o.deprecated ? 'opacity-55' : ''}">
            <Table.Cell></Table.Cell>
            <Table.Cell colspan={2} class="px-3 py-2.5 whitespace-normal">
              <div class="flex items-center gap-2.5 {showLab ? 'pl-10' : ''}">
                <a href={href.provider(o.provider)} title="{f?.name ?? o.provider} fact sheet" onclick={(e) => peek(e, { kind: "provider", id: o.provider })}>
                  <Logo name={f?.name ?? o.provider} logo={f?.logo} color={f?.color} size={20} />
                </a>
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-1">
                    <a href={href.provider(o.provider)} class="mr-0.5 text-sm hover:underline" onclick={(e) => peek(e, { kind: "provider", id: o.provider })}>{f?.name ?? o.provider}</a>
                    {#if o.deprecated}<Badge variant="destructive">deprecated</Badge>
                    {:else if o.deprecation}<Badge variant="outline" class="text-warn" title="Deprecation date">until {date(o.deprecation)}</Badge>{/if}
                    {#if !o.billable}<Badge variant="outline" title="No source prices it, so it's not in pricing.json">unpriced</Badge>{/if}
                    {#if o.staleSince}<Badge variant="outline" class="text-warn" title="Prices reused from an earlier build">stale prices</Badge>{/if}
                  </div>
                  <div class="text-muted-foreground flex items-center gap-0.5 font-mono text-xs">
                    <!-- Long ids wrap at / and -, so expanding a row never widens the table. -->
                    <span>{#each breakable(o.bifrostId) as part, i (i)}{part}<wbr />{/each}</span>
                    <CopyButton text={o.bifrostId} label="Copy Bifrost model id" />
                  </div>
                </div>
              </div>
            </Table.Cell>
            <Table.Cell class="px-3 text-right font-mono text-[13px] tabular-nums">
              {#if o.input !== undefined}
                {price(o.input)}
                {#if o.cached !== undefined}<div class="text-muted-foreground text-xs">{price(o.cached)} <span class="font-sans">cached</span></div>{/if}
              {:else if o.other}
                {price(o.other.usd)}<span class="text-muted-foreground font-sans text-xs"> / {o.other.per}</span>
              {:else}<span class="text-muted-foreground">–</span>{/if}
            </Table.Cell>
            <Table.Cell class="px-3 text-right font-mono text-[13px] tabular-nums">{#if o.output !== undefined}{price(o.output)}{:else}<span class="text-muted-foreground">–</span>{/if}</Table.Cell>
            <Table.Cell></Table.Cell>
            <Table.Cell class="px-3 text-right font-mono text-[13px] tabular-nums">
              {tokens(o.context)}
              {#if o.maxOutput}<div class="text-muted-foreground text-xs">{tokens(o.maxOutput)} <span class="font-sans">out</span></div>{/if}
            </Table.Cell>
            <Table.Cell class="px-3">
              <a href={href.model(g.key)} class="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline" onclick={(e) => peek(e, { kind: "model", id: g.key })}>
                Details
              </a>
            </Table.Cell>
            <Table.Cell class="px-3 text-center"><ScoreBadge score={s?.privacy} label="Privacy" /></Table.Cell>
            <Table.Cell class="px-3 text-center"><ScoreBadge score={s?.eco} label="Eco" /></Table.Cell>
            <Table.Cell></Table.Cell>
          </Table.Row>
        {/each}
      {/if}
    {:else}
      <Table.Row>
        <Table.Cell colspan={COLUMNS.length + 1} class="text-muted-foreground h-24 text-center">No model matches these filters.</Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>
