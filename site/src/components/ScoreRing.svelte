<script lang="ts">
  import type { Score } from "$lib/scores.js";

  interface Props {
    score?: Score;
    label: string;
    size?: number;
  }

  let { score, label, size = 44 }: Props = $props();

  const r = 16;
  const c = 2 * Math.PI * r;
  const outer = r + 3.2;
  const tone = $derived(
    score === undefined ? "var(--muted-foreground)" : score.value >= 70 ? "var(--good)" : score.value >= 40 ? "var(--warn)" : "var(--bad)",
  );
  const title = $derived(
    score
      ? `${label} ${score.value}/100, from facts covering ${Math.round(score.coverage * 100)}% of the weight`
      : `${label}: no facts yet`,
  );
</script>

<span class="relative inline-grid shrink-0 place-items-center" style:width="{size}px" style:height="{size}px" {title}>
  <svg viewBox="0 0 40 40" width={size} height={size} class="absolute inset-0 overflow-visible" aria-hidden="true">
    <circle cx="20" cy="20" {r} fill="none" stroke="var(--muted)" stroke-width="4" />
    {#if score}
      <circle
        cx="20"
        cy="20"
        {r}
        fill="none"
        stroke={tone}
        stroke-width="4"
        stroke-linecap="round"
        stroke-dasharray="{(score.value / 100) * c} {c}"
        transform="rotate(-90 20 20)"
        class="transition-[stroke-dasharray] duration-300"
      />
      {#if score.coverage < 1}
        <!-- Dashed arc: the share of the weight with no known fact. -->
        <circle
          cx="20"
          cy="20"
          r={outer}
          fill="none"
          stroke="var(--border)"
          stroke-width="1.2"
          stroke-dasharray="{(1 - score.coverage) * 2 * Math.PI * outer} {2 * Math.PI * outer}"
          transform="rotate(-90 20 20) scale(1 -1) translate(0 -40)"
        />
      {/if}
    {/if}
  </svg>
  <span class="font-semibold tabular-nums" style:color={tone} style:font-size="{size * 0.32}px">{score?.value ?? "–"}</span>
</span>
