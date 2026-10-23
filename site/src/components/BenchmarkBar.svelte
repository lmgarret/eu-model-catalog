<script lang="ts">
  import { BENCHMARK_INFO, describeScore } from "$lib/benchmarks.js";
  import type { Benchmark, BenchmarkScore } from "$lib/types.js";

  let { benchmark, score, range }: { benchmark: Benchmark; score: BenchmarkScore; range?: [number, number] } = $props();

  // The scales don't start at 0, so the lowest score still gets a sliver of bar.
  const width = $derived(range && range[1] > range[0] ? 8 + (92 * (score.value - range[0])) / (range[1] - range[0]) : 100);
</script>

<span class="inline-flex items-center gap-2" title={describeScore(benchmark, score)}>
  <span class="bg-muted h-1.5 w-14 overflow-hidden rounded-full">
    <span class="block h-full rounded-full {score.stale_since ? 'bg-warn' : 'bg-primary/70'}" style:width="{width}%"></span>
  </span>
  <span class="w-9 text-right font-mono text-[13px] tabular-nums">{BENCHMARK_INFO[benchmark].format(score.value)}</span>
</span>
