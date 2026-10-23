<!-- A chat model's benchmark scores, one card each, on its page (three columns) or in the side panel (stacked). -->
<script lang="ts">
  import { BENCHMARKS, BENCHMARK_INFO, SCALE, SOURCES, rankAmong } from "$lib/benchmarks.js";
  import { date } from "$lib/format.js";
  import type { ModelGroup } from "$lib/models.js";
  import { app } from "$lib/state.svelte.js";
  import BenchmarkField from "./BenchmarkField.svelte";

  let { group: g, compact = false }: { group: ModelGroup; compact?: boolean } = $props();

  const all = $derived(app.groups(app.offers));
  /** Per benchmark, the catalog's models with a score on it. */
  const ours = $derived(
    Object.fromEntries(
      BENCHMARKS.map((b) => [
        b,
        all.flatMap((x) => {
          const s = x.scores?.[b];
          return s ? [{ key: x.key, name: x.name, source: s.name, value: s.value }] : [];
        }),
      ]),
    ),
  );
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
        <div class={compact ? "mt-1.5 flex items-baseline gap-3" : ""}>
          <div class="{compact ? 'text-3xl' : 'mt-2 text-4xl'} leading-none font-semibold tracking-tighter tabular-nums {s.stale_since ? 'text-warn' : ''}">{s.percentile}</div>
          <div>
            <div class="{compact ? '' : 'mt-2'} font-mono text-xs">{info.raw(s)}</div>
            <div class="text-muted-foreground mt-0.5 text-xs">
              {[rank && `#${rank.rank} of ${rank.of} in this catalog`, s.votes && `${s.votes.toLocaleString("en")} votes`].filter(Boolean).join(" · ")}
              {#if s.stale_since}<span class="text-warn"> · stale since {date(s.stale_since.slice(0, 10))}</span>{/if}
            </div>
          </div>
        </div>
      {:else}
        <div class="text-muted-foreground {compact ? 'mt-1.5' : 'mt-2 text-4xl leading-none font-semibold'}">
          {#if compact}<span class="text-xs">Not rated by {source.name}</span>{:else}–{/if}
        </div>
        {#if !compact}<div class="text-muted-foreground mt-2 text-xs">Not rated by {source.name}</div>{/if}
      {/if}
      <BenchmarkField benchmark={b} field={app.catalog?.benchmarks[b]} ours={ours[b]!} current={s && g.key} />
      {#if !compact}<p class="text-muted-foreground mt-3 text-xs">{info.about}</p>{/if}
    </div>
  {/each}
</div>
