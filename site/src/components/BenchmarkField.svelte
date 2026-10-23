<!--
  Where one model stands on a benchmark: the catalog's models (dots, linking to their page) and the
  reference models from benchmarks.yaml (rings), on the source's own scale. A percentile axis would
  just space the dots evenly. The vertical spread only keeps dots from overlapping.
-->
<script lang="ts">
  import { href, peek } from "$lib/state.svelte.js";
  import type { Benchmark, Fields } from "$lib/types.js";

  interface Dot {
    name: string;
    value: number;
    kind: "current" | "ours" | "reference";
    /** Model page, for catalog models. */
    key?: string;
    /** The reference's family. */
    family?: string;
  }

  interface Props {
    benchmark: Benchmark;
    field?: NonNullable<Fields[Benchmark]>;
    /** The catalog's models with a score on this benchmark. */
    ours: { key: string; name: string; source: string; value: number }[];
    /** This model's key, when it has a score. */
    current?: string;
  }

  let { benchmark, field, ours, current }: Props = $props();

  const STEP = 9; // dot spacing
  const PAD = 8;
  const HALF = 30; // fixed, so the cards line up; the rare dot beyond it is pulled in
  const AXIS = 18;
  const height = 2 * HALF + AXIS;

  let width = $state(0);
  let hovered = $state<(Dot & { x: number; y: number }) | null>(null);

  const all = $derived.by((): Dot[] => {
    const names = new Set(ours.map((o) => o.source));
    return [
      ...ours.map((o): Dot => ({ name: o.name, value: o.value, key: o.key, kind: o.key === current ? "current" : "ours" })),
      ...(field?.references ?? [])
        .filter((r) => !names.has(r.name))
        .map((r): Dot => ({ name: r.name, value: r.value, family: r.family, kind: "reference" })),
    ];
  });
  const lo = $derived(Math.min(...all.map((d) => d.value)));
  const hi = $derived(Math.max(...all.map((d) => d.value)));
  const x = (v: number) => PAD + ((v - lo) / (hi - lo || 1)) * (width - 2 * PAD);

  /** Rows from the middle outwards: 0, +1, -1, +2, -2… steps. */
  function* rows() {
    yield 0;
    for (let k = 1; ; k++) yield* [k * STEP, -k * STEP];
  }

  /** Each dot goes to the row nearest the middle where it doesn't touch an earlier one. */
  const dots = $derived.by(() => {
    if (!width) return [];
    const placed: (Dot & { x: number; y: number })[] = [];
    for (const d of [...all].sort((a, b) => a.value - b.value)) {
      const px = x(d.value);
      const near = placed.filter((p) => Math.abs(p.x - px) < STEP);
      for (const dy of rows()) {
        if (near.every((p) => (p.x - px) ** 2 + (p.y - dy) ** 2 >= STEP ** 2)) {
          placed.push({ ...d, x: px, y: Math.max(-HALF + 5, Math.min(HALF - 5, dy)) });
          break;
        }
      }
    }
    // The current model on top.
    return placed.sort((a, b) => Number(a.kind === "current") - Number(b.kind === "current"));
  });
  const here = $derived(dots.find((d) => d.kind === "current"));

  const fmt = (v: number) => (benchmark === "math" ? `${Math.round(v * 100)}%` : v.toFixed(0));

  function hover(e: PointerEvent) {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect();
    const [mx, my] = [e.clientX - r.left, e.clientY - r.top - HALF];
    let nearest: (typeof dots)[number] | null = null;
    let dist = 10 ** 2;
    for (const d of dots) {
      const dd = (d.x - mx) ** 2 + (d.y - my) ** 2;
      if (dd >= dist) continue;
      nearest = d;
      dist = dd;
    }
    hovered = nearest;
  }
</script>

<div class="relative mt-4" bind:clientWidth={width}>
  {#if width && all.length}
    <svg
      {width}
      {height}
      role="img"
      aria-label="{ours.length} catalog models and {all.length - ours.length} reference models, from {fmt(lo)} to {fmt(hi)}"
      onpointermove={hover}
      onpointerleave={() => (hovered = null)}
    >
      {#if here}<line x1={here.x} x2={here.x} y1="0" y2={height - AXIS + 2} class="stroke-brand/50" />{/if}
      <g transform="translate(0 {HALF})">
        {#each dots as d (d.name)}
          {#if d.kind === "reference"}
            <circle cx={d.x} cy={d.y} r="3.5" class="fill-card stroke-muted-foreground" stroke-width="1.5" />
          {:else if d.kind === "ours"}
            <a href={href.model(d.key!)} aria-label={d.name} onclick={(e) => peek(e, { kind: "model", id: d.key! })}><circle cx={d.x} cy={d.y} r="4" class="fill-foreground/55 stroke-card" stroke-width="2" /></a>
          {:else}
            <circle cx={d.x} cy={d.y} r="5.5" class="fill-brand stroke-card" stroke-width="2" />
          {/if}
        {/each}
      </g>
      <line x1={PAD} x2={width - PAD} y1={height - AXIS + 2} y2={height - AXIS + 2} class="stroke-border" />
      <text x={PAD} y={height - 3} class="fill-muted-foreground font-mono text-[10px]">{fmt(lo)}</text>
      <text x={width - PAD} y={height - 3} text-anchor="end" class="fill-muted-foreground font-mono text-[10px]">{fmt(hi)}</text>
    </svg>
    {#if hovered}
      <div
        class="bg-popover text-popover-foreground ring-foreground/10 pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md px-2 py-1 text-xs whitespace-nowrap shadow-md ring-1"
        style:left="{Math.min(Math.max(hovered.x, 70), width - 70)}px"
        style:top="{hovered.y + HALF - 10}px"
      >
        {hovered.name} <span class="text-muted-foreground font-mono">{fmt(hovered.value)}</span>
      </div>
    {/if}
    <div class="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 text-[11px]">
      {#if here}<span class="inline-flex items-center gap-1"><span class="bg-brand size-2 rounded-full"></span>This model</span>{/if}
      <span class="inline-flex items-center gap-1"><span class="bg-foreground/55 size-2 rounded-full"></span>In this catalog</span>
      <span class="inline-flex items-center gap-1" title="The latest Claude, GPT and Gemini models, and the best open-weight model">
        <span class="border-muted-foreground size-2 rounded-full border-[1.5px]"></span>Frontier references
      </span>
    </div>
  {/if}
</div>
