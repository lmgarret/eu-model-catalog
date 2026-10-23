<!--
  Price against a benchmark for the chat models: the cheapest output price on a log scale, the
  percentile on the benchmark picked above the chart. Highlighted models are drawn in their colour
  with a label; the dashed steps are the best-value line, through the models no cheaper one beats.
-->
<script lang="ts">
  import { scaleLog } from "d3-scale";
  import { Chart, Layer, Tooltip } from "layerchart/svg";
  import { type Highlight } from "$lib/beeswarm.js";
  import { BENCHMARKS, BENCHMARK_INFO } from "$lib/benchmarks.js";
  import { type PricePoint, bestValueFrontier, missingFromScatter, scatterPoints } from "$lib/compare.js";
  import { fromUsd, money } from "$lib/format.js";
  import type { ModelGroup } from "$lib/models.js";
  import { app, href, peek } from "$lib/state.svelte.js";
  import type { Benchmark } from "$lib/types.js";
  import PillTabs from "./PillTabs.svelte";

  interface Props {
    /** Every model in the catalog; the chat ones with a price and a score become dots. */
    all: ModelGroup[];
    highlights: (Highlight & { group: ModelGroup })[];
    benchmark: Benchmark;
  }

  let { all, highlights, benchmark = $bindable() }: Props = $props();

  const HEIGHT = 320;
  const PAD = { left: 30, right: 12, top: 24, bottom: 22 };
  const LABEL_H = 14;

  let width = $state(0);
  const inner = $derived(width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const currency = $derived(app.currency.value);
  const local = (p: PricePoint) => ({ ...p, price: fromUsd(p.price, currency, app.catalog!.exchange_rates) });
  const points = $derived(scatterPoints(all, benchmark).map(local));
  const frontier = $derived(bestValueFrontier(points));
  const lit = $derived.by(() => {
    const byKey = new Map(points.map((p) => [p.key, p]));
    return highlights.flatMap((h) => {
      const p = byKey.get(h.key);
      return p ? [{ ...p, color: h.color, label: h.label ?? h.group.name }] : [];
    });
  });
  const grey = $derived(points.filter((p) => !lit.some((l) => l.key === p.key)));
  const missing = $derived(missingFromScatter(highlights.map((h) => h.group), benchmark));

  /** The price range, widened a little so the end dots aren't cut. */
  const domain = $derived.by((): [number, number] => {
    const prices = points.map((p) => p.price);
    return [Math.min(...prices) / 1.3, Math.max(...prices) * 1.3];
  });

  /** 4 to 6 round prices across the domain: the finest of these mantissa sets that gives at most 6. */
  const ticks = $derived.by(() => {
    const [lo, hi] = domain;
    const sets = [[1, 1.5, 2, 3, 5, 7], [1, 2, 5], [1, 3], [1]];
    const within = (ms: number[]) => {
      const out: number[] = [];
      for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++)
        for (const m of ms) {
          const v = Number((m * 10 ** e).toPrecision(2));
          if (v >= lo && v <= hi) out.push(v);
        }
      return out;
    };
    return sets.map(within).find((t) => t.length <= 6) ?? within([1]);
  });

  const scale = $derived(scaleLog().domain(domain).range([0, inner]));
  const sx = (price: number) => scale(price);
  const sy = (score: number) => plotH - (score / 100) * plotH;

  /** The best-value steps: along at each model's score until the next one's price, then up to its score. */
  const stepPath = $derived(
    frontier.map((p, i) => (i === 0 ? `M${sx(p.price)},${sy(p.score)}` : `H${sx(p.price)}V${sy(p.score)}`)).join(""),
  );

  /**
   * Label boxes for the highlights: the first of above, below, right or left of the dot that stays
   * inside the plot and clears the labels placed so far and the other highlight dots, preferring
   * one that clears the grey dots too.
   */
  const labels = $derived.by(() => {
    type Box = { x: number; y: number; w: number; h: number };
    const placed: (Box & { key: string; text: string; color: string })[] = [];
    const hits = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const dots = lit.map((d): Box => ({ x: sx(d.price) - 7, y: sy(d.score) - 7, w: 14, h: 14 }));
    const greyBoxes = grey.map((d): Box => ({ x: sx(d.price) - 4, y: sy(d.score) - 4, w: 8, h: 8 }));
    for (const [i, d] of lit.entries()) {
      const cx = sx(d.price);
      const cy = sy(d.score);
      const w = d.label.length * 6.5;
      const h = LABEL_H;
      const options: Box[] = [
        ...[1, 2, 3].map((k) => ({ x: cx - w / 2, y: cy - 8 - k * h, w, h })),
        ...[0, 1, 2].map((k) => ({ x: cx - w / 2, y: cy + 8 + k * h, w, h })),
        { x: cx + 10, y: cy - h / 2, w, h },
        { x: cx - 10 - w, y: cy - h / 2, w, h },
      ].map((b) => ({ ...b, x: Math.min(Math.max(b.x, 0), inner - w) }));
      const free = (b: Box) =>
        b.y >= -PAD.top && b.y + b.h <= plotH && !placed.some((p) => hits(p, b)) && !dots.some((o, j) => j !== i && hits(o, b));
      const clear = (b: Box) => !greyBoxes.some((o) => hits(o, b));
      const box = options.find((b) => free(b) && clear(b)) ?? options.find(free) ?? options[0]!;
      placed.push({ ...box, key: d.key, text: d.label, color: d.color });
    }
    return placed;
  });

  const price = (v: number) => money(v, currency);
</script>

<div>
  <PillTabs options={BENCHMARKS.map((b) => ({ value: b, label: BENCHMARK_INFO[b].label }))} bind:value={benchmark} />
  <div class="mt-3" bind:clientWidth={width}>
    {#if width && points.length}
      <Chart
        data={points}
        x="price"
        y="score"
        xScale={scaleLog()}
        xDomain={domain}
        yDomain={[0, 100]}
        padding={PAD}
        {width}
        height={HEIGHT}
        tooltipContext={{ mode: "quadtree", radius: 12 }}
      >
        {#snippet children({ context })}
          <Layer type="svg" role="img" aria-label="{points.length} models by output price and {BENCHMARK_INFO[benchmark].label} percentile">
            {#each [0, 25, 50, 75, 100] as t (t)}
              <line x1="0" x2={inner} y1={sy(t)} y2={sy(t)} class="stroke-border" stroke-dasharray={t ? "2 3" : undefined} />
              <text x="-6" y={sy(t) + 3} text-anchor="end" class="fill-muted-foreground font-mono text-[10px]">{t}</text>
            {/each}
            {#each ticks as t (t)}
              <text x={sx(t)} y={plotH + 15} text-anchor="middle" class="fill-muted-foreground font-mono text-[10px]">{price(t)}</text>
            {/each}
            <path d={stepPath} class="stroke-muted-foreground fill-none" stroke-width="1.5" stroke-dasharray="5 4" />
            {#each grey as d (d.key)}
              <a href={href.model(d.key)} aria-label={d.name} onclick={(e) => peek(e, { kind: "model", id: d.key })}
                ><circle cx={sx(d.price)} cy={sy(d.score)} r="4" class="fill-foreground/35 stroke-card" stroke-width="1.5" /></a
              >
            {/each}
            {#each lit as d (d.key)}
              <circle cx={sx(d.price)} cy={sy(d.score)} r="6" fill={d.color} class="stroke-card" stroke-width="2" />
            {/each}
            {#each labels as l (l.key)}
              <text
                x={l.x + l.w / 2}
                y={l.y + l.h - 3}
                text-anchor="middle"
                fill={l.color}
                class="stroke-card text-[11px] font-medium"
                stroke-width="3"
                paint-order="stroke">{l.text}</text
              >
            {/each}
          </Layer>
          <Tooltip.Root
            x={Math.min(Math.max(PAD.left + sx(context.tooltip.data?.price ?? domain[0]), 90), width - 90)}
            y="data"
            anchor="bottom"
            yOffset={10}
            contained={false}
            motion="none"
            portal={false}
            variant="none"
            classes={{ root: "bg-popover text-popover-foreground ring-foreground/10 rounded-md px-2 py-1 text-xs whitespace-nowrap shadow-md ring-1" }}
          >
            {#snippet children({ data })}
              {data.name}
              <span class="text-muted-foreground font-mono">{price(data.price)} · {data.score} /100</span>
            {/snippet}
          </Tooltip.Root>
        {/snippet}
      </Chart>
      <div class="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 text-[11px]">
        <span class="inline-flex items-center gap-1"><span class="bg-foreground/35 size-2 rounded-full"></span>In this catalog</span>
        <span class="inline-flex items-center gap-1"><span class="border-muted-foreground w-4 border-t-[1.5px] border-dashed"></span>Best value</span>
        <span>Output price per 1M tokens, cheapest host</span>
      </div>
    {/if}
    {#if missing.length}
      <p class="text-muted-foreground mt-2 text-xs">Not shown: {missing.map((m) => `${m.name} (${m.why})`).join(", ")}</p>
    {/if}
  </div>
</div>
