<script lang="ts">
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { ACCESS_LABEL, factSections, isStale } from "$lib/facts.js";
  import { date } from "$lib/format.js";
  import type { ProviderFacts } from "$lib/types.js";

  let { facts }: { facts: ProviderFacts } = $props();

  const host = (url: string) => new URL(url).host.replace(/^www\./, "");
  const TONE = { good: "bg-good", warn: "bg-warn", bad: "bg-bad" } as const;
</script>

<div class="grid gap-4 lg:grid-cols-2">
  {#each factSections(facts) as section (section.title)}
    <Card.Root class="gap-0 py-0">
      <Card.Header class="border-b py-4">
        <Card.Title class="text-muted-foreground text-xs font-medium tracking-wide uppercase">{section.title}</Card.Title>
      </Card.Header>
      <Card.Content class="px-0">
        <dl class="divide-y">
          {#each section.rows as r (r.label)}
            <div class="grid grid-cols-[11rem_1fr] gap-4 px-6 py-3">
              <dt class="text-sm font-medium">
                {r.label}
                <span class="text-muted-foreground block text-xs font-normal">{r.hint}</span>
              </dt>
              <dd class="min-w-0 text-sm">
                {#if r.text}
                  <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span class="flex items-center gap-2">
                      {#if r.tone}<span class="size-2 shrink-0 rounded-full {TONE[r.tone]}"></span>{/if}
                      {#if r.href}<a class="underline underline-offset-2" href={r.href} target="_blank" rel="noreferrer">{r.text}</a>{:else}{r.text}{/if}
                    </span>
                    {#if r.best}
                      <ArrowRightIcon class="text-muted-foreground size-3.5" />
                      <span class="flex items-center gap-2 font-medium">
                        {#if r.best.tone}<span class="size-2 shrink-0 rounded-full {TONE[r.best.tone]}"></span>{/if}
                        {r.best.text}
                      </span>
                      {#if r.best.step}
                        <Badge variant="outline" class={r.best.step.access === "self_serve" ? "text-good" : "text-warn"}>
                          {r.best.step.title} · {ACCESS_LABEL[r.best.step.access].toLowerCase()}
                        </Badge>
                      {/if}
                    {/if}
                  </div>
                  {#if r.claim?.note}<p class="text-muted-foreground mt-1 text-xs">{r.claim.note}</p>{/if}
                  {#if r.claim}
                    <p class="text-muted-foreground/80 mt-1 text-xs">
                      <a class="hover:text-foreground underline underline-offset-2" href={r.claim.source} target="_blank" rel="noreferrer">{host(r.claim.source)}</a>
                      · checked {date(r.claim.checked)}
                      {#if isStale(r.claim.checked)}<Badge variant="outline" class="text-warn ml-1">stale</Badge>{/if}
                    </p>
                  {/if}
                {:else}
                  <span class="text-muted-foreground">Unknown</span>
                {/if}
              </dd>
            </div>
          {/each}
        </dl>
      </Card.Content>
    </Card.Root>
  {/each}
</div>
