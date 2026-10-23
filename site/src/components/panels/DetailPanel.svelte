<!-- The side panel: a quick look at a model, provider or lab without leaving the current page. -->
<script lang="ts">
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import * as Sheet from "$lib/components/ui/sheet/index.js";
  import { app, pageOf } from "$lib/state.svelte.js";
  import LabPanel from "./LabPanel.svelte";
  import ModelPanel from "./ModelPanel.svelte";
  import ProviderPanel from "./ProviderPanel.svelte";

  // Waits for the catalog, for links shared with a panel open.
  const current = $derived(app.catalog ? app.panels.at(-1) : undefined);
  const TITLE = { model: "Model", provider: "Provider", lab: "Lab" } as const;
</script>

<Sheet.Root open={!!current} onOpenChange={(open) => !open && app.closePanel()}>
  <Sheet.Content class="w-full gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg" onOpenAutoFocus={(e) => e.preventDefault()}>
    {#if current}
      <div class="flex h-12 shrink-0 items-center gap-2 border-b pr-12 pl-3 text-sm">
        {#if app.panels.length > 1}
          <button class="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md p-1.5" onclick={() => app.backPanel()} title="Back">
            <ArrowLeftIcon class="size-4" />
          </button>
        {/if}
        <Sheet.Title class="text-muted-foreground text-sm font-normal">{TITLE[current.kind]}</Sheet.Title>
        <a href={pageOf(current)} class="text-brand ml-auto hover:underline">Open full page →</a>
      </div>
      <div class="flex-1 overflow-y-auto p-5">
        {#key current}
          {#if current.kind === "model"}<ModelPanel id={current.id} />
          {:else if current.kind === "provider"}<ProviderPanel id={current.id} />
          {:else}<LabPanel id={current.id} />{/if}
        {/key}
      </div>
    {/if}
  </Sheet.Content>
</Sheet.Root>
