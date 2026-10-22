<script lang="ts">
  import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import * as Tabs from "$lib/components/ui/tabs/index.js";
  import { ago, date } from "$lib/format.js";
  import { app, href } from "$lib/state.svelte.js";
  import type { Catalog, Currency } from "$lib/types.js";
  import ScoringDialog from "./components/ScoringDialog.svelte";
  import Home from "./pages/Home.svelte";
  import LabPage from "./pages/LabPage.svelte";
  import ProviderPage from "./pages/ProviderPage.svelte";

  let scoring = $state(false);

  const warningsByCode = $derived(
    Object.entries(
      (app.catalog?.warnings ?? []).reduce<Record<string, Catalog["warnings"]>>((acc, w) => ((acc[w.code] ??= []).push(w), acc), {}),
    ),
  );
</script>

<header class="bg-background/80 sticky top-0 z-20 border-b backdrop-blur">
  <div class="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-4 px-6 py-3">
    <a href={href.home} class="flex items-center gap-3">
      <span class="relative grid size-9 place-items-center rounded-lg bg-[#039]" aria-hidden="true">
        {#each Array(12) as _, i (i)}
          <i class="absolute top-1/2 left-1/2 -m-[2px] size-[4px] rounded-full bg-[#fc0]" style:transform="rotate({i * 30}deg) translateY(-11px)"></i>
        {/each}
      </span>
      <span>
        <span class="block font-semibold tracking-tight">EU model catalog</span>
        <span class="text-muted-foreground block text-xs">AI models from European providers</span>
      </span>
    </a>
    <nav class="flex items-center gap-2">
      <Tabs.Root value={app.currency.value} onValueChange={(v) => (app.currency.value = v as Currency)}>
        <Tabs.List>
          {#each ["EUR", "CHF", "USD"] as c (c)}<Tabs.Trigger value={c}>{c}</Tabs.Trigger>{/each}
        </Tabs.List>
      </Tabs.Root>
      <Button variant="ghost" size="sm" onclick={() => (scoring = true)}>Scores</Button>
      <Button variant="ghost" size="sm" href="pricing.json" title="Bifrost pricing datasheet">pricing.json</Button>
      <Button variant="ghost" size="sm" href="catalog.json" title="Everything on this site, with sources">catalog.json</Button>
      <Button variant="outline" size="sm" href="https://github.com/lmgarret/eu-model-catalog" target="_blank" rel="noreferrer">GitHub</Button>
    </nav>
  </div>
</header>

<main class="mx-auto max-w-[1480px] px-6 pb-16">
  {#if app.error}
    <p class="text-destructive mt-10 text-center">Couldn't load the catalog: {app.error}</p>
  {:else if !app.catalog}
    <p class="text-muted-foreground mt-10 text-center">Loading catalog…</p>
  {:else}
    {@const c = app.catalog}
    <div class="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span>Built {ago(c.built_at)}</span>
      <span>·</span>
      <span title="ECB reference rates used to convert prices">
        ECB {date(c.exchange_rates.date)}: 1 EUR = {c.exchange_rates.rates.USD} USD = {c.exchange_rates.rates.CHF} CHF
      </span>
      {#if c.warnings.length}
        <span>·</span>
        <Popover.Root>
          <Popover.Trigger class="hover:text-foreground inline-flex items-center gap-1">
            <TriangleAlertIcon class="text-warn size-3.5" /> {c.warnings.length} build warnings
          </Popover.Trigger>
          <Popover.Content class="max-h-[60vh] w-[36rem] overflow-y-auto text-xs" align="start">
            {#each warningsByCode as [code, list] (code)}
              <details class="py-1">
                <summary class="cursor-pointer"><Badge variant="outline" class="text-warn">{code.replace(/_/g, " ")}</Badge> {list.length}</summary>
                <ul class="text-muted-foreground mt-1 mb-2 list-disc pl-5">
                  {#each list as w, i (i)}<li>{w.message}</li>{/each}
                </ul>
              </details>
            {/each}
          </Popover.Content>
        </Popover.Root>
      {/if}
    </div>

    {#if app.route.page === "provider"}
      <ProviderPage id={app.route.id} onTune={() => (scoring = true)} />
    {:else if app.route.page === "lab"}
      <LabPage id={app.route.id} />
    {:else}
      <Home />
    {/if}

    <footer class="text-muted-foreground mt-12 border-t pt-4 text-xs">
      Prices are converted with ECB reference rates and may differ from your invoice. Provider facts are mostly the
      providers' own claims. Logos from <a class="underline" href="https://models.dev" target="_blank" rel="noreferrer">models.dev</a>.
    </footer>
  {/if}
</main>

<ScoringDialog bind:open={scoring} />
