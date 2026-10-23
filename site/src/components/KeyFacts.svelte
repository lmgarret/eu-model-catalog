<!-- A strip of the facts that matter most, at the provider's maximum self-serve privacy setup. -->
<script lang="ts">
  import { maxPrivacy } from "$lib/facts.js";
  import { EUROPE, countryName, flag } from "$lib/format.js";
  import type { ProviderFacts } from "$lib/types.js";

  let { facts }: { facts: ProviderFacts } = $props();

  type Tone = "good" | "warn" | "bad" | "none";
  const DOT: Record<Tone, string> = { good: "bg-good", warn: "bg-warn", bad: "bg-bad", none: "bg-muted-foreground/30" };
  const TRAINING = { never: "Never", opt_in: "Only if opted in", opt_out: "Unless opted out" } as const;
  const ZDR = { default: "zero retention by default", available: "zero retention available", on_request: "zero retention on request", no: "" } as const;

  const items = $derived.by(() => {
    const max = maxPrivacy(facts).facts;
    const p = facts.privacy;
    const j = facts.jurisdiction;
    const s = facts.sustainability;
    const training = max.privacy.training?.value;
    const days = max.privacy.retention?.value.days;
    const regions = max.jurisdiction.regions?.value;
    const outside = (r?: { country: string }[]) => [...new Set(r?.filter((x) => !EUROPE.has(x.country)).map((x) => x.country))];
    const entity = j.legal_entity?.value;
    const parent = j.parent_company?.value;
    const energy = s.renewable_energy?.value;
    const pue = s.pue?.value;
    const items: { label: string; text: string; tone: Tone; sub?: string }[] = [
      {
        label: "Trains on your data",
        text: training ? TRAINING[training] : "Unknown",
        tone: training === "never" ? "good" : training === "opt_in" ? "warn" : training ? "bad" : "none",
        sub: p.training && p.training.value !== training ? `default: ${TRAINING[p.training.value].toLowerCase()}` : undefined,
      },
      {
        label: "Retention",
        text: days === undefined ? "Unknown" : days === 0 ? "Not stored" : `${days} days`,
        tone: days === undefined ? "none" : days === 0 ? "good" : days <= 30 ? "warn" : "bad",
        sub:
          p.retention && p.retention.value.days !== days
            ? `default: ${p.retention.value.days} days`
            : days ? ZDR[p.zero_data_retention?.value ?? "no"] || undefined : undefined,
      },
      {
        label: "Data centers",
        text: regions ? (outside(regions).length ? `${regions.length}, some outside Europe` : `${regions.length} in Europe`) : "Unknown",
        tone: regions ? (outside(regions).length ? "warn" : "good") : "none",
        sub: outside(j.regions?.value).length && !outside(regions).length
          ? `default: also ${outside(j.regions?.value).map(flag).join(" ")}`
          : [...new Set(regions?.map((r) => r.country))].map(flag).join(" "),
      },
      {
        label: "Legal entity",
        text: entity ? countryName(entity.country) : "Unknown",
        tone: entity ? (EUROPE.has(entity.country) ? "good" : "bad") : "none",
        sub: parent ? (parent.us_cloud_act ? `US parent: ${parent.name}` : "no US parent") : undefined,
      },
      {
        label: "Renewable energy",
        text: energy ? `${energy.share}%` : "Unknown",
        tone: energy ? (energy.share >= 90 && energy.backing !== "certificates" ? "good" : energy.share >= 50 ? "warn" : "bad") : "none",
        sub: energy && energy.backing !== "unknown" ? energy.backing.replace("_", " ") : undefined,
      },
      {
        label: "PUE",
        text: pue ? String(pue) : "Unknown",
        tone: pue ? (pue <= 1.2 ? "good" : pue <= 1.4 ? "warn" : "bad") : "none",
        sub: pue ? "data center efficiency" : undefined,
      },
    ];
    return items;
  });
</script>

<div class="grid grid-cols-2 overflow-hidden rounded-2xl border sm:grid-cols-3 lg:grid-cols-6">
  {#each items as it (it.label)}
    <div class="border-r border-b p-4 last:border-r-0 lg:border-b-0">
      <div class="text-muted-foreground text-xs">{it.label}</div>
      <div class="mt-1.5 flex items-center gap-2 font-medium {it.tone === 'none' ? 'text-muted-foreground font-normal' : ''}">
        <span class="size-1.5 shrink-0 rounded-full {DOT[it.tone]}"></span>{it.text}
      </div>
      {#if it.sub}<div class="text-muted-foreground/80 mt-1 text-xs">{it.sub}</div>{/if}
    </div>
  {/each}
</div>
