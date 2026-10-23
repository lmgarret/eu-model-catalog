# Selecting and comparing models

Agreed on 2026-10-23. It replaces the "Selecting models" and "Compare page" items of phase 5 in `docs/plan.md`. The other two items of that phase (dot strips on the model page, and three benchmark sliders) shipped in the site redesign.

## Goal

People shortlist a few models and look at them together.
- **Any number of models:** the models list can be narrowed to the picks and then sorted.
- **Two or three models:** a compare page shows where they stand on benchmarks, what you get for the price, and every spec side by side.

## Picking models

### State: `site/src/lib/picks.svelte.ts`

- `keys`: the picked model group keys, in pick order. Saved to localStorage through `persisted("picks", [])`, so picks survive reloads.
- `only`: whether "Show only selected" is on. Kept in memory only, like the filters.
- `has(key)`, `toggle(key)`, `clear()`. Clearing, or unticking the last pick, also sets `only` to false.
- Keys that no longer match a model group are ignored wherever picks are read. They aren't pruned from storage, so a model that comes back after a build keeps its pick.

### Models table: `ModelsTable.svelte`

- A new narrow first column holds a `ui/checkbox`, without a "select all" box in the header.
- Clicking the checkbox doesn't expand the row or open the side panel, because it stops the click from reaching the row.
- The column appears wherever the table does, so on Home and on lab pages.
- The expanded offer rows get an empty cell in that column.

### Tray: `PickTray.svelte`

Rendered by `App.svelte` on Home and lab pages, whenever at least one valid pick exists. It sits fixed at the bottom centre and holds, from left to right:
- Up to 4 name chips, each with ✕. Beyond 4, a "+n more" chip.
- A **Show only selected** switch. On a lab page, turning it on sets `only` and goes to Home.
- **Clear**.
- **Compare →**, a link to `href.compare(keys)`. It's enabled only with 2 or 3 picks of the same mode. Otherwise it's disabled and its label gives the reason: "Pick up to 3 to compare" for 4 or more, "Pick models of the same type" for mixed modes, and "Pick 2 or 3 to compare" for a single pick.

The tray must not cover the end of the list, so pages that show it get bottom padding the height of the tray.

### Home with "Show only selected" on

- The list is `app.groups(app.offers)`, built from every offer including deprecated ones, then filtered to the picked keys. Search, the filters, the type tabs and "hide deprecated" are ignored, so a pick never disappears.
- The filter chips and type tabs are replaced by one chip, "Selected only (n) ✕", which turns `only` off.
- The search box and the Filters button are disabled, with the title "Paused while showing selected".
- Sorting and row expanding work as usual. The table shows the type next to the license when the picks mix types, as it already does for mixed lists.
- Unticking a row removes it from the list straight away.

## Route

- `href.compare(keys)` gives `#/compare/` followed by each key URL-encoded and joined with `,`. `encodeURIComponent` turns `/` and `,` inside keys into `%2F` and `%2C`, so splitting the path on `,` is safe.
- `Route` gets `{ page: "compare"; ids: string[] }`. `parseRoute` accepts `#/compare/<ids>`, and also `#/compare` with no ids, which shows an empty page with Add slots. Duplicate ids are dropped, keeping the first.
- The "Models" nav item stays active on compare pages.
- The page reads its models from the URL only, not from the picks. Removing or adding a model on the page rewrites the URL with `history.replaceState` and updates `app.route`, and the picks stay as they were. Opening a shared link never changes the recipient's picks.

## Compare page: `site/src/pages/ComparePage.svelte`

### Colours

The three series colours are `#2a78d6`, `#eb6834` and `#1baf7a`, assigned in URL order. They were checked for colour-blind safety in light mode with the dataviz palette validator; only three stay distinguishable in dot and scatter charts, hence the cap. They're defined once as `--series-1…3` in `app.css`.

### Header

- One column per model: the colour swatch, the lab logo, the name (linking to the model page), the lab name, and a ✕ to remove it.
- While fewer than 3 models are shown, a **+ Add** slot opens `ModelPicker`.
- The header sticks below the site header while you scroll, and its columns line up with the spec sheet columns.

### `ModelPicker.svelte`

- A popover holding a `ui/command` search over model groups, matching name and lab. Groups whose offers are all deprecated are left out.
- Props:
  - `mode`, which limits the list to that type
  - `exclude`, the keys already shown
  - `onpick(key)`
- Used by **+ Add** on the compare page, and by a **Compare with…** button in the model page header. That button lists models of the same mode without the current one, and goes to `href.compare([current, picked])`.

### Charts (chat models only)

1. **Benchmark strips:** for each of Capabilities, Coding and Math, a full-width `BenchmarkField`. It draws the catalog models as grey dots and the frontier references as rings, as on the model page. The compare models are drawn in their series colour with a name label and a vertical guide line. A compare model without a score on that benchmark is listed after the strip's title as "not rated: <name>".
2. **Price vs benchmark scatter: `PriceScatter.svelte`.**
   - Horizontal axis: the cheapest output price per 1M tokens across the model's hosts, on a log scale, in the selected currency.
   - Vertical axis: the percentile on the chosen benchmark, picked with `PillTabs` (Capabilities / Coding / Math). It starts on `app.benchmark`, the benchmark currently picked in the table, but changing it here doesn't change `app.benchmark`.
   - Every chat model with both an output price and a score on that benchmark is a grey dot. The compare models are coloured and labelled. A compare model missing either value is listed under the chart as "Not shown: <name> (no price | not rated)".
   - The best-value line is drawn as dashed steps through the models that no cheaper model beats on the benchmark, computed over all the plotted models.
   - Hovering a dot shows the name, the price and the score.

### Spec sheet: `SpecSheet.svelte`

One column per model, with the row labels on the left, in these groups:

| Group | Rows | Better is |
|---|---|---|
| Benchmarks (chat only) | one row per benchmark: percentile out of 100, raw score, a bar in the series colour; "Not rated by <source>" when missing | higher percentile |
| Price | input /1M, output /1M, cheapest host | lower input, lower output |
| Hosting | hosts (count and logos), best privacy score, best eco score | more hosts, higher privacy, higher eco |
| Model | context, max output, released, knowledge cutoff, weights, license, then one ✓/– row each for tool calling, structured output, image input, audio input, reasoning | larger context, larger max output |

- **Prices:** each is the cheapest offer's price, converted with `fromUsd` like the models table. A model priced per page, minute or 1M characters shows that price with its unit in the input row. Prices are compared for "best" only when every model uses the same unit.
- **"Best" tag:** only on rows that have a "better" direction, and only when at least 2 models have a value and the values aren't all equal. Every model that ties for the best value is tagged.
- **"Only show differences":** a toggle above the sheet, off by default. It hides rows where every model shows the same value, missing values included.
- **Phones:** the sheet scrolls sideways, and the label column stays fixed on the left.

### Edge cases

- **Unknown key:** an "Unknown model" column with its ✕. It takes a colour slot but appears in no chart.
- **Fewer than 2 known models:** the header with Add slots, and "Add another model to compare". There are no charts and no spec sheet.
- **More than 3 keys:** the first 3 are shown, with the notice "Showing the first 3 of n".
- **Mixed modes from a link:** the notice "These models are of different types; only their specs are compared". There are no charts, and the Benchmarks group is left out of the sheet. **+ Add** lists the first model's mode.
- **Non-chat models** of one type get the header and the spec sheet without the Benchmarks group.

## Benchmark cards and strips

### `BenchmarkField.svelte` moves to LayerChart

- The look stays as it is: grey dots for catalog models, rings for references, an axis showing the minimum and maximum, a hover tooltip and a legend.
- `current?: string` is replaced by `highlights: { key: string; color: string; label?: string }[]`.
  - The model page passes the model in the brand colour without a label, and the legend shows "This model".
  - The compare page passes its models with series colours and labels, and the legend lists them by name.
- A new `size: "card" | "wide"` prop sets the card height used today, or a taller strip with room for labels.
- The code that keeps dots from overlapping moves to `site/src/lib/beeswarm.ts`. Highlights are placed first, so they keep the centre row.

### `BenchmarkCards.svelte` text

- The big number reads "93 /100". Its title is the existing `SCALE` text.
- Under it comes the rank in words: "Best of 27 models here", "4th of 27 models here". This is the existing `rankAmong`.
- The raw score stays as each benchmark gives it ("ECI 158 ±3", "1539 ±7 · 8,871 votes", "76% solved"), on the full model page only. The side panel (`compact`) leaves it out.
- The stale marker stays on whichever line is shown.

## Libraries

- Add `layerchart` (2.x, which supports Svelte 5) and the shadcn-svelte `chart` component, for the chart container, theme tokens and tooltip.
- The first implementation task installs both and checks that `typecheck` and `build` still pass with Tailwind 4 and bits-ui 2. If shadcn's `chart` doesn't fit our setup, we use LayerChart directly and style its tooltip with the popover classes `BenchmarkField` uses today.
- The CSS bars in `BenchmarkCell` and `ScoreWhy` stay as they are.

## Logic in plain TypeScript

These live in plain `.ts` files so the Vitest setup in `test/` can import them, as it already does for `site/src/lib/models.ts`.

- `site/src/lib/beeswarm.ts`: `dodge(values, { step, half, firstIndexes })` returns each dot's vertical offset.
- `site/src/lib/compare.ts`:
  - `compareHash(keys)` and `parseCompare(path)`
  - `specRows(groups, ctx)`, which returns the rows with their values, display text, "best" flags and whether they differ
  - `bestValueFrontier(points)`
  - the Compare button's enabled state and reason, given the picked groups

`href.compare` and `parseRoute` call `compare.ts`, so the URL logic is tested once.

## Testing

Unit tests go in `test/compare.test.ts`:
- Compare links round-trip keys containing `/` and `,`, an empty list, and duplicate keys (dropped, keeping the first).
- "Best" tagging:
  - higher is better, and lower is better for prices
  - ties tag every tied model
  - no tag when fewer than 2 values are known or all values are equal
  - no price tag when units differ
- "Only show differences": treats missing values as equal to each other.
- Best-value line: a point is on it only if no point is both cheaper (or as cheap) and better.
- Dot layout: no two dots closer than `step`, and highlights on the centre row when there's room.
- Compare button state: 1 pick, 2 or 3 picks of one mode, 4 picks, mixed modes.

Then:
- `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` must pass.
- Headless-Chrome screenshots of: Home with 5 picks and "only selected" on, a lab page with the tray, the compare page for three chat models, the compare page for two embedding models, a model page's cards, and the side panel's cards.

## Docs

Phase 5 in `docs/plan.md`:
- Mark the dot strips and the sliders as done.
- Replace the selection and compare items with a pointer to this spec.

## Out of scope

- Lab logos inside the charts: tried in a throwaway mockup and dropped as too busy.
- Comparing more than 3 models, and a "select all" box.
- Listing every host's prices on the compare page; the model page already does.
