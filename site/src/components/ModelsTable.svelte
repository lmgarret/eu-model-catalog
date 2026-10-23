<script lang="ts">
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import AudioLinesIcon from "@lucide/svelte/icons/audio-lines";
  import BracesIcon from "@lucide/svelte/icons/braces";
  import BrainIcon from "@lucide/svelte/icons/brain";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import WrenchIcon from "@lucide/svelte/icons/wrench";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import { MODE_LABEL, date, fromUsd, money, tokens } from "$lib/format.js";
  import { type ModelGroup, compareBy, groupStats } from "$lib/models.js";
  import { app, href } from "$lib/state.svelte.js";
  import CopyButton from "./CopyButton.svelte";
  import Logo from "./Logo.svelte";
  import OfferSources from "./OfferSources.svelte";
  import ScoreBadge from "./ScoreBadge.svelte";

  /** `showLab` is off on a lab's own page, where every row has the same lab. */
  let { groups, showLab = true }: { groups: ModelGroup[]; showLab?: boolean } = $props();

  type SortKey = "name" | "hosts" | "input" | "output" | "context" | "privacy" | "eco";
  let sort = $state<{ key: SortKey; dir: 1 | -1 }>({ key: "hosts", dir: -1 });
  let open = $state<Set<string>>(new Set());
  let sources = $state<string | null>(null);

  const catalog = $derived(app.catalog!);
  const mixedModes = $derived(new Set(groups.map((g) => g.mode)).size > 1);
  const bestScore = (g: ModelGroup, kind: "privacy" | "eco") =>
    g.offers.map((o) => app.scores[o.provider]?.[kind]).filter((s) => s !== undefined).sort((a, b) => b.value - a.value)[0];

  const KEY: Record<SortKey, (g: ModelGroup) => string | number | undefined> = {
    name: (g) => g.name.toLowerCase(),
    hosts: (g) => g.offers.length,
    input: (g) => groupStats(g).input,
    output: (g) => groupStats(g).output,
    context: (g) => groupStats(g).context,
    privacy: (g) => bestScore(g, "privacy")?.value,
    eco: (g) => bestScore(g, "eco")?.value,
  };
  // Ties keep a stable, readable order: by name.
  const sorted = $derived(
    [...groups].sort((a, b) => compareBy(KEY[sort.key], sort.dir)(a, b) || a.name.localeCompare(b.name)),
  );

  function sortBy(key: SortKey) {
    const first = ["hosts", "privacy", "eco", "context"].includes(key) ? -1 : 1;
    sort = sort.key === key ? { key, dir: sort.dir === 1 ? -1 : 1 } : { key, dir: first };
  }

  function toggle(key: string) {
    const next = new Set(open);
    if (!next.delete(key)) next.add(key);
    open = next;
  }

  const price = (usd: number | undefined) =>
    usd === undefined ? undefined : money(fromUsd(usd, app.currency.value, catalog.exchange_rates), app.currency.value);

  const COLUMNS: { key?: SortKey; label: string; class?: string; title?: string }[] = [
    { key: "name", label: "Model" },
    { key: "hosts", label: "Hosts" },
    { key: "input", label: "Input /1M", class: "text-right", title: "Cheapest per 1M tokens, or per unit shown" },
    { key: "output", label: "Output /1M", class: "text-right", title: "Cheapest per 1M tokens" },
    { key: "context", label: "Context", class: "text-right" },
    { label: "" },
    { key: "privacy", label: "Privacy", class: "text-center", title: "Best host's privacy score" },
    { key: "eco", label: "Eco", class: "text-center", title: "Best host's sustainability score" },
  ];
  const FEATURES = [
    ["tools", "Tool calling", WrenchIcon],
    ["structured", "Structured output", BracesIcon],
    ["vision", "Image input", EyeIcon],
    ["audio", "Audio input", AudioLinesIcon],
    ["reasoning", "Reasoning", BrainIcon],
  ] as const;
</script>

<Table.Root>
  <Table.Header>
    <Table.Row class="hover:bg-transparent">
      {#each COLUMNS as c, i (i)}
        <Table.Head class="text-muted-foreground h-10 px-3 text-xs font-medium {c.class ?? ''}" title={c.title}>
          {#if c.key}
            {@const key = c.key}
            <button class="hover:text-foreground inline-flex items-center gap-1 {sort.key === key ? 'text-foreground' : ''}" onclick={() => sortBy(key)}>
              {c.label}
              {#if sort.key === key}
                {#if sort.dir === 1}<ArrowUpIcon class="size-3" />{:else}<ArrowDownIcon class="size-3" />{/if}
              {/if}
            </button>
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
        <Table.Cell class="px-3 py-3">
          <div class="flex min-w-56 items-center gap-3">
            {#if showLab}<Logo name={lab?.name ?? g.name} logo={lab?.logo} color={lab?.color} size={28} />{/if}
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 font-medium">
                {g.name}
                {#if allDeprecated}<Badge variant="destructive">deprecated</Badge>{/if}
              </div>
              <div class="text-muted-foreground/80 text-xs">
                {#if showLab}
                  {#if lab && g.lab}
                    <a href={href.lab(g.lab)} class="hover:text-foreground hover:underline" onclick={(e) => e.stopPropagation()}>{lab.name}</a>
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
                <a href={href.provider(p)} onclick={(e) => e.stopPropagation()}>
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
        <Table.Cell class="px-3 text-right font-mono text-[13px] tabular-nums">{tokens(stats.context)}</Table.Cell>
        <Table.Cell class="px-3">
          <div class="text-muted-foreground/70 flex gap-2">
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
            <Table.Cell class="px-3 py-2.5">
              <div class="flex items-center gap-2.5 {showLab ? 'pl-10' : ''}">
                <a href={href.provider(o.provider)} title="{f?.name ?? o.provider} fact sheet">
                  <Logo name={f?.name ?? o.provider} logo={f?.logo} color={f?.color} size={20} />
                </a>
                <div class="min-w-0">
                  <a href={href.provider(o.provider)} class="text-sm hover:underline">{f?.name ?? o.provider}</a>
                  <div class="text-muted-foreground flex items-center gap-0.5 font-mono text-xs">
                    {o.bifrostId}
                    <CopyButton text={o.bifrostId} label="Copy Bifrost model id" />
                  </div>
                </div>
              </div>
            </Table.Cell>
            <Table.Cell class="px-3">
              <div class="flex flex-wrap gap-1">
                {#if o.deprecated}<Badge variant="destructive">deprecated</Badge>
                {:else if o.deprecation}<Badge variant="outline" class="text-warn" title="Deprecation date">until {date(o.deprecation)}</Badge>{/if}
                {#if !o.billable}<Badge variant="outline" title="No source prices it, so it's not in pricing.json">unpriced</Badge>{/if}
                {#if o.staleSince}<Badge variant="outline" class="text-warn" title="Prices reused from an earlier build">stale prices</Badge>{/if}
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
            <Table.Cell class="px-3 text-right font-mono text-[13px] tabular-nums">
              {tokens(o.context)}
              {#if o.maxOutput}<div class="text-muted-foreground text-xs">{tokens(o.maxOutput)} <span class="font-sans">out</span></div>{/if}
            </Table.Cell>
            <Table.Cell class="px-3">
              <button class="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline" onclick={() => (sources = sources === o.id ? null : o.id)}>
                {sources === o.id ? "Hide details" : "Details"}
              </button>
            </Table.Cell>
            <Table.Cell class="px-3 text-center"><ScoreBadge score={s?.privacy} label="Privacy" /></Table.Cell>
            <Table.Cell class="px-3 text-center"><ScoreBadge score={s?.eco} label="Eco" /></Table.Cell>
            <Table.Cell></Table.Cell>
          </Table.Row>
          {#if sources === o.id}
            <Table.Row class="bg-muted/30 hover:bg-muted/30">
              <Table.Cell colspan={COLUMNS.length + 1} class="whitespace-normal">
                <OfferSources offer={o} />
              </Table.Cell>
            </Table.Row>
          {/if}
        {/each}
      {/if}
    {:else}
      <Table.Row>
        <Table.Cell colspan={COLUMNS.length + 1} class="text-muted-foreground h-24 text-center">No model matches these filters.</Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>
