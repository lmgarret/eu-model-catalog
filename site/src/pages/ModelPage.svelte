<script lang="ts">
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import AudioLinesIcon from "@lucide/svelte/icons/audio-lines";
  import BracesIcon from "@lucide/svelte/icons/braces";
  import BrainIcon from "@lucide/svelte/icons/brain";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import WrenchIcon from "@lucide/svelte/icons/wrench";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import { MODE_LABEL, date, flag, fromUsd, money, tokens } from "$lib/format.js";
  import { groupStats } from "$lib/models.js";
  import { app, href } from "$lib/state.svelte.js";
  import BenchmarkCards from "../components/BenchmarkCards.svelte";
  import CopyButton from "../components/CopyButton.svelte";
  import Logo from "../components/Logo.svelte";
  import ModelPicker from "../components/ModelPicker.svelte";
  import OfferSources from "../components/OfferSources.svelte";
  import ScoreBadge from "../components/ScoreBadge.svelte";

  /** The model group's key: its canonical id, or the offer id for unattributed models. */
  let { id }: { id: string } = $props();

  let details = $state<string | null>(null);

  const catalog = $derived(app.catalog!);
  const all = $derived(app.groups(app.offers));
  const g = $derived(all.find((x) => x.key === id));
  const lab = $derived(g?.lab ? catalog.labs[g.lab] : undefined);
  const labModel = $derived(g?.canonical ? lab?.models[g.canonical.split("/")[1]!] : undefined);
  const stats = $derived(g && groupStats(g));
  const price = (usd: number | undefined) =>
    usd === undefined ? undefined : money(fromUsd(usd, app.currency.value, catalog.exchange_rates), app.currency.value);

  const FEATURES = [
    ["tools", "Tool calling", WrenchIcon],
    ["structured", "Structured output", BracesIcon],
    ["vision", "Image input", EyeIcon],
    ["audio", "Audio input", AudioLinesIcon],
    ["reasoning", "Reasoning", BrainIcon],
  ] as const;
</script>

<a href={href.home} class="text-muted-foreground hover:text-foreground mt-6 inline-flex items-center gap-1.5 text-sm"><ArrowLeftIcon class="size-3.5" /> Models</a>

{#if !g || !stats}
  <p class="text-muted-foreground mt-10">Unknown model “{id}”.</p>
{:else}
  <header class="mt-5 flex flex-wrap items-center gap-4">
    <Logo name={lab?.name ?? g.name} logo={lab?.logo} color={lab?.color} size={56} class="rounded-2xl" />
    <div>
      <h1 class="text-3xl font-semibold tracking-tight">{g.name}</h1>
      <p class="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-4 text-sm">
        {#if lab && g.lab}
          <a class="hover:text-foreground" href={href.lab(g.lab)}>{flag(lab.country)} {lab.name}</a>
        {:else}
          <span title="No lab claims this model yet">Unattributed</span>
        {/if}
        <span>{MODE_LABEL[g.mode] ?? g.mode}</span>
        {#if stats.context}<span>{tokens(stats.context)} context</span>{/if}
        {#if g.knowledge}<span>Cutoff {date(g.knowledge)}</span>{/if}
        {#if g.released}<span>Released {date(g.released)}</span>{/if}
        {#if labModel?.hf}<a class="hover:text-foreground" href="https://huggingface.co/{labModel.hf}" target="_blank" rel="noreferrer">Hugging Face ↗</a>{/if}
      </p>
    </div>
    <div class="ml-auto">
      <ModelPicker mode={g.mode} exclude={[g.key]} label="Compare with…" onpick={(k) => (location.hash = href.compare([g.key, k]))} />
    </div>
  </header>

  <div class="mt-5 flex flex-wrap items-center gap-1.5 text-xs">
    {#if g.openWeights !== undefined}
      <span class="rounded-full px-2.5 py-1 {g.openWeights ? 'bg-good/12 text-good' : 'bg-muted text-muted-foreground'}">
        {g.openWeights ? "Open weights" : "Closed weights"}
      </span>
    {/if}
    {#if g.license}
      <a href={g.licenseUrl} target="_blank" rel="noreferrer" class="bg-muted hover:text-foreground rounded-full px-2.5 py-1">{g.license}</a>
    {/if}
    {#each FEATURES as [key, label, Icon] (key)}
      {#if g[key]}<span class="bg-muted inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"><Icon class="size-3" />{label}</span>{/if}
    {/each}
  </div>

  {#if g.mode === "chat"}
    <section class="mt-8"><BenchmarkCards group={g} /></section>
    <p class="text-muted-foreground mt-2 text-xs">Scores are for the lab's model; hosts may serve quantized weights.</p>
  {/if}

  <section class="mt-10">
    <h2 class="text-lg font-semibold tracking-tight">Hosts <span class="text-muted-foreground text-sm font-normal tabular-nums">{g.offers.length}</span></h2>
    <div class="mt-3">
      <Table.Root>
        <Table.Header>
          <Table.Row class="hover:bg-transparent">
            {#each ["Provider", "Input /1M", "Output /1M", "Context", "Privacy", "Eco", ""] as label, i (i)}
              <Table.Head class="text-muted-foreground h-10 px-3 text-xs font-medium {i > 0 && i < 4 ? 'text-right' : i > 3 ? 'text-center' : ''}">{label}</Table.Head>
            {/each}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each g.offers as o (o.id)}
            {@const f = catalog.providers[o.provider]?.facts}
            {@const s = app.scores[o.provider]}
            <Table.Row class={o.deprecated ? "opacity-55" : ""}>
              <Table.Cell class="px-3 py-3">
                <div class="flex items-center gap-3">
                  <a href={href.provider(o.provider)}><Logo name={f?.name ?? o.provider} logo={f?.logo} color={f?.color} size={28} /></a>
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-1.5">
                      <a href={href.provider(o.provider)} class="font-medium hover:underline">{f?.name ?? o.provider}</a>
                      {#if o.deprecated}<Badge variant="destructive">deprecated</Badge>
                      {:else if o.deprecation}<Badge variant="outline" class="text-warn" title="Deprecation date">until {date(o.deprecation)}</Badge>{/if}
                      {#if !o.billable}<Badge variant="outline" title="No source prices it, so it's not in pricing.json">unpriced</Badge>{/if}
                      {#if o.staleSince}<Badge variant="outline" class="text-warn" title="Prices reused from an earlier build">stale prices</Badge>{/if}
                    </div>
                    <div class="text-muted-foreground flex items-center gap-0.5 font-mono text-xs">
                      {o.bifrostId}
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
              <Table.Cell class="px-3 text-right font-mono text-[13px] tabular-nums">
                {tokens(o.context)}
                {#if o.maxOutput}<div class="text-muted-foreground text-xs">{tokens(o.maxOutput)} <span class="font-sans">out</span></div>{/if}
              </Table.Cell>
              <Table.Cell class="px-3 text-center"><ScoreBadge score={s?.privacy} label="Privacy" /></Table.Cell>
              <Table.Cell class="px-3 text-center"><ScoreBadge score={s?.eco} label="Eco" /></Table.Cell>
              <Table.Cell class="px-3 text-right">
                <button class="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline" onclick={() => (details = details === o.id ? null : o.id)}>
                  {details === o.id ? "Hide details" : "Details"}
                </button>
              </Table.Cell>
            </Table.Row>
            {#if details === o.id}
              <Table.Row class="bg-muted/30 hover:bg-muted/30">
                <Table.Cell colspan={7} class="whitespace-normal"><OfferSources offer={o} /></Table.Cell>
              </Table.Row>
            {/if}
          {/each}
        </Table.Body>
      </Table.Root>
    </div>
  </section>
{/if}
