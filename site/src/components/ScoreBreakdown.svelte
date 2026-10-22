<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
  import type { Score } from "$lib/scores.js";
  import { app } from "$lib/state.svelte.js";
  import ScoreRing from "./ScoreRing.svelte";

  let { score, label, onTune }: { score?: Score; label: string; onTune: () => void } = $props();
</script>

<Card.Root class="gap-3">
  <Card.Header class="flex flex-row items-center gap-3">
    <ScoreRing {score} {label} size={52} />
    <div>
      <Card.Title>{label} score</Card.Title>
      <Card.Description>
        {#if score}Facts cover {Math.round(score.coverage * 100)}% of the weight; unknowns count as 0.{:else}No facts yet.{/if}
        <button class="hover:text-foreground underline underline-offset-2" onclick={onTune}>Weights</button>
      </Card.Description>
    </div>
  </Card.Header>
  {#if score}
    <Card.Content>
      <table class="w-full text-sm">
        <tbody>
          {#each score.parts as p (p.criterion.id)}
            <tr class="border-t" title={p.criterion.rule}>
              <td class="py-1.5 pr-2">{p.criterion.label}</td>
              <td class="text-muted-foreground py-1.5 pr-2 text-right text-xs">
                {p.rating?.reason ?? "unknown"}
                {#if p.via}<span class="text-good block">with “{p.via.title}”</span>{/if}
              </td>
              <td class="w-24 py-1.5">
                <span class="bg-muted block h-1.5 overflow-hidden rounded-full">
                  <span class="bg-primary block h-full rounded-full" style:width="{(p.rating?.value ?? 0) * 100}%"></span>
                </span>
              </td>
              <td class="text-muted-foreground w-10 py-1.5 text-right text-xs tabular-nums">×{p.weight}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </Card.Content>
  {/if}
</Card.Root>
