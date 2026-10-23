<script lang="ts">
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import * as Table from "$lib/components/ui/table/index.js";
  import { EUROPE, countryName, flag, fromUsd, money } from "$lib/format.js";
  import { cheapestChatInput } from "$lib/models.js";
  import { app, href } from "$lib/state.svelte.js";
  import Logo from "../components/Logo.svelte";
  import PillTabs from "../components/PillTabs.svelte";

  let show = $state<"all" | "europe" | "open">("all");

  const catalog = $derived(app.catalog!);
  const groups = $derived(app.groups(app.offers.filter((o) => !o.deprecated)));
  const rows = $derived(
    Object.entries(catalog.labs)
      .map(([id, lab]) => {
        const own = groups.filter((g) => g.lab === id);
        return {
          id,
          lab,
          models: own.length,
          open: own.some((g) => g.openWeights),
          european: EUROPE.has(lab.country),
          cheapest: cheapestChatInput(own),
        };
      })
      .sort((a, b) => b.models - a.models || a.lab.name.localeCompare(b.lab.name)),
  );
  const shown = $derived(rows.filter((r) => (show === "europe" ? r.european : show === "open" ? r.open : true)));
  const AI_ACT = {
    signatory: ["Signed", "bg-good/12 text-good"],
    partial: ["Partly signed", "bg-warn/15 text-warn"],
    not_signatory: ["Not signed", "bg-muted text-muted-foreground"],
  } as const;
</script>

<section class="flex flex-wrap items-end justify-between gap-4 pt-12 pb-6">
  <div>
    <h1 class="text-3xl font-semibold tracking-tight">Labs</h1>
    <p class="text-muted-foreground mt-1.5">Who builds the models you can run in Europe.</p>
  </div>
  <PillTabs
    bind:value={show}
    options={[
      { value: "all", label: "All", count: rows.length },
      { value: "europe", label: "European", count: rows.filter((r) => r.european).length },
      { value: "open", label: "Open weights", count: rows.filter((r) => r.open).length },
    ]}
  />
</section>

<Table.Root>
  <Table.Header>
    <Table.Row class="hover:bg-transparent">
      <Table.Head class="text-muted-foreground h-10 px-3 text-xs font-medium">Lab</Table.Head>
      <Table.Head class="h-10 px-3"></Table.Head>
      <Table.Head class="text-muted-foreground h-10 px-3 text-xs font-medium">EU AI Code of Practice</Table.Head>
      <Table.Head class="text-muted-foreground h-10 px-3 text-right text-xs font-medium">Models</Table.Head>
      <Table.Head class="text-muted-foreground h-10 px-3 text-right text-xs font-medium">Cheapest chat, input /1M</Table.Head>
      <Table.Head class="w-8"></Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#each shown as r (r.id)}
      {@const ai = r.lab.eu_ai_act && AI_ACT[r.lab.eu_ai_act.value]}
      <Table.Row class="cursor-pointer" onclick={() => (location.hash = href.lab(r.id))}>
        <Table.Cell class="px-3 py-3.5">
          <a href={href.lab(r.id)} class="flex items-center gap-3">
            <Logo name={r.lab.name} logo={r.lab.logo} color={r.lab.color} size={30} />
            <span>
              <span class="block font-medium">{r.lab.name}</span>
              <span class="text-muted-foreground text-xs">{flag(r.lab.country)} {countryName(r.lab.country)}</span>
            </span>
          </a>
        </Table.Cell>
        <Table.Cell class="px-3">
          {#if r.european}<span class="bg-brand/10 text-brand rounded-full px-2.5 py-0.5 text-xs">🇪🇺 European</span>{/if}
        </Table.Cell>
        <Table.Cell class="px-3">
          {#if ai}<span class="rounded-full px-2.5 py-0.5 text-xs {ai[1]}">{ai[0]}</span>{:else}<span class="text-muted-foreground">–</span>{/if}
        </Table.Cell>
        <Table.Cell class="px-3 text-right font-mono tabular-nums">{r.models || "–"}</Table.Cell>
        <Table.Cell class="px-3 text-right font-mono text-[13px] tabular-nums">
          {#if r.cheapest !== undefined}{money(fromUsd(r.cheapest, app.currency.value, catalog.exchange_rates), app.currency.value)}{:else}<span class="text-muted-foreground">–</span>{/if}
        </Table.Cell>
        <Table.Cell class="pr-3 pl-0"><ChevronRightIcon class="text-muted-foreground/60 size-4" /></Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>
