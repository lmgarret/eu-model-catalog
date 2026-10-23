<script lang="ts">
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import { ACCESS_LABEL, factSections, isStale } from "$lib/facts.js";
  import { date } from "$lib/format.js";
  import type { ProviderFacts } from "$lib/types.js";

  let { facts }: { facts: ProviderFacts } = $props();

  const host = (url: string) => new URL(url).host.replace(/^www\./, "");
  const TONE = { good: "bg-good", warn: "bg-warn", bad: "bg-bad" } as const;
</script>

<div class="grid gap-x-12 gap-y-10 lg:grid-cols-2">
  {#each factSections(facts) as section (section.title)}
    <section>
      <h3 class="font-semibold">{section.title}</h3>
      <dl class="mt-3 border-t">
        {#each section.rows as r (r.label)}
          <div class="grid grid-cols-[10rem_1fr] gap-4 border-b py-3 text-sm">
            <dt class="text-muted-foreground" title={r.hint}>{r.label}</dt>
            <dd class="min-w-0">
              {#if r.text}
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span class="flex items-center gap-2">
                    {#if r.tone}<span class="size-1.5 shrink-0 rounded-full {TONE[r.tone]}"></span>{/if}
                    {#if r.href}<a class="underline underline-offset-2" href={r.href} target="_blank" rel="noreferrer">{r.text}</a>{:else}{r.text}{/if}
                  </span>
                  {#if r.best}
                    <ArrowRightIcon class="text-muted-foreground size-3.5" />
                    <span class="flex items-center gap-2 font-medium">
                      {#if r.best.tone}<span class="size-1.5 shrink-0 rounded-full {TONE[r.best.tone]}"></span>{/if}
                      {r.best.text}
                    </span>
                    {#if r.best.step}
                      <span
                        class="rounded-full px-2 py-0.5 text-xs {r.best.step.access === 'self_serve' ? 'bg-good/12 text-good' : 'bg-warn/15 text-warn'}"
                        title={r.best.step.title}
                      >
                        {ACCESS_LABEL[r.best.step.access].toLowerCase()}
                      </span>
                    {/if}
                  {/if}
                </div>
                {#if r.claim?.note}<p class="text-muted-foreground mt-1 text-xs leading-relaxed">{r.claim.note}</p>{/if}
                {#if r.claim}
                  <p class="text-muted-foreground/70 mt-1 text-xs">
                    <a class="hover:text-foreground underline underline-offset-2" href={r.claim.source} target="_blank" rel="noreferrer">{host(r.claim.source)}</a>
                    · checked {date(r.claim.checked)}{#if isStale(r.claim.checked)}<span class="text-warn"> · stale</span>{/if}
                  </p>
                {/if}
              {:else}
                <span class="text-muted-foreground">Unknown</span>
              {/if}
            </dd>
          </div>
        {/each}
      </dl>
    </section>
  {/each}
</div>
