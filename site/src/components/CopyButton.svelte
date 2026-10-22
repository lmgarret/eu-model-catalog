<script lang="ts">
  import CheckIcon from "@lucide/svelte/icons/check";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import { Button } from "$lib/components/ui/button/index.js";

  let { text, label = "Copy" }: { text: string; label?: string } = $props();

  let copied = $state(false);

  async function copy(e: MouseEvent) {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    copied = true;
    setTimeout(() => (copied = false), 1200);
  }
</script>

<Button variant="ghost" size="icon-xs" onclick={copy} title="{label}: {text}" aria-label="{label}: {text}">
  {#if copied}<CheckIcon class="text-good" />{:else}<CopyIcon />{/if}
</Button>
