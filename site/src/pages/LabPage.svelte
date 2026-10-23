<script lang="ts">
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import SearchIcon from "@lucide/svelte/icons/search";
  import { Input } from "$lib/components/ui/input/index.js";
  import { isStale } from "$lib/facts.js";
  import { EUROPE, MODE_LABEL, countryName, date, flag, fromUsd, money } from "$lib/format.js";
  import { cheapestChatInput } from "$lib/models.js";
  import { app, href } from "$lib/state.svelte.js";
  import Logo from "../components/Logo.svelte";
  import ModelsTable from "../components/ModelsTable.svelte";
  import PillTabs from "../components/PillTabs.svelte";

  let { id }: { id: string } = $props();

  let mode = $state("all");
  let q = $state("");

  const catalog = $derived(app.catalog!);
  const lab = $derived(catalog.labs[id]);
  const groups = $derived(app.groups(app.offers.filter((o) => o.m.info.lab?.value === id && !o.deprecated)));
  const shown = $derived(
    groups.filter((g) => (mode === "all" || g.mode === mode) && (!q.trim() || g.name.toLowerCase().includes(q.trim().toLowerCase()))),
  );
  const modes = $derived([
    { value: "all", label: "All", count: groups.length },
    ...Object.keys(MODE_LABEL)
      .map((m) => ({ value: m, label: MODE_LABEL[m]!, count: groups.filter((g) => g.mode === m).length }))
      .filter((m) => m.count),
  ]);
  const cheapestChat = $derived(cheapestChatInput(groups));
  const hosts = $derived(
    Object.entries(
      groups.reduce<Record<string, number>>((acc, g) => {
        for (const p of new Set(g.offers.map((o) => o.provider))) acc[p] = (acc[p] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .map(([p, n]) => ({ id: p, n, name: app.providerName(p), color: catalog.providers[p]?.facts?.color }))
      .sort((a, b) => b.n - a.n),
  );
  const AI_ACT = {
    signatory: ["✓ Signed the EU AI Code of Practice", "bg-good/12 text-good"],
    partial: ["Partly signed the EU AI Code of Practice", "bg-warn/15 text-warn"],
    not_signatory: ["Didn't sign the EU AI Code of Practice", "bg-muted text-muted-foreground"],
  } as const;
</script>

<a href={href.labs} class="text-muted-foreground hover:text-foreground mt-6 inline-flex items-center gap-1.5 text-sm"><ArrowLeftIcon class="size-3.5" /> Labs</a>

{#if !lab}
  <p class="text-muted-foreground mt-10">Unknown lab “{id}”.</p>
{:else}
  <header class="mt-5 flex items-center gap-4">
    <Logo name={lab.name} logo={lab.logo} color={lab.color} size={56} class="rounded-2xl" />
    <div>
      <h1 class="text-3xl font-semibold tracking-tight">{lab.name}</h1>
      <p class="text-muted-foreground mt-0.5 flex flex-wrap gap-x-4 text-sm">
        <span>{flag(lab.country)} {countryName(lab.country)}</span>
        <a class="hover:text-foreground" href={lab.website} target="_blank" rel="noreferrer">{new URL(lab.website).host} ↗</a>
      </p>
    </div>
  </header>

  <div class="mt-5 flex flex-wrap items-center gap-1.5 text-xs">
    {#if EUROPE.has(lab.country)}<span class="bg-brand/10 text-brand rounded-full px-2.5 py-1">🇪🇺 European lab</span>{/if}
    {#if lab.eu_ai_act}
      {@const [text, tone] = AI_ACT[lab.eu_ai_act.value]}
      <a
        href={lab.eu_ai_act.source}
        target="_blank"
        rel="noreferrer"
        class="rounded-full px-2.5 py-1 {tone}"
        title="{lab.eu_ai_act.note ?? ''} Checked {date(lab.eu_ai_act.checked)}{isStale(lab.eu_ai_act.checked) ? ' (stale)' : ''}"
      >
        {text}
      </a>
    {/if}
  </div>

  <section class="mt-8 flex flex-wrap gap-x-12 gap-y-6 border-b pb-7">
    <div>
      <div class="text-2xl font-semibold tracking-tight tabular-nums">{groups.length}</div>
      <div class="text-muted-foreground text-xs">models in Europe</div>
    </div>
    <div>
      <div class="text-2xl font-semibold tracking-tight tabular-nums">
        {groups.filter((g) => g.openWeights).length}<span class="text-muted-foreground text-sm font-medium"> / {groups.length}</span>
      </div>
      <div class="text-muted-foreground text-xs">open weights</div>
    </div>
    {#if cheapestChat !== undefined}
      <div>
        <div class="text-2xl font-semibold tracking-tight tabular-nums">{money(fromUsd(cheapestChat, app.currency.value, catalog.exchange_rates), app.currency.value)}</div>
        <div class="text-muted-foreground text-xs">cheapest chat, per 1M input</div>
      </div>
    {/if}
    {#if hosts.length}
      <div>
        <div class="text-sm font-medium">Hosted at</div>
        <div class="mt-2 mb-1.5 flex h-2 w-56 gap-0.5 overflow-hidden rounded-full">
          {#each hosts as h (h.id)}<span style:flex={h.n} style:background={h.color ?? "var(--muted-foreground)"}></span>{/each}
        </div>
        <div class="text-muted-foreground flex flex-wrap gap-x-3 text-xs">
          {#each hosts as h (h.id)}
            <a href={href.provider(h.id)} class="hover:text-foreground inline-flex items-center gap-1.5">
              <span class="size-2 rounded-xs" style:background={h.color ?? "var(--muted-foreground)"}></span>{h.name} {h.n}
            </a>
          {/each}
        </div>
      </div>
    {/if}
  </section>

  <div class="mt-7 flex flex-wrap items-center justify-between gap-3">
    <PillTabs options={modes} bind:value={mode} />
    <div class="relative w-72">
      <SearchIcon class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input bind:value={q} placeholder="Search {lab.name} models" class="h-9 rounded-xl pl-9" />
    </div>
  </div>
  <div class="mt-3">
    <ModelsTable groups={shown} showLab={false} />
  </div>
{/if}
