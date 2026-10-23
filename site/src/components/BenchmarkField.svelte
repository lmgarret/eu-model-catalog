<!--
  Where models stand on a benchmark: the catalog's models (dots, linking to their page) and the
  reference models from benchmarks.yaml (rings), on the source's own scale. A percentile axis would
  just space the dots evenly. The vertical spread only keeps dots from overlapping. Highlighted
  models are drawn in their colour with a guide line, and with `size="wide"` their labels above.
-->
<script lang="ts">
  import { Chart, Layer, Tooltip } from "layerchart/svg";
  import { dodge, labelRows, type Highlight } from "$lib/beeswarm.js";
  import { href, peek } from "$lib/state.svelte.js";
  import type { Benchmark, Fields } from "$lib/types.js";

  interface Dot {
    name: string;
    value: number;
    kind: "highlight" | "ours" | "reference";
    /** Model page, for catalog models. */
    key?: string;
    /** The reference's family. */
    family?: string;
    /** For highlights. */
    color?: string;
    label?: string;
  }

  interface Props {
    benchmark: Benchmark;
    field?: NonNullable<Fields[Benchmark]>;
    /** The catalog's models with a score on this benchmark. */
    ours: { key: string; name: string; source: string; value: number }[];
    /** Models drawn in their own colour, placed first so they keep the middle. */
    highlights: Highlight[];
    /** The card height, or a taller strip with room for labels. */
    size?: "card" | "wide";
  }

  let { benchmark, field, ours, highlights, size = "card" }: Props = $props();

  const STEP = 9; // dot spacing
  const PAD = 8;
  const AXIS = 18;
  const ROW = 16; // label row height
  /** Fixed, so the cards line up; the rare dot beyond it is pulled in. */
  const half = $derived(size === "wide" ? 35 : 25);
  const frame = $derived(half + 5);

  let width = $state(0);

  const all = $derived.by((): Dot[] => {
    const names = new Set(ours.map((o) => o.source));
    const byKey = new Map(highlights.map((h) => [h.key, h]));
    return [
      ...ours.map((o): Dot => {
        const h = byKey.get(o.key);
        return { name: o.name, value: o.value, key: o.key, kind: h ? "highlight" : "ours", color: h?.color, label: h?.label };
      }),
      ...(field?.references ?? [])
        .filter((r) => !names.has(r.name))
        .map((r): Dot => ({ name: r.name, value: r.value, family: r.family, kind: "reference" })),
    ];
  });
  const lo = $derived(Math.min(...all.map((d) => d.value)));
  const hi = $derived(Math.max(...all.map((d) => d.value)));
  const inner = $derived(width - 2 * PAD);
  const px = (v: number) => ((v - lo) / (hi - lo || 1)) * inner;

  /** Each dot with its vertical offset; highlights last, so they're drawn on top. */
  const dots = $derived.by(() => {
    if (!width) return [];
    const first = new Set(all.flatMap((d, i) => (d.kind === "highlight" ? [i] : [])));
    const ys = dodge(
      all.map((d) => px(d.value)),
      { step: STEP, half, first },
    );
    return all.map((d, i) => ({ ...d, dy: ys[i]! })).sort((a, b) => Number(a.kind === "highlight") - Number(b.kind === "highlight"));
  });
  const lit = $derived(dots.filter((d) => d.kind === "highlight"));

  /** Labels for the highlights that have one, kept inside the strip and stacked in rows so they don't overlap. */
  const labels = $derived.by(() => {
    if (size !== "wide") return [];
    const shown = lit.filter((d) => d.label);
    const widths = shown.map((d) => d.label!.length * 6.5);
    const xs = shown.map((d, i) => Math.min(Math.max(px(d.value), widths[i]! / 2), inner - widths[i]! / 2));
    const rows = labelRows(xs, widths, 8);
    return shown.map((d, i) => ({ key: d.key!, text: d.label!, color: d.color!, x: xs[i]!, row: rows[i]! }));
  });
  const band = $derived(labels.length ? (Math.max(...labels.map((l) => l.row)) + 1) * ROW : 0);
  const height = $derived(band + 2 * frame + AXIS);
  /** Where each highlight's guide line starts: under its label, or the top of the strip. */
  const guideTop = (key: string) => {
    const l = labels.find((l) => l.key === key);
    return l ? -l.row * ROW - 2 : -band;
  };

  const fmt = (v: number) => (benchmark === "math" ? `${Math.round(v * 100)}%` : v.toFixed(0));
  const unlabelled = $derived(highlights.length === 1 && !highlights[0]!.label ? highlights[0] : undefined);
</script>

<div class="mt-4" bind:clientWidth={width}>
  {#if width && all.length}
    <Chart
      data={dots}
      x="value"
      y="dy"
      xDomain={[lo, hi === lo ? lo + 1 : hi]}
      yDomain={[-frame, frame]}
      yRange={[0, 2 * frame]}
      padding={{ left: PAD, right: PAD, top: band, bottom: AXIS }}
      {width}
      {height}
      tooltipContext={{ mode: "quadtree", radius: 10 }}
    >
      {#snippet children({ context })}
        <Layer
          type="svg"
          role="img"
          aria-label="{ours.length} catalog models and {all.length - ours.length} reference models, from {fmt(lo)} to {fmt(hi)}"
        >
          {#each lit as d (d.key)}
            <line x1={context.xScale(d.value)} x2={context.xScale(d.value)} y1={guideTop(d.key!)} y2={2 * frame + 2} stroke={d.color} stroke-opacity="0.5" />
          {/each}
          {#each labels as l (l.key)}
            <text x={l.x} y={-l.row * ROW - 5} text-anchor="middle" fill={l.color} class="text-[11px] font-medium">{l.text}</text>
          {/each}
          {#each dots as d (d.key ?? `ref:${d.name}`)}
            {@const cx = context.xScale(d.value)}
            {@const cy = context.yScale(d.dy)}
            {#if d.kind === "reference"}
              <circle {cx} {cy} r="3.5" class="fill-card stroke-muted-foreground" stroke-width="1.5" />
            {:else if d.kind === "ours"}
              <a href={href.model(d.key!)} aria-label={d.name} onclick={(e) => peek(e, { kind: "model", id: d.key! })}><circle {cx} {cy} r="4" class="fill-foreground/55 stroke-card" stroke-width="2" /></a>
            {:else}
              <circle {cx} {cy} r="5.5" fill={d.color} class="stroke-card" stroke-width="2" />
            {/if}
          {/each}
          <line x1="0" x2={inner} y1={2 * frame + 2} y2={2 * frame + 2} class="stroke-border" />
          <text x="0" y={2 * frame + AXIS - 3} class="fill-muted-foreground font-mono text-[10px]">{fmt(lo)}</text>
          <text x={inner} y={2 * frame + AXIS - 3} text-anchor="end" class="fill-muted-foreground font-mono text-[10px]">{fmt(hi)}</text>
        </Layer>
        <!-- Above the dot, and kept from running far past the strip's ends. -->
        <Tooltip.Root
          x={Math.min(Math.max(PAD + context.xScale(context.tooltip.data?.value ?? lo), 70), width - 70)}
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
            {data.name} <span class="text-muted-foreground font-mono">{fmt(data.value)}</span>
          {/snippet}
        </Tooltip.Root>
      {/snippet}
    </Chart>
    <div class="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 text-[11px]">
      {#if unlabelled}
        <span class="inline-flex items-center gap-1"><span class="size-2 rounded-full" style:background-color={unlabelled.color}></span>This model</span>
      {:else}
        {#each highlights.filter((h) => h.label) as h (h.key)}
          <span class="inline-flex items-center gap-1"><span class="size-2 rounded-full" style:background-color={h.color}></span>{h.label}</span>
        {/each}
      {/if}
      <span class="inline-flex items-center gap-1"><span class="bg-foreground/55 size-2 rounded-full"></span>In this catalog</span>
      <span class="inline-flex items-center gap-1" title="The latest Claude, GPT and Gemini models, and the best open-weight model">
        <span class="border-muted-foreground size-2 rounded-full border-[1.5px]"></span>Frontier references
      </span>
    </div>
  {/if}
</div>
