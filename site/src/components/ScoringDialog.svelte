<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { Slider } from "$lib/components/ui/slider/index.js";
  import { CRITERIA, defaultWeights } from "$lib/scores.js";
  import { app } from "$lib/state.svelte.js";

  let { open = $bindable(false) }: { open: boolean } = $props();

  const set = (id: string, v: number) => (app.weights.value = { ...app.weights.value, [id]: v });
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-xl">
    <Dialog.Header>
      <Dialog.Title>How scores work</Dialog.Title>
      <Dialog.Description>
        Each provider gets two scores out of 100 from its fact sheet. A criterion rates 0–100% and counts by its weight.
        Privacy assumes the provider's maximum self-serve setup. Unknown facts count as 0; hover a score to see the
        share of the weight with a known fact. Weights are saved in this browser.
      </Dialog.Description>
    </Dialog.Header>
    {#each [["privacy", "Privacy & jurisdiction"], ["eco", "Sustainability"]] as const as [kind, title] (kind)}
      <h3 class="text-muted-foreground mt-2 text-xs font-medium tracking-wide uppercase">{title}</h3>
      <div class="divide-y">
        {#each CRITERIA[kind] as c (c.id)}
          {@const w = app.weights.value[c.id] ?? c.weight}
          <div class="grid grid-cols-[1fr_9rem_2rem] items-center gap-4 py-2">
            <div>
              <div class="text-sm font-medium">{c.label}</div>
              <div class="text-muted-foreground text-xs">{c.rule}</div>
            </div>
            <Slider type="single" value={w} max={50} step={5} onValueChange={(v) => set(c.id, v)} />
            <span class="text-right text-sm tabular-nums">{w}</span>
          </div>
        {/each}
      </div>
    {/each}
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (app.weights.value = defaultWeights())}>Reset weights</Button>
      <Button onclick={() => (open = false)}>Done</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
