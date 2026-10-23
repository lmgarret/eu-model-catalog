<script lang="ts">
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import { ACCESS_LABEL, isStale } from "$lib/facts.js";
  import { date } from "$lib/format.js";
  import type { SetupStep } from "$lib/types.js";

  /** `compact`: the access and cost tags go under the title, for the side panel. */
  let { steps, name, compact = false }: { steps: SetupStep[]; name: string; compact?: boolean } = $props();

  // The first step starts open; `picked` is undefined until the user opens or closes one.
  let picked = $state<string | null>();
  const open = $derived(picked === undefined ? (steps[0]?.id ?? null) : picked);

  const host = (url: string) => new URL(url).host.replace(/^www\./, "");
  const counts = $derived(
    Object.entries(steps.reduce<Record<string, number>>((acc, s) => ((acc[s.access] = (acc[s.access] ?? 0) + 1), acc), {})).map(
      ([access, n]) => `${n} ${ACCESS_LABEL[access as SetupStep["access"]].toLowerCase()}`,
    ),
  );
</script>

<div class="flex items-baseline justify-between gap-4">
  <h3 class="font-semibold">Get to maximum privacy</h3>
  <span class="text-muted-foreground text-xs">{counts.join(" · ")}</span>
</div>
{#if steps.length}
  <p class="text-muted-foreground mt-1 text-xs">Scores assume the self-serve steps; the others are listed but not counted.</p>
  <ol class="mt-3 border-t">
    {#each steps as s, i (s.id)}
      {@const selfServe = s.access === "self_serve"}
      <li class="border-b">
        <button class="flex w-full items-center gap-3 py-3 text-left" onclick={() => (picked = open === s.id ? null : s.id)} aria-expanded={open === s.id}>
          <span class="grid size-5.5 shrink-0 place-items-center rounded-full text-xs font-semibold {selfServe ? 'bg-good/12 text-good' : 'bg-warn/15 text-warn'}">{i + 1}</span>
          {#snippet tags()}
            {#if !selfServe}<span class="bg-warn/15 text-warn shrink-0 rounded-full px-2 py-0.5 text-xs">{ACCESS_LABEL[s.access]}</span>{/if}
            {#if s.cost}<span class="bg-muted text-muted-foreground max-w-48 truncate rounded-full px-2 py-0.5 text-xs" title={s.cost}>{s.cost}</span>{/if}
          {/snippet}
          {#if compact}
            <span class="min-w-0 flex-1">
              <span class="block font-medium">{s.title}</span>
              {#if !selfServe || s.cost}<span class="mt-1 flex gap-1.5">{@render tags()}</span>{/if}
            </span>
          {:else}
            <span class="flex-1 font-medium">{s.title}</span>
            {@render tags()}
          {/if}
          <ChevronDownIcon class="text-muted-foreground/60 size-4 shrink-0 transition-transform {open === s.id ? 'rotate-180' : ''}" />
        </button>
        {#if open === s.id}
          <div class="pb-3.5 pl-8.5 text-sm">
            <p class="text-muted-foreground">{s.how}</p>
            <p class="text-muted-foreground/80 mt-1.5 text-xs">
              <a class="hover:text-foreground underline underline-offset-2" href={s.source} target="_blank" rel="noreferrer">{host(s.source)}</a>
              · checked {date(s.checked)}{#if isStale(s.checked)}<span class="text-warn"> · stale</span>{/if}
            </p>
          </div>
        {/if}
      </li>
    {/each}
  </ol>
{:else}
  <p class="text-muted-foreground mt-3 text-sm">{name} is at its maximum privacy by default, or no steps are recorded yet.</p>
{/if}
