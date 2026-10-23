<!-- A model's score on one benchmark, with all its scores on hover. Links to the model page. -->
<script lang="ts">
  import { BENCHMARKS, BENCHMARK_INFO } from "$lib/benchmarks.js";
  import * as HoverCard from "$lib/components/ui/hover-card/index.js";
  import type { ModelGroup } from "$lib/models.js";
  import { app, href, peek } from "$lib/state.svelte.js";
  import type { Benchmark, BenchmarkScore } from "$lib/types.js";

  let { group, benchmark }: { group: ModelGroup; benchmark: Benchmark } = $props();

  const score = $derived(group.scores?.[benchmark]);
  const labName = $derived(group.lab ? app.catalog?.labs[group.lab]?.name : undefined);
</script>

{#snippet bar(s: BenchmarkScore, width: string)}
  <span class="bg-muted h-1.5 {width} overflow-hidden rounded-full">
    <span class="block h-full rounded-full {s.stale_since ? 'bg-warn' : 'bg-primary/70'}" style:width="{Math.max(s.percentile, 4)}%"></span>
  </span>
{/snippet}

{#if score}
  <HoverCard.Root openDelay={250}>
    <HoverCard.Trigger href={href.model(group.key)} class="inline-flex items-center gap-2" onclick={(e: MouseEvent) => peek(e, { kind: "model", id: group.key })}>
      {@render bar(score, "w-14")}
      <span class="w-7 text-right font-mono text-[13px] tabular-nums">{score.percentile}</span>
    </HoverCard.Trigger>
    <HoverCard.Content class="w-72 p-3" align="start">
      <div class="font-medium">{group.name}</div>
      {#if labName}<div class="text-muted-foreground text-xs">{labName}</div>{/if}
      <div class="mt-3 grid grid-cols-[5.5rem_1.75rem_1fr_auto] items-center gap-x-2.5 gap-y-2 text-xs">
        {#each BENCHMARKS as b (b)}
          {@const s = group.scores?.[b]}
          <span class="text-muted-foreground">{BENCHMARK_INFO[b].label}</span>
          {#if s}
            <span class="text-right font-mono tabular-nums {s.stale_since ? 'text-warn' : ''}">{s.percentile}</span>
            {@render bar(s, "w-full")}
            <span class="text-muted-foreground text-right font-mono">{BENCHMARK_INFO[b].raw(s)}</span>
          {:else}
            <span class="text-muted-foreground col-span-3">not rated</span>
          {/if}
        {/each}
      </div>
      <a href={href.model(group.key)} class="text-brand mt-3 inline-block text-xs hover:underline" onclick={(e) => peek(e, { kind: "model", id: group.key })}>
        Details →
      </a>
    </HoverCard.Content>
  </HoverCard.Root>
{:else if group.mode === "chat"}
  <span class="text-muted-foreground">–</span>
{/if}
