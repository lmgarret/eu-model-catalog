<!-- A row of rounded pills picking one value, e.g. the model type. -->
<script lang="ts" generics="T extends string">
  import { cn } from "$lib/utils.js";

  interface Props {
    options: { value: T; label: string; count?: number }[];
    value: T;
    class?: string;
  }

  let { options, value = $bindable(), class: className }: Props = $props();
</script>

<div class={cn("flex flex-wrap items-center gap-1 text-sm", className)} role="tablist">
  {#each options as o (o.value)}
    <button
      role="tab"
      aria-selected={value === o.value}
      class="rounded-full px-3 py-1 transition-colors {value === o.value
        ? 'bg-foreground text-background'
        : 'text-muted-foreground hover:text-foreground hover:bg-muted'}"
      onclick={() => (value = o.value)}
    >
      {o.label}{#if o.count !== undefined}<span class="ml-1.5 text-xs tabular-nums opacity-55">{o.count}</span>{/if}
    </button>
  {/each}
</div>
