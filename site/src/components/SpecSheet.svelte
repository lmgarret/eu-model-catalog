<script lang="ts">
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { type SpecRow, specGridColumns, specGridMinWidth } from "$lib/compare.js";
  import { app, href, peek } from "$lib/state.svelte.js";
  import Logo from "./Logo.svelte";

  /** The compared models' specs side by side, grouped, with a toggle that keeps only the rows that differ. */
  let { rows, colors }: { rows: SpecRow[]; colors: string[] } = $props();

  let onlyDiffs = $state(false);

  const n = $derived(rows[0]?.cells.length ?? 0);
  const sections = $derived.by(() => {
    const out: { group: SpecRow["group"]; rows: SpecRow[] }[] = [];
    for (const r of onlyDiffs ? rows.filter((r) => r.differs) : rows) {
      if (out.at(-1)?.group !== r.group) out.push({ group: r.group, rows: [] });
      out.at(-1)!.rows.push(r);
    }
    return out;
  });
  const missing = (text: string) => text === "–" || text.startsWith("Not rated by");
</script>

<div>
  <label class="flex w-fit items-center gap-2 text-sm">
    <Switch bind:checked={onlyDiffs} />
    Only show differences
  </label>
  <div class="mt-3 overflow-x-auto">
    <div role="table" class="grid text-sm" style:grid-template-columns={specGridColumns(n)} style:min-width={specGridMinWidth(n)}>
      {#each sections as s (s.group)}
        <div role="row" class="contents">
          <div role="columnheader" class="col-span-full border-b pt-6 pb-2">
            <span class="bg-background sticky left-0 pr-3 text-xs font-medium tracking-wide uppercase">{s.group}</span>
          </div>
        </div>
        {#each s.rows as r (r.label)}
          <div role="row" class="contents">
            <div role="rowheader" class="text-muted-foreground bg-background sticky left-0 z-10 border-b py-2.5 pr-3">{r.label}</div>
            {#each r.cells as c, i (i)}
              <div role="cell" class="border-b px-3 py-2.5">
                <div class="flex items-center gap-2">
                  {#if c.providers}
                    <span class="flex -space-x-1">
                      {#each c.providers as p (p)}
                        {@const f = app.catalog?.providers[p]?.facts}
                        <a href={href.provider(p)} title={f?.name ?? p} onclick={(e) => peek(e, { kind: "provider", id: p })}>
                          <Logo name={f?.name ?? p} logo={f?.logo} color={f?.color} size={22} class="ring-background ring-2" />
                        </a>
                      {/each}
                    </span>
                  {/if}
                  <span class="tabular-nums {missing(c.text) ? 'text-muted-foreground' : ''}">{c.text}</span>
                  {#if c.best}<span class="text-good text-xs font-medium">best</span>{/if}
                </div>
                {#if c.sub}<div class="text-muted-foreground mt-0.5 text-xs tabular-nums">{c.sub}</div>{/if}
                {#if c.bar !== undefined}
                  <div class="bg-muted mt-1.5 h-1 w-full max-w-40 overflow-hidden rounded-full">
                    <div class="h-full rounded-full" style:width="{c.bar}%" style:background-color={colors[i]}></div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/each}
      {/each}
    </div>
  </div>
</div>
