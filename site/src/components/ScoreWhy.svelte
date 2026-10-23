<!-- Why a provider gets its score: each criterion's rating and weight. -->
<script lang="ts">
  import type { Score } from "$lib/scores.js";

  let { score, label, onTune }: { score?: Score; label: string; onTune?: () => void } = $props();

  const unknown = $derived(score?.parts.filter((p) => !p.rating).length ?? 0);
  const bar = (v: number) => (v >= 0.7 ? "bg-good" : v >= 0.4 ? "bg-warn" : "bg-bad");
</script>

<div class="flex items-baseline justify-between gap-4">
  <h3 class="font-semibold">{score ? `Why ${score.value} for ${label.toLowerCase()}` : `${label}: no facts yet`}</h3>
  {#if onTune}
    <button class="text-muted-foreground hover:text-foreground text-xs" onclick={onTune}>Adjust weights</button>
  {:else if unknown}
    <span class="text-muted-foreground text-xs">{unknown} of {score?.parts.length} facts unknown</span>
  {/if}
</div>
{#if score}
  <div class="mt-3 border-t">
    {#each score.parts as p (p.criterion.id)}
      <div
        class="grid grid-cols-[1fr_7rem_2.5rem] items-center gap-3 border-b py-2.5 text-sm"
        title="{p.criterion.rule}{p.rating ? ` · ${p.rating.reason}` : ''}{p.via ? ` · with “${p.via.title}”` : ''}"
      >
        <span class={p.rating ? "" : "text-muted-foreground"}>{p.criterion.label}</span>
        {#if p.rating}
          <span class="bg-muted block h-1 overflow-hidden rounded-full">
            <span class="block h-full rounded-full {bar(p.rating.value)}" style:width="{p.rating.value * 100}%"></span>
          </span>
        {:else}
          <span class="text-muted-foreground text-xs">unknown</span>
        {/if}
        <span class="text-muted-foreground text-right font-mono text-xs">×{p.weight}</span>
      </div>
    {/each}
  </div>
{/if}
