<script lang="ts">
  import CheckIcon from "@lucide/svelte/icons/check";
  import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Command from "$lib/components/ui/command/index.js";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import Logo from "./Logo.svelte";

  interface Option {
    id: string;
    name: string;
    logo?: string;
    color?: string;
    hint?: string;
  }

  interface Props {
    label: string;
    options: Option[];
    selected: string[];
  }

  let { label, options, selected = $bindable() }: Props = $props();

  const toggle = (id: string) =>
    (selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const chosen = $derived(options.filter((o) => selected.includes(o.id)));
</script>

<Popover.Root>
  <Popover.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="outline" size="sm" class="gap-1.5 {selected.length ? 'border-primary/40' : ''}">
        {label}
        {#if chosen.length}
          <span class="flex -space-x-1">
            {#each chosen.slice(0, 4) as o (o.id)}<Logo name={o.name} logo={o.logo} color={o.color} size={16} />{/each}
          </span>
          {#if chosen.length > 4}<span class="text-muted-foreground text-xs">+{chosen.length - 4}</span>{/if}
        {/if}
        <ChevronsUpDownIcon class="text-muted-foreground" />
      </Button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content class="w-64 p-0" align="start">
    <Command.Root>
      <Command.Input placeholder="Search {label.toLowerCase()}…" />
      <Command.List>
        <Command.Empty>No match.</Command.Empty>
        <Command.Group>
          {#each options as o (o.id)}
            <Command.Item value="{o.name} {o.id}" onSelect={() => toggle(o.id)}>
              <Logo name={o.name} logo={o.logo} color={o.color} size={18} />
              <span class="truncate">{o.name}</span>
              {#if o.hint}<span class="text-muted-foreground ml-auto text-xs">{o.hint}</span>{/if}
              <CheckIcon class="ml-1 {selected.includes(o.id) ? '' : 'invisible'}" />
            </Command.Item>
          {/each}
        </Command.Group>
      </Command.List>
      {#if selected.length}
        <div class="border-t p-1">
          <Button variant="ghost" size="sm" class="w-full" onclick={() => (selected = [])}>Clear</Button>
        </div>
      {/if}
    </Command.Root>
  </Popover.Content>
</Popover.Root>
