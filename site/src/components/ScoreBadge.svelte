<script lang="ts">
  import type { Score } from "$lib/scores.js";
  import { cn } from "$lib/utils.js";

  let { score, label }: { score?: Score; label: string } = $props();

  const tone = $derived(
    score === undefined
      ? "bg-muted text-muted-foreground"
      : score.value >= 70
        ? "bg-good/12 text-good"
        : score.value >= 40
          ? "bg-warn/15 text-warn"
          : "bg-bad/12 text-bad",
  );
</script>

<span
  class={cn("inline-grid h-5 min-w-8 place-items-center rounded-md px-1.5 text-xs font-semibold tabular-nums", tone)}
  title={score ? `${label} ${score.value}/100, ${Math.round(score.coverage * 100)}% of the weight known` : `${label}: no facts`}
>
  {score?.value ?? "–"}
</span>
