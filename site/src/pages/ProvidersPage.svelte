<script lang="ts">
  import ProvidersTable from "../components/ProvidersTable.svelte";
</script>

<section class="flex flex-wrap items-end justify-between gap-4 pt-12 pb-6">
  <div>
    <h1 class="text-3xl font-semibold tracking-tight">Providers</h1>
    <p class="text-muted-foreground mt-1.5">European companies serving AI models through an API.</p>
  </div>
  <p class="text-muted-foreground/80 text-sm">Scores at each provider's maximum self-serve privacy setup</p>
</section>

<ProvidersTable />
<p class="text-muted-foreground/80 mt-4 text-xs">Mostly the providers' own claims. Open a provider for sources and the setup steps.</p>
