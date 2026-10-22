<script lang="ts">
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import * as Table from "$lib/components/ui/table/index.js";
  import { maxPrivacy } from "$lib/facts.js";
  import { countryName, flag } from "$lib/format.js";
  import { compareBy } from "$lib/models.js";
  import { app, href } from "$lib/state.svelte.js";
  import Logo from "./Logo.svelte";
  import ScoreRing from "./ScoreRing.svelte";

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
        models: app.offers.filter((o) => o.provider === id && !o.deprecated).length,
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
</script>

{#snippet head(key: SortKey, label: string, cls = "")}
  <Table.Head class={cls}>
    <button class="hover:text-foreground inline-flex items-center gap-1 {sort === key ? 'text-foreground' : ''}" onclick={() => (sort = key)}>
      {label}
      {#if sort === key}<ArrowDownIcon class="size-3" />{/if}
    </button>
  </Table.Head>
{/snippet}

<div class="bg-card overflow-hidden rounded-xl border shadow-xs">
  <Table.Root>
    <Table.Header class="bg-muted/50">
      <Table.Row class="hover:bg-transparent">
        {@render head("name", "Provider")}
        {@render head("privacy", "Privacy", "text-center")}
        {@render head("eco", "Eco", "text-center")}
        <Table.Head>Training</Table.Head>
        <Table.Head>Retention</Table.Head>
        <Table.Head>Regions</Table.Head>
        <Table.Head>US parent</Table.Head>
        <Table.Head>Renewable</Table.Head>
        <Table.Head class="text-right">PUE</Table.Head>
        {@render head("models", "Models", "text-right")}
        <Table.Head class="w-8"></Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each sorted as r (r.id)}
        {@const entity = r.facts?.jurisdiction.legal_entity?.value}
        {@const training = r.max?.privacy.training?.value}
        {@const retention = r.max?.privacy.retention?.value.days}
        {@const parent = r.facts?.jurisdiction.parent_company?.value}
        {@const energy = r.facts?.sustainability.renewable_energy?.value}
        <Table.Row class="cursor-pointer" onclick={() => (location.hash = href.provider(r.id))}>
          <Table.Cell>
            <a href={href.provider(r.id)} class="flex items-center gap-3">
              <Logo name={r.facts?.name ?? r.id} logo={r.facts?.logo} color={r.facts?.color} size={32} />
              <span>
                <span class="block font-medium">{r.facts?.name ?? r.id}</span>
                {#if entity}<span class="text-muted-foreground text-xs">{flag(entity.country)} {countryName(entity.country)}</span>{/if}
              </span>
            </a>
          </Table.Cell>
          <Table.Cell class="text-center"><ScoreRing score={r.privacy} label="Privacy" size={34} /></Table.Cell>
          <Table.Cell class="text-center"><ScoreRing score={r.eco} label="Eco" size={34} /></Table.Cell>
          <Table.Cell class={training === "never" ? "text-good" : training ? "text-warn" : "text-muted-foreground"}>
            {training ? TRAINING[training] : "–"}
          </Table.Cell>
          <Table.Cell class={retention === 0 ? "text-good" : retention !== undefined ? "text-warn" : "text-muted-foreground"}>
            {retention === undefined ? "–" : retention === 0 ? "Not stored" : `${retention} days`}
          </Table.Cell>
          <Table.Cell>
            <span title={r.max?.jurisdiction.regions?.value.map((x) => countryName(x.country)).join(", ")}>
              {[...new Set(r.max?.jurisdiction.regions?.value.map((x) => x.country))].map(flag).join(" ") || "–"}
            </span>
          </Table.Cell>
          <Table.Cell class={parent?.us_cloud_act ? "text-bad" : parent ? "text-good" : "text-muted-foreground"}>
            {parent ? (parent.us_cloud_act ? "Yes" : "No") : "–"}
          </Table.Cell>
          <Table.Cell class="tabular-nums">
            {#if energy}{energy.share}%<span class="text-muted-foreground ml-1 text-xs">{energy.backing === "unknown" ? "" : energy.backing.replace("_", " ")}</span>{:else}<span class="text-muted-foreground">–</span>{/if}
          </Table.Cell>
          <Table.Cell class="text-right tabular-nums">{r.facts?.sustainability.pue?.value ?? "–"}</Table.Cell>
          <Table.Cell class="text-right tabular-nums">{r.models}</Table.Cell>
          <Table.Cell><ChevronRightIcon class="text-muted-foreground size-4" /></Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
</div>
<p class="text-muted-foreground mt-2 text-xs">
  Privacy columns show each provider at its maximum self-serve privacy setup; open a provider for the steps.
  Facts are mostly the providers' own claims.
</p>
