<script lang="ts">
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import { ago, date } from "$lib/format.js";
  import { app, href } from "$lib/state.svelte.js";
  import type { Catalog, Currency } from "$lib/types.js";
  import BrandMark from "./components/BrandMark.svelte";
  import ScoringDialog from "./components/ScoringDialog.svelte";
  import Home from "./pages/Home.svelte";
  import LabPage from "./pages/LabPage.svelte";
  import LabsPage from "./pages/LabsPage.svelte";
  import ProviderPage from "./pages/ProviderPage.svelte";
  import ProvidersPage from "./pages/ProvidersPage.svelte";

  let scoring = $state(false);

  const SECTIONS = [
    { label: "Models", href: href.home, pages: ["home"] },
    { label: "Providers", href: href.providers, pages: ["providers", "provider"] },
    { label: "Labs", href: href.labs, pages: ["labs", "lab"] },
  ];

  const warningsByCode = $derived(
    Object.entries(
      (app.catalog?.warnings ?? []).reduce<Record<string, Catalog["warnings"]>>((acc, w) => ((acc[w.code] ??= []).push(w), acc), {}),
    ),
  );
</script>

<header class="bg-background/85 sticky top-0 z-20 backdrop-blur">
  <div class="mx-auto flex h-15 max-w-6xl items-center justify-between gap-4 px-6">
    <div class="flex items-center gap-8">
      <a href={href.home} class="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
        <BrandMark size={24} />
        <span>eu<span class="text-muted-foreground/70 px-0.5 font-medium">/</span>models</span>
      </a>
      <nav class="flex gap-1 text-sm">
        {#each SECTIONS as s (s.label)}
          <a
            href={s.href}
            class="rounded-lg px-2.5 py-1.5 transition-colors {s.pages.includes(app.route.page)
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:text-foreground'}"
          >
            {s.label}
          </a>
        {/each}
      </nav>
    </div>
    <nav class="text-muted-foreground flex items-center gap-5 text-sm">
      <div class="flex gap-0.5 font-mono text-xs">
        {#each ["EUR", "CHF", "USD"] as const as c (c)}
          <button
            class="rounded-md px-1.5 py-1 font-medium transition-colors {app.currency.value === c
              ? 'bg-brand/12 text-brand'
              : 'text-muted-foreground/70 hover:text-foreground'}"
            onclick={() => (app.currency.value = c as Currency)}
          >
            {c}
          </button>
        {/each}
      </div>
      <button class="hover:text-foreground" onclick={() => (scoring = true)}>Scoring</button>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger class="hover:text-foreground inline-flex items-center gap-1">Data <ChevronDownIcon class="size-3.5" /></DropdownMenu.Trigger>
        <DropdownMenu.Content align="end" class="w-64">
          <DropdownMenu.Item>
            {#snippet child({ props })}
              <a {...props} href="pricing.json"><span><span class="block font-mono text-xs">pricing.json</span><span class="text-muted-foreground text-xs">Bifrost pricing datasheet</span></span></a>
            {/snippet}
          </DropdownMenu.Item>
          <DropdownMenu.Item>
            {#snippet child({ props })}
              <a {...props} href="catalog.json"><span><span class="block font-mono text-xs">catalog.json</span><span class="text-muted-foreground text-xs">Everything on this site, with sources</span></span></a>
            {/snippet}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <a class="hover:text-foreground" href="https://github.com/lmgarret/eu-model-catalog" target="_blank" rel="noreferrer">GitHub ↗</a>
    </nav>
  </div>
</header>

<main class="mx-auto max-w-6xl px-6 pb-16">
  {#if app.error}
    <p class="text-destructive mt-10 text-center">Couldn't load the catalog: {app.error}</p>
  {:else if !app.catalog}
    <p class="text-muted-foreground mt-10 text-center">Loading catalog…</p>
  {:else}
    {@const c = app.catalog}
    {#if app.route.page === "provider"}
      {#key app.route.id}<ProviderPage id={app.route.id} onTune={() => (scoring = true)} />{/key}
    {:else if app.route.page === "lab"}
      {#key app.route.id}<LabPage id={app.route.id} />{/key}
    {:else if app.route.page === "providers"}
      <ProvidersPage />
    {:else if app.route.page === "labs"}
      <LabsPage />
    {:else}
      <Home />
    {/if}

    <footer class="text-muted-foreground mt-16 flex flex-col gap-1.5 border-t pt-5 text-xs">
      <p class="flex flex-wrap items-center gap-x-2 gap-y-1">
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
      </p>
      <p>
        Prices are converted with ECB reference rates and may differ from your invoice. Provider facts are mostly the
        providers' own claims. Logos from <a class="underline" href="https://models.dev" target="_blank" rel="noreferrer">models.dev</a>.
      </p>
    </footer>
  {/if}
</main>

<ScoringDialog bind:open={scoring} />
