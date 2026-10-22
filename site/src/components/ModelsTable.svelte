<script lang="ts">
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import AudioLinesIcon from "@lucide/svelte/icons/audio-lines";
  import BracesIcon from "@lucide/svelte/icons/braces";
  import BrainIcon from "@lucide/svelte/icons/brain";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import WrenchIcon from "@lucide/svelte/icons/wrench";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import { MODE_LABEL, date, flag, fromUsd, money, tokens } from "$lib/format.js";
  import { type ModelGroup, compareBy, groupStats } from "$lib/models.js";
  import { app, href } from "$lib/state.svelte.js";
  import CopyButton from "./CopyButton.svelte";
  import Logo from "./Logo.svelte";
  import OfferSources from "./OfferSources.svelte";
  import ScoreBadge from "./ScoreBadge.svelte";

  let { groups }: { groups: ModelGroup[] } = $props();

  type SortKey = "name" | "lab" | "mode" | "hosts" | "input" | "output" | "context" | "knowledge" | "privacy" | "eco";
  let sort = $state<{ key: SortKey; dir: 1 | -1 }>({ key: "hosts", dir: -1 });
  let open = $state<Set<string>>(new Set());
  let sources = $state<string | null>(null);

  const catalog = $derived(app.catalog!);
  const best = (g: ModelGroup, kind: "privacy" | "eco") => {
    const v = g.offers.map((o) => app.scores[o.provider]?.[kind]?.value).filter((x) => x !== undefined);
    return v.length ? Math.max(...v) : undefined;
  };
  const bestScore = (g: ModelGroup, kind: "privacy" | "eco") =>
    g.offers.map((o) => app.scores[o.provider]?.[kind]).filter((s) => s !== undefined).sort((a, b) => b.value - a.value)[0];

  const KEY: Record<SortKey, (g: ModelGroup) => string | number | undefined> = {
    name: (g) => g.name.toLowerCase(),
    lab: (g) => (g.lab ? catalog.labs[g.lab]?.name ?? g.lab : undefined),
    mode: (g) => g.mode,
    hosts: (g) => g.offers.length,
    input: (g) => groupStats(g).input,
    output: (g) => groupStats(g).output,
    context: (g) => groupStats(g).context,
    knowledge: (g) => g.knowledge,
    privacy: (g) => best(g, "privacy"),
    eco: (g) => best(g, "eco"),
  };
  // Ties keep a stable, readable order: by name.
  const sorted = $derived(
    [...groups].sort((a, b) => compareBy(KEY[sort.key], sort.dir)(a, b) || a.name.localeCompare(b.name)),
  );

  function sortBy(key: SortKey) {
    const first = ["hosts", "privacy", "eco", "context", "knowledge"].includes(key) ? -1 : 1;
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
    { key: "mode", label: "Type" },
    { key: "hosts", label: "Hosts" },
    { key: "input", label: "Input", class: "text-right", title: "Cheapest per 1M tokens, or per unit shown" },
    { key: "output", label: "Output", class: "text-right", title: "Cheapest per 1M tokens" },
    { key: "context", label: "Context", class: "text-right" },
    { label: "Features" },
    { label: "License" },
    { key: "knowledge", label: "Cutoff", title: "Knowledge cutoff" },
    { key: "privacy", label: "Privacy", class: "text-center", title: "Best host's privacy score" },
    { key: "eco", label: "Eco", class: "text-center", title: "Best host's sustainability score" },
  ];
</script>

<div class="bg-card overflow-hidden rounded-xl border shadow-xs">
  <Table.Root>
    <Table.Header class="bg-muted/50 sticky top-0 z-10 backdrop-blur">
      <Table.Row class="hover:bg-transparent">
        <Table.Head class="w-8"></Table.Head>
        {#each COLUMNS as c (c.label)}
          <Table.Head class={c.class} title={c.title}>
            {#if c.key}
              {@const key = c.key}
              <button
                class="hover:text-foreground inline-flex items-center gap-1 {sort.key === key ? 'text-foreground' : ''}"
                onclick={() => sortBy(key)}
              >
                {c.label}
                {#if sort.key === key}
                  {#if sort.dir === 1}<ArrowUpIcon class="size-3" />{:else}<ArrowDownIcon class="size-3" />{/if}
                {:else}
                  <ChevronsUpDownIcon class="size-3 opacity-40" />
                {/if}
              </button>
            {:else}
              {c.label}
            {/if}
          </Table.Head>
        {/each}
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each sorted as g (g.key)}
        {@const lab = g.lab ? catalog.labs[g.lab] : undefined}
        {@const stats = groupStats(g)}
        {@const isOpen = open.has(g.key)}
        {@const allDeprecated = g.offers.every((o) => o.deprecated)}
        <Table.Row class="cursor-pointer {allDeprecated ? 'opacity-55' : ''}" data-state={isOpen ? "selected" : undefined} onclick={() => toggle(g.key)}>
          <Table.Cell class="pr-0">
            <ChevronRightIcon class="text-muted-foreground size-4 transition-transform {isOpen ? 'rotate-90' : ''}" />
          </Table.Cell>
          <Table.Cell>
            <div class="flex min-w-60 items-center gap-2.5">
              <Logo name={lab?.name ?? g.name} logo={lab?.logo} color={lab?.color} size={28} />
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 font-medium">
                  {g.name}
                  {#if allDeprecated}<Badge variant="destructive">deprecated</Badge>{/if}
                </div>
                <div class="text-muted-foreground text-xs">
                  {#if lab && g.lab}
                    <a href={href.lab(g.lab)} class="hover:text-foreground hover:underline" onclick={(e) => e.stopPropagation()}>{flag(lab.country)} {lab.name}</a>
                  {:else}
                    <span title="No lab claims this model yet">Unattributed</span>
                  {/if}
                </div>
              </div>
            </div>
          </Table.Cell>
          <Table.Cell><Badge variant="secondary">{MODE_LABEL[g.mode] ?? g.mode}</Badge></Table.Cell>
          <Table.Cell>
            <div class="flex items-center gap-1">
              <span class="flex -space-x-1.5">
                {#each [...new Set(g.offers.map((o) => o.provider))] as p (p)}
                  {@const f = catalog.providers[p]?.facts}
                  <Logo name={f?.name ?? p} logo={f?.logo} color={f?.color} size={22} class="ring-card ring-2" />
                {/each}
              </span>
              {#if g.offers.length === 1}<CopyButton text={g.offers[0]!.bifrostId} label="Copy Bifrost model id" />{/if}
            </div>
          </Table.Cell>
          <Table.Cell class="text-right tabular-nums">
            {#if stats.input !== undefined}
              {g.offers.length > 1 ? "from " : ""}{price(stats.input)}{#if g.offers.every((o) => o.input === undefined && o.other)}<span class="text-muted-foreground text-xs"> / {g.offers.find((o) => o.other)?.other?.per}</span>{/if}
            {:else}<span class="text-muted-foreground">–</span>{/if}
          </Table.Cell>
          <Table.Cell class="text-right tabular-nums">
            {#if stats.output !== undefined}{price(stats.output)}{:else}<span class="text-muted-foreground">–</span>{/if}
          </Table.Cell>
          <Table.Cell class="text-right tabular-nums">{tokens(stats.context)}</Table.Cell>
          <Table.Cell>
            <div class="text-muted-foreground flex gap-1.5 [&>svg]:size-3.5">
              {#if g.tools}<span title="Tool calling"><WrenchIcon class="size-3.5" /></span>{/if}
              {#if g.structured}<span title="Structured output"><BracesIcon class="size-3.5" /></span>{/if}
              {#if g.vision}<span title="Image input"><EyeIcon class="size-3.5" /></span>{/if}
              {#if g.audio}<span title="Audio input"><AudioLinesIcon class="size-3.5" /></span>{/if}
              {#if g.reasoning}<span title="Reasoning"><BrainIcon class="size-3.5" /></span>{/if}
            </div>
          </Table.Cell>
          <Table.Cell>
            {#if g.license}
              <Badge
                variant="outline"
                class="max-w-36 {g.openWeights ? 'border-good/30 text-good' : ''}"
                title="{g.license}{g.openWeights ? ', open weights' : g.openWeights === false ? ', closed weights' : ''}"
              >
                <span class="truncate">{g.license}</span>
              </Badge>
            {:else if g.openWeights !== undefined}
              <Badge variant="outline" class={g.openWeights ? "border-good/30 text-good" : ""}>{g.openWeights ? "Open weights" : "Closed"}</Badge>
            {/if}
          </Table.Cell>
          <Table.Cell class="text-muted-foreground whitespace-nowrap">{g.knowledge ? date(g.knowledge) : ""}</Table.Cell>
          <Table.Cell class="text-center"><ScoreBadge score={bestScore(g, "privacy")} label="Privacy" /></Table.Cell>
          <Table.Cell class="text-center"><ScoreBadge score={bestScore(g, "eco")} label="Eco" /></Table.Cell>
        </Table.Row>

        {#if isOpen}
          {#each g.offers as o (o.id)}
            {@const f = catalog.providers[o.provider]?.facts}
            {@const s = app.scores[o.provider]}
            <Table.Row class="bg-muted/30 hover:bg-muted/50 {o.deprecated ? 'opacity-55' : ''}">
              <Table.Cell></Table.Cell>
              <Table.Cell>
                <div class="flex items-center gap-2.5 pl-4">
                  <a href={href.provider(o.provider)} title="{f?.name ?? o.provider} fact sheet">
                    <Logo name={f?.name ?? o.provider} logo={f?.logo} color={f?.color} size={22} />
                  </a>
                  <div class="min-w-0">
                    <a href={href.provider(o.provider)} class="text-sm font-medium hover:underline">{f?.name ?? o.provider}</a>
                    <div class="text-muted-foreground flex items-center gap-0.5 font-mono text-xs">
                      {o.bifrostId}
                      <CopyButton text={o.bifrostId} label="Copy Bifrost model id" />
                    </div>
                  </div>
                </div>
              </Table.Cell>
              <Table.Cell colspan={2}>
                <div class="flex flex-wrap gap-1">
                  {#if o.deprecated}<Badge variant="destructive">deprecated</Badge>
                  {:else if o.deprecation}<Badge variant="outline" class="text-warn" title="Deprecation date">until {date(o.deprecation)}</Badge>{/if}
                  {#if !o.billable}<Badge variant="outline" title="No source prices it, so it's not in pricing.json">unpriced</Badge>{/if}
                  {#if o.staleSince}<Badge variant="outline" class="text-warn" title="Prices reused from an earlier build">stale prices</Badge>{/if}
                </div>
              </Table.Cell>
              <Table.Cell class="text-right tabular-nums">
                {#if o.input !== undefined}
                  {price(o.input)}
                  {#if o.cached !== undefined}<div class="text-muted-foreground text-xs">{price(o.cached)} cached</div>{/if}
                {:else if o.other}
                  {price(o.other.usd)}<span class="text-muted-foreground text-xs"> / {o.other.per}</span>
                {:else}<span class="text-muted-foreground">–</span>{/if}
              </Table.Cell>
              <Table.Cell class="text-right tabular-nums">{#if o.output !== undefined}{price(o.output)}{:else}<span class="text-muted-foreground">–</span>{/if}</Table.Cell>
              <Table.Cell class="text-right tabular-nums">
                {tokens(o.context)}
                {#if o.maxOutput}<div class="text-muted-foreground text-xs">{tokens(o.maxOutput)} out</div>{/if}
              </Table.Cell>
              <Table.Cell colspan={3}>
                <button class="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline" onclick={() => (sources = sources === o.id ? null : o.id)}>
                  {sources === o.id ? "Hide sources" : "Sources"}
                </button>
              </Table.Cell>
              <Table.Cell class="text-center"><ScoreBadge score={s?.privacy} label="Privacy" /></Table.Cell>
              <Table.Cell class="text-center"><ScoreBadge score={s?.eco} label="Eco" /></Table.Cell>
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
</div>
