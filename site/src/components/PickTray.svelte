<!-- The picked models, fixed at the bottom of Home and lab pages: chips, "Show only selected", Clear and Compare. -->
<script lang="ts">
  import XIcon from "@lucide/svelte/icons/x";
  import { canCompare } from "$lib/compare.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { picks } from "$lib/picks.svelte.js";
  import { app, href } from "$lib/state.svelte.js";

  const CHIPS = 4;
  const groups = $derived(picks.groups);
  const verdict = $derived(canCompare(groups));

  // From a lab page, the switch takes you to Home, where the picks are listed.
  function showOnly(on: boolean) {
    picks.only = on;
    if (on && app.route.page === "lab") location.hash = href.home;
  }
</script>

<div
  class="bg-background/95 fixed inset-x-0 bottom-4 z-30 mx-auto flex w-fit max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2 rounded-2xl border py-2 pr-2 pl-3 shadow-lg backdrop-blur"
>
  <div class="flex min-w-0 flex-wrap items-center gap-1.5">
    {#each groups.slice(0, CHIPS) as g (g.key)}
      <span class="bg-muted inline-flex max-w-44 items-center gap-1 rounded-full py-1 pr-1.5 pl-2.5 text-xs">
        <span class="truncate">{g.name}</span>
        <button class="text-muted-foreground hover:text-foreground rounded-full" aria-label="Remove {g.name}" onclick={() => picks.toggle(g.key)}>
          <XIcon class="size-3" />
        </button>
      </span>
    {/each}
    {#if groups.length > CHIPS}
      <span class="text-muted-foreground px-1 text-xs tabular-nums">+{groups.length - CHIPS} more</span>
    {/if}
  </div>
  <label class="ml-1 flex items-center gap-2 text-sm whitespace-nowrap">
    <Switch bind:checked={() => picks.only, showOnly} />
    Show only selected
  </label>
  <Button variant="ghost" onclick={() => picks.clear()}>Clear</Button>
  {#if verdict.ok}
    <Button variant="brand" href={href.compare(groups.map((g) => g.key))}>Compare →</Button>
  {:else}
    <Button variant="brand" disabled>{verdict.reason}</Button>
  {/if}
</div>
