<script lang="ts">
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import * as Table from "$lib/components/ui/table/index.js";
  import { maxPrivacy } from "$lib/facts.js";
  import { countryName, flag } from "$lib/format.js";
  import { compareBy } from "$lib/models.js";
  import { app, href, peek } from "$lib/state.svelte.js";
  import Logo from "./Logo.svelte";
  import ScoreBadge from "./ScoreBadge.svelte";

  type SortKey = "name" | "privacy" | "eco" | "models";
  let sort = $state<SortKey>("privacy");

  const catalog = $derived(app.catalog!);
  const rows = $derived(
    Object.entries(catalog.providers).map(([id, p]) => {
      const max = p.facts && maxPrivacy(p.facts).facts;
      return {
        id,
        facts: p.facts,
        max,
        models: app.groups(app.offers.filter((o) => o.provider === id && !o.deprecated)).length,
        privacy: app.scores[id]?.privacy,
        eco: app.scores[id]?.eco,
      };
    }),
  );
  const KEY: Record<SortKey, (r: (typeof rows)[number]) => string | number | undefined> = {
    name: (r) => (r.facts?.name ?? r.id).toLowerCase(),
    privacy: (r) => r.privacy?.value,
    eco: (r) => r.eco?.value,
    models: (r) => r.models,
  };
  const sorted = $derived([...rows].sort(compareBy(KEY[sort], sort === "name" ? 1 : -1)));

  const TRAINING = { never: "Never", opt_in: "Opt-in", opt_out: "Unless opted out" } as const;
  const DOT = { good: "bg-good", warn: "bg-warn", bad: "bg-bad", none: "bg-muted-foreground/30" } as const;
</script>

{#snippet head(key: SortKey, label: string, cls = "")}
  <Table.Head class="text-muted-foreground h-10 px-3 text-xs font-medium {cls}">
    <button class="hover:text-foreground inline-flex items-center gap-1 {sort === key ? 'text-foreground' : ''}" onclick={() => (sort = key)}>
      {label}
      {#if sort === key}<ArrowDownIcon class="size-3" />{/if}
    </button>
  </Table.Head>
{/snippet}

{#snippet fact(tone: keyof typeof DOT, text: string)}
  <span class="inline-flex items-center gap-2"><span class="size-1.5 shrink-0 rounded-full {DOT[tone]}"></span>{text}</span>
{/snippet}

<Table.Root>
  <Table.Header>
    <Table.Row class="hover:bg-transparent">
      {@render head("name", "Provider")}
      {@render head("privacy", "Privacy", "text-center")}
      {@render head("eco", "Eco", "text-center")}
      <Table.Head class="text-muted-foreground h-10 px-3 text-xs font-medium">Trains on data</Table.Head>
      <Table.Head class="text-muted-foreground h-10 px-3 text-xs font-medium">Retention</Table.Head>
      <Table.Head class="text-muted-foreground h-10 px-3 text-xs font-medium">Data centers</Table.Head>
      {@render head("models", "Models", "text-right")}
      <Table.Head class="w-8"></Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#each sorted as r (r.id)}
      {@const entity = r.facts?.jurisdiction.legal_entity?.value}
      {@const training = r.max?.privacy.training?.value}
      {@const retention = r.max?.privacy.retention?.value.days}
      {@const regions = r.max?.jurisdiction.regions?.value}
      <Table.Row class="cursor-pointer" onclick={(e) => peek(e, { kind: "provider", id: r.id })}>
        <Table.Cell class="px-3 py-3.5">
          <a href={href.provider(r.id)} class="flex items-center gap-3" onclick={(e) => peek(e, { kind: "provider", id: r.id })}>
            <Logo name={r.facts?.name ?? r.id} logo={r.facts?.logo} color={r.facts?.color} size={30} />
            <span>
              <span class="block font-medium">{r.facts?.name ?? r.id}</span>
              {#if entity}<span class="text-muted-foreground text-xs">{flag(entity.country)} {countryName(entity.country)}</span>{/if}
            </span>
          </a>
        </Table.Cell>
        <Table.Cell class="px-3 text-center"><ScoreBadge score={r.privacy} label="Privacy" /></Table.Cell>
        <Table.Cell class="px-3 text-center"><ScoreBadge score={r.eco} label="Eco" /></Table.Cell>
        <Table.Cell class="px-3">
          {@render fact(training === "never" ? "good" : training === "opt_in" ? "warn" : training ? "bad" : "none", training ? TRAINING[training] : "Unknown")}
        </Table.Cell>
        <Table.Cell class="px-3">
          {@render fact(
            retention === undefined ? "none" : retention === 0 ? "good" : retention <= 30 ? "warn" : "bad",
            retention === undefined ? "Unknown" : retention === 0 ? "Not stored" : `${retention} days`,
          )}
        </Table.Cell>
        <Table.Cell class="px-3">
          <span title={regions?.map((x) => countryName(x.country)).join(", ")}>
            {[...new Set(regions?.map((x) => x.country))].map(flag).join(" ") || "–"}
          </span>
        </Table.Cell>
        <Table.Cell class="px-3 text-right font-mono tabular-nums">{r.models}</Table.Cell>
        <Table.Cell class="pr-3 pl-0"><ChevronRightIcon class="text-muted-foreground/60 size-4" /></Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>
