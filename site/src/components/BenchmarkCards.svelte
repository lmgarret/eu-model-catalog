<!-- A chat model's benchmark scores, one card each, on its page (three columns) or in the side panel (stacked). -->
<script lang="ts">
  import { BENCHMARKS, BENCHMARK_INFO, SCALE, SOURCES, rankAmong, scoredOn } from "$lib/benchmarks.js";
  import { ordinal } from "$lib/compare.js";
  import { date } from "$lib/format.js";
  import type { ModelGroup } from "$lib/models.js";
  import { app } from "$lib/state.svelte.js";
  import BenchmarkField from "./BenchmarkField.svelte";

  let { group: g, compact = false }: { group: ModelGroup; compact?: boolean } = $props();

  const all = $derived(app.groups(app.offers));
  /** Per benchmark, the catalog's models with a score on it. */
  const ours = $derived(Object.fromEntries(BENCHMARKS.map((b) => [b, scoredOn(all, b)])));
</script>

<div class="grid gap-4 {compact ? '' : 'sm:grid-cols-3'}" title={SCALE}>
  {#each BENCHMARKS as b (b)}
    {@const s = g.scores?.[b]}
    {@const info = BENCHMARK_INFO[b]}
    {@const source = SOURCES[s?.source ?? info.source]}
    {@const rank = rankAmong(all, g, b)}
    <div class="flex flex-col rounded-xl border {compact ? 'p-3.5' : 'p-4'}">
      <div class="flex items-baseline justify-between gap-2">
        <h3 class="text-sm font-medium" title={compact ? info.about : undefined}>{info.label}</h3>
        <a class="text-muted-foreground hover:text-foreground text-xs" href={source.url} target="_blank" rel="noreferrer">{source.name} ↗</a>
      </div>
      {#if s}
        {@const raw = [!compact && info.raw(s), !compact && s.votes && `${s.votes.toLocaleString("en")} votes`].filter(Boolean).join(" · ")}
        {@const stale = s.stale_since && `stale since ${date(s.stale_since.slice(0, 10))}`}
        <div class={compact ? "mt-1.5 flex items-baseline gap-3" : ""}>
          <div class="{compact ? '' : 'mt-2'} leading-none tabular-nums" title={SCALE}>
            <span class="{compact ? 'text-3xl' : 'text-4xl'} font-semibold tracking-tighter {s.stale_since ? 'text-warn' : ''}">{s.percentile}</span>
            <span class="text-muted-foreground text-sm"> /100</span>
          </div>
          <div>
            {#if rank || (stale && !raw)}
              <div class="{compact ? '' : 'mt-2'} text-sm">
                {#if rank}{ordinal(rank.rank)} of {rank.of} models here{/if}
                {#if stale && !raw}<span class="text-warn">{rank ? " · " : ""}{stale}</span>{/if}
              </div>
            {/if}
            {#if raw}<div class="text-muted-foreground mt-0.5 font-mono text-xs">{raw}{#if stale}<span class="text-warn"> · {stale}</span>{/if}</div>{/if}
          </div>
        </div>
      {:else}
        <div class="text-muted-foreground {compact ? 'mt-1.5' : 'mt-2 text-4xl leading-none font-semibold'}">
          {#if compact}<span class="text-xs">Not rated by {source.name}</span>{:else}–{/if}
        </div>
        {#if !compact}<div class="text-muted-foreground mt-2 text-xs">Not rated by {source.name}</div>{/if}
      {/if}
      <BenchmarkField benchmark={b} field={app.catalog?.benchmarks[b]} ours={ours[b]!} highlights={s ? [{ key: g.key, color: "var(--brand)" }] : []} />
      {#if !compact}<p class="text-muted-foreground mt-3 text-xs">{info.about}</p>{/if}
    </div>
  {/each}
</div>
