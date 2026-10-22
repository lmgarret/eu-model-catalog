<script lang="ts">
  import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { ACCESS_LABEL, isStale } from "$lib/facts.js";
  import { date } from "$lib/format.js";
  import type { SetupStep } from "$lib/types.js";

  let { steps, name }: { steps: SetupStep[]; name: string } = $props();

  const host = (url: string) => new URL(url).host.replace(/^www\./, "");
</script>

<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2"><ShieldCheckIcon class="text-good size-5" /> Maximum privacy setup</Card.Title>
    <Card.Description>
      {#if steps.length}
        What to do with {name} for the most privacy. Scores assume the self-serve steps; steps on request or for
        enterprise contracts are listed but not counted.
      {:else}
        {name} is at its maximum privacy by default, or no steps are recorded yet.
      {/if}
    </Card.Description>
  </Card.Header>
  {#if steps.length}
    <Card.Content>
      <ol class="flex flex-col gap-4">
        {#each steps as s, i (s.id)}
          <li class="flex gap-3">
            <span class="bg-muted grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold">{i + 1}</span>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2 font-medium">
                {s.title}
                <Badge variant={s.access === "self_serve" ? "secondary" : "outline"} class={s.access === "self_serve" ? "bg-good/12 text-good" : "text-warn"}>
                  {ACCESS_LABEL[s.access]}
                </Badge>
                {#if s.cost}<Badge variant="outline">{s.cost}</Badge>{/if}
              </div>
              <p class="text-muted-foreground mt-1 text-sm">{s.how}</p>
              <p class="text-muted-foreground/80 mt-1 text-xs">
                <a class="hover:text-foreground underline underline-offset-2" href={s.source} target="_blank" rel="noreferrer">{host(s.source)}</a>
                · checked {date(s.checked)}
                {#if isStale(s.checked)}<Badge variant="outline" class="text-warn ml-1">stale</Badge>{/if}
              </p>
            </div>
          </li>
        {/each}
      </ol>
    </Card.Content>
  {/if}
</Card.Root>
