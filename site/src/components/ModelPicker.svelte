<!-- A button that opens a search over the catalog's models of one type, for adding a model to a comparison. -->
<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Command from "$lib/components/ui/command/index.js";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import { app } from "$lib/state.svelte.js";
  import Logo from "./Logo.svelte";

  interface Props {
    /** Only models of this type are listed. */
    mode: string;
    /** Keys already shown, left out of the list. */
    exclude: string[];
    onpick: (key: string) => void;
    /** The button text. */
    label: string;
  }

  let { mode, exclude, onpick, label }: Props = $props();

  let open = $state(false);

  const options = $derived(
    app
      .groups(app.offers)
      .filter((g) => g.mode === mode && !exclude.includes(g.key) && g.offers.some((o) => !o.deprecated))
      .map((g) => ({ g, lab: g.lab ? app.catalog?.labs[g.lab] : undefined })),
  );

  function pick(key: string) {
    open = false;
    onpick(key);
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="outline" size="sm">{label}</Button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content class="w-80 p-0" align="start">
    <Command.Root>
      <Command.Input placeholder="Search models or labs…" />
      <Command.List>
        <Command.Empty>No match.</Command.Empty>
        <Command.Group>
          {#each options as { g, lab } (g.key)}
            <Command.Item value="{g.name} {lab?.name ?? ''} {g.key}" onSelect={() => pick(g.key)}>
              <Logo name={lab?.name ?? g.name} logo={lab?.logo} color={lab?.color} size={18} />
              <span class="truncate">{g.name}</span>
              <!-- Marked as a shortcut so the item leaves out its check mark. -->
              {#if lab}<span data-slot="command-shortcut" class="text-muted-foreground ml-auto shrink-0 text-xs">{lab.name}</span>{/if}
            </Command.Item>
          {/each}
        </Command.Group>
      </Command.List>
    </Command.Root>
  </Popover.Content>
</Popover.Root>
