<script lang="ts">
  import { cn } from "$lib/utils.js";

  interface Props {
    name: string;
    /** File name in public/logos, without extension. */
    logo?: string;
    color?: string;
    size?: number;
    class?: string;
  }

  let { name, logo, color, size = 28, class: className }: Props = $props();

  const initials = $derived(
    name
      .split(/[\s-]+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
  );
</script>

<span
  class={cn("inline-grid shrink-0 place-items-center rounded-md ring-1 ring-inset", className)}
  style:width="{size}px"
  style:height="{size}px"
  style:--tint={color ?? "var(--muted-foreground)"}
  style:background="color-mix(in oklab, var(--tint) 14%, var(--card))"
  style:--tw-ring-color="color-mix(in oklab, var(--tint) 24%, transparent)"
  title={name}
  aria-label={name}
  role="img"
>
  {#if logo}
    <span
      class="size-[66%] bg-(--tint) [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
      style:mask-image="url(logos/{logo}.svg)"
      style:-webkit-mask-image="url(logos/{logo}.svg)"
    ></span>
  {:else}
    <span class="font-bold tracking-tight text-(--tint)" style:font-size="{size * 0.38}px">{initials}</span>
  {/if}
</span>
