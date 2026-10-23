# Selecting and Comparing Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** People tick any number of models in the models table, narrow the list to their picks, and compare 2–3 of them on a new page with benchmark strips, a price-vs-benchmark scatter and a spec sheet.

**Architecture:** The pure logic goes in plain `.ts` files under `site/src/lib/` that Vitest imports directly: dot layout, compare links, spec rows, "best" flags and the best-value line. Svelte components stay thin: they derive from `app` and render. Charts move to LayerChart, and the dot layout stays our own code.

**Tech Stack:** Svelte 5 (runes), Vite, Tailwind 4, shadcn-svelte on bits-ui 2, LayerChart 2.x, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-23-model-compare-design.md`. Read it before any task. Its tables and copy are binding.

## Global Constraints

- Package manager: `pnpm`. The only new runtime dependency is `layerchart` 2.x, plus `d3-scale` if LayerChart needs a scale passed in, with `@types/d3-scale` as a dev dependency.
- Files that tests import (`beeswarm.ts`, `compare.ts`) must not import `state.svelte.ts`, `picks.svelte.ts` or anything `.svelte`. They may import `models.ts`, `format.ts`, `benchmarks.ts` and types.
- Series colours, in URL order: `#2a78d6`, `#eb6834`, `#1baf7a`, as `--series-1`, `--series-2` and `--series-3` in `site/src/app.css`, with the same values in light and dark.
- Compare holds at most 3 models (`MAX_COMPARE = 3`).
- Copy, verbatim:
  - Compare button reasons: "Pick 2 or 3 to compare", "Pick up to 3 to compare", "Pick models of the same type".
  - Selection: "Show only selected", "Selected only (n) ✕", "Paused while showing selected".
  - Compare page: "Add another model to compare", "Showing the first 3 of n", "These models are of different types; only their specs are compared", "Unknown model", "not rated: <name>", "Not shown: <name> (no price | not rated)", "Not rated by <source>", "Only show differences", "Compare with…", "+ Add".
  - Cards: "Best of 27 models here", "4th of 27 models here".
- Match the surrounding code: Tailwind classes inline, one doc comment per component or function, no new state libraries.
- `pnpm typecheck` runs `svelte-check --fail-on-warnings`, so accessibility warnings fail the build.
- Commits use Conventional Commits.

## Review Focus

1. **Picks the catalog no longer has** (a model renamed or removed by a build): the tray count, the Compare button, the "only selected" list and the compare page must skip them, and must not crash or count them. Covered by the `resolveKeys` test in Task 3.
2. **Two highlighted models with nearly equal scores:** their labels on the wide strip would overlap. They must stack on separate rows. Covered by the `labelRows` test in Task 1.
3. **Models without an output price**, such as embeddings, rerankers and per-minute audio: no price "best" tag, no crash in the sheet, and "Not shown … (no price)" under the scatter. Covered by tests in Tasks 5 and 6.
4. **Switching currency on the compare page:** sheet and scatter prices re-render in the new currency, and the "best" flags stay the same, because they compare USD. Covered by the `specRows` currency test in Task 5.
5. **Clicking or pressing Space on the row checkbox** must tick it without expanding the row or opening the side panel. This is checked by hand in the Task 8 screenshot pass, because there are no component tests.

---

### Task 1: Dot layout and label rows in `beeswarm.ts`

**Files:**
- Create: `site/src/lib/beeswarm.ts`
- Create: `test/compare.test.ts`

**Interfaces:**
- Produces:
  - `dodge(xs: readonly number[], opts: { step: number; half: number; first?: ReadonlySet<number> }): number[]` returns a vertical offset for each x, in input order. Indexes in `first` are placed before the others.
  - `labelRows(xs: readonly number[], widths: readonly number[], gap: number): number[]` returns a row index (0, 1, 2…) for each label centred at `xs[i]`. Labels in the same row never overlap.

- [ ] **Step 1: Write the failing tests** in `test/compare.test.ts`, under `describe("beeswarm")`:
  - `dodge` with xs `[0, 2, 4, 30]`, step 9 and half 100: every pair `i ≠ j` has `Math.hypot(xs[i]-xs[j], y[i]-y[j]) >= 9 - 1e-9`, and `y[3] === 0`.
  - `dodge` with 20 identical xs and half 20: every `|y| <= 20`.
  - `dodge` with xs `[10, 10, 10]` and `first: new Set([2])`: `y[2] === 0`.
  - `labelRows` with xs `[100, 104, 400]`, widths `[80, 80, 80]` and gap 6: `[0, 1, 0]`.
- [ ] **Step 2: Run them and check they fail.** Run `pnpm test test/compare.test.ts`. Expected: FAIL, cannot resolve `../site/src/lib/beeswarm.js`.
- [ ] **Step 3: Implement both functions.**
  - `dodge` is the algorithm now inside `BenchmarkField.svelte`'s `dots` derived: the `rows()` generator, a nearest-row search that skips any row that would touch an earlier dot, and a clamp to `±half`. Move it here and generalise it to plain numbers. Placement order is `first` indexes, then the rest by ascending x.
  - `labelRows`: assign greedily left to right, each label taking the lowest row whose last right edge plus `gap` is at or before this label's left edge.
- [ ] **Step 4: Run the tests and check they pass.** `pnpm test test/compare.test.ts` should PASS.
- [ ] **Step 5: Commit** with `feat: dot layout helpers for benchmark strips`.

### Task 2: LayerChart and the multi-highlight `BenchmarkField`

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Create: `site/src/lib/components/ui/chart/*`, generated by the shadcn-svelte CLI
- Modify: `site/src/components/BenchmarkField.svelte`
- Modify: `site/src/components/BenchmarkCards.svelte`, only the `<BenchmarkField>` call
- Modify: `site/src/app.css`, to add `--series-1…3`

**Interfaces:**
- Consumes: `dodge` and `labelRows` from Task 1.
- Produces:
  - `export interface Highlight { key: string; color: string; label?: string }`, exported from `site/src/lib/beeswarm.ts` so pages can import it without a `.svelte` file.
  - `BenchmarkField` props: `{ benchmark: Benchmark; field?: NonNullable<Fields[Benchmark]>; ours: { key: string; name: string; source: string; value: number }[]; highlights: Highlight[]; size?: "card" | "wide" }`, where `size` defaults to `"card"`. The `current` prop is removed.

- [ ] **Step 1: Install the libraries.** Run `pnpm add layerchart`, then `pnpm dlx shadcn-svelte@latest add chart`. Look up the current LayerChart 2.x API (Chart, Svg, Axis, Points, Tooltip, log scales) and shadcn-svelte's `chart` docs with Context7 before writing chart code.
- [ ] **Step 2: Check the setup still builds.** Run `pnpm typecheck && pnpm build:site`; both should PASS. If the generated `chart` component fails `svelte-check`, delete it, keep `layerchart`, and style the tooltip with the popover classes used in today's `BenchmarkField` (see the spec, section Libraries).
- [ ] **Step 3: Rewrite `BenchmarkField` on LayerChart.**
  - Keep today's markup meaning: references as rings, catalog models as `fill-foreground/55` dots linking with `peek`, the min/max axis labels, the hover tooltip, the `aria-label` and the legend.
  - Highlights are drawn as r=5.5 dots in `color`, each with a vertical guide line, and placed first via `dodge`'s `first`.
  - With `size="card"`, `half` is 25, as today (HALF 30 minus 5). With `size="wide"`, `half` is 35, plus a label band above the dots sized by the maximum of `labelRows` × 16px.
  - Labels render only when `label` is set.
  - Legend: when exactly one highlight has no label, show "This model". Otherwise show one coloured entry per labelled highlight, then "In this catalog" and "Frontier references".
- [ ] **Step 4: Update the call in `BenchmarkCards`.** Pass `highlights={s ? [{ key: g.key, color: "var(--brand)" }] : []}`.
- [ ] **Step 5: Add the series colours.** Add `--series-1: #2a78d6; --series-2: #eb6834; --series-3: #1baf7a;` to both theme blocks in `app.css`.
- [ ] **Step 6: Check it.**
  - Run `pnpm typecheck && pnpm lint && pnpm test`; all should PASS.
  - Run `pnpm dev`, open a chat model's page (for example `#/models/moonshotai%2Fkimi-k3`) and the side panel, and check the strips look like they did before. Hover should show names, and clicking a catalog dot should open the side panel.
- [ ] **Step 7: Commit** with `refactor: benchmark strips on LayerChart with multiple highlights`.

### Task 3: Card text, compare links and route

**Files:**
- Modify: `site/src/components/BenchmarkCards.svelte`
- Create: `site/src/lib/compare.ts`
- Modify: `site/src/lib/state.svelte.ts` (`Route`, `parseRoute`, `href`, a new `replaceCompare`)
- Modify: `site/src/App.svelte`, so the "Models" nav item is active for `compare`
- Test: `test/compare.test.ts`

**Interfaces:**
- Produces, in `compare.ts`:
  - `MAX_COMPARE = 3`
  - `SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)"] as const`
  - `compareHash(keys: readonly string[]): string`, for example `["mistral/a","x,y"]` → `"#/compare/mistral%2Fa,x%2Cy"`
  - `parseCompare(segment: string | undefined): string[]`, which decodes each part, drops empty parts, and drops duplicates keeping the first
  - `resolveKeys(keys: readonly string[], groups: readonly ModelGroup[]): (ModelGroup | undefined)[]`, keeping input order
  - `ordinal(n: number): string`, giving "Best" for 1, then "2nd", "3rd", "4th", "11th", "12th", "13th", "21st"
- Produces, in `state.svelte.ts`:
  - `Route` gains `{ page: "compare"; ids: string[] }`
  - `href.compare = compareHash`
  - `app.replaceCompare(keys: string[]): void`, which calls `history.replaceState(null, "", compareHash(keys))` and updates the private `path` and `route`

- [ ] **Step 1: Write the failing tests**, under `describe("compare links")`:
  - `parseCompare(compareHash(["mistral/a", "x,y", "p/q%r"]).slice("#/compare/".length))` equals the input.
  - `parseCompare("")` and `parseCompare(undefined)` both give `[]`.
  - `parseCompare("a,b,a")` gives `["a","b"]`.
  - `resolveKeys(["gone", g1.key], [g1])` gives `[undefined, g1]`, where `g1` is a minimal `ModelGroup` literal cast with `as ModelGroup`.
  - `ordinal` maps 1, 2, 3, 4, 11, 12, 13 and 21 to "Best", "2nd", "3rd", "4th", "11th", "12th", "13th" and "21st".
- [ ] **Step 2: Run them and check they fail.** Run `pnpm test test/compare.test.ts`; expected FAIL.
- [ ] **Step 3: Implement `compare.ts` and the route changes.**
  - The `parseRoute` regex gains `compare`. For compare, pass the raw segment to `parseCompare`, without `decodeURIComponent` on the whole path.
  - Until Task 7, `App.svelte` renders Home for `page === "compare"`.
- [ ] **Step 4: Change the card text** in `BenchmarkCards`:
  - The big number becomes `{s.percentile}`, with a smaller muted `/100` after it and `title={SCALE}`.
  - Next comes `{ordinal(rank.rank)} of {rank.of} models here`, from `rankAmong`.
  - The raw line `info.raw(s)`, plus votes, shows only when `!compact`.
  - The stale marker stays on whichever line is last.
- [ ] **Step 5: Check it.** Run `pnpm test && pnpm typecheck`; both should PASS. On the model page, check the cards read "93 /100", "Best of 27 models here", "ECI 158 ±3". In the side panel, the raw line should be gone.
- [ ] **Step 6: Commit** with `feat: compare route and plainer benchmark cards`.

### Task 4: Picks, the checkbox column, the tray and "only selected"

**Files:**
- Create: `site/src/lib/picks.svelte.ts`
- Modify: `site/src/lib/compare.ts`, to add `canCompare`
- Modify: `site/src/components/ModelsTable.svelte`
- Create: `site/src/components/PickTray.svelte`
- Modify: `site/src/pages/Home.svelte`
- Modify: `site/src/App.svelte`, to render `<PickTray />` when `app.route.page` is `"home"` or `"lab"`
- Test: `test/compare.test.ts`

**Interfaces:**
- Consumes: `resolveKeys`, `MAX_COMPARE` and `href.compare` from Task 3.
- Produces:
  - `canCompare(groups: readonly Pick<ModelGroup, "mode">[]): { ok: true } | { ok: false; reason: string }`, in `compare.ts`
  - `picks` singleton, in `picks.svelte.ts`:
    - `keys: { value: string[] }`, via `persisted("picks", [])`
    - `only: boolean`, a `$state`
    - `has(key: string): boolean`, `toggle(key: string): void`, `clear(): void`
    - `clear()` and unticking the last key set `only = false`

- [ ] **Step 1: Write the failing tests**, under `describe("canCompare")`:
  - With 1 group, the result is `{ ok:false, reason:"Pick 2 or 3 to compare" }`.
  - With 2 chat groups, and with 3, the result is `{ ok:true }`.
  - With 4 chat groups, the reason is "Pick up to 3 to compare".
  - With `[chat, embedding]`, the reason is "Pick models of the same type".
  - With 4 groups of mixed modes, the reason is "Pick up to 3 to compare", because the count is checked first.
- [ ] **Step 2: Run them and check they fail.** Run `pnpm test test/compare.test.ts`; expected FAIL.
- [ ] **Step 3: Implement `canCompare` and `picks.svelte.ts`.**
- [ ] **Step 4: Run the tests and check they pass.** `pnpm test` should PASS.
- [ ] **Step 5: Add the checkbox column to `ModelsTable`.**
  - The column is the first, `w-10`, holding `<Checkbox checked={picks.has(g.key)} onCheckedChange={() => picks.toggle(g.key)} aria-label="Select {g.name}" />` in a cell with `onclick={(e) => e.stopPropagation()}`.
  - The header cell is empty, offer rows get an empty cell, and the "No model matches" colspan grows by 1.
- [ ] **Step 6: Build `PickTray`.**
  - The picked groups come from `resolveKeys(picks.keys.value, app.groups(app.offers)).filter(Boolean)`. The tray renders only when at least one exists.
  - Layout and copy follow the spec, section Tray: up to 4 chips, "+n more", a `ui/switch` bound to "Show only selected", Clear, and Compare as an `<a href={href.compare(keys)}>`, or a disabled button showing the `canCompare` reason.
  - On a lab page, turning the switch on also sets `location.hash = href.home`.
  - Home and LabPage get `pb-24` whenever the tray shows.
- [ ] **Step 7: Add "only selected" to `Home`.**
  - When `picks.only` is on, `shown` becomes the picked groups from `app.groups(app.offers)`, ignoring filters, the mode and the search box.
  - The filter chips and `PillTabs` are replaced by the "Selected only (n) ✕" chip, which sets `picks.only = false`.
  - The `Input` and `FiltersPanel` trigger are disabled with `title="Paused while showing selected"`. If `FiltersPanel` has no `disabled` prop, add one that passes through to its trigger.
- [ ] **Step 8: Check it.**
  - Run `pnpm typecheck && pnpm lint && pnpm test`; all should PASS.
  - In `pnpm dev`, tick 5 models: the tray shows 4 chips and "+1 more", and Compare reads "Pick up to 3 to compare".
  - Turn on "only selected": the list shows exactly the 5 picks, and sorting works.
  - Reload: the picks are still there and "only selected" is off.
  - Tick a model on a lab page: the tray appears there.
  - Clicking a checkbox, or pressing Space on it, never expands the row.
- [ ] **Step 9: Commit** with `feat: pick models in the table and show only the picks`.

### Task 5: Spec rows and the `SpecSheet`

**Files:**
- Modify: `site/src/lib/compare.ts`
- Create: `site/src/components/SpecSheet.svelte`
- Test: `test/compare.test.ts`

**Interfaces:**
- Consumes: `groupStats`, `fromUsd`, `money`, `tokens`, `date`, `BENCHMARKS`, `BENCHMARK_INFO`, `SOURCES`, and `Score` from `scores.ts` (type only).
- Produces, in `compare.ts`:
  - `bestFlags(values: readonly (number | undefined)[], better: "higher" | "lower"): boolean[]`
  - `interface SpecContext { catalog: Catalog; currency: Currency; providerScores: Record<string, { privacy?: Score; eco?: Score }> }`
  - `interface SpecCell { text: string; best: boolean; sub?: string; bar?: number; providers?: string[] }`, where `text` is "–" when the value is missing
  - `interface SpecRow { group: "Benchmarks" | "Price" | "Hosting" | "Model"; label: string; cells: SpecCell[]; differs: boolean }`
  - `specRows(groups: readonly (ModelGroup | undefined)[], ctx: SpecContext): SpecRow[]`. An `undefined` column gets "–" cells and is ignored by `best` and `differs`. The Benchmarks group is included only when every known group's mode is `chat`.
- `SpecSheet` props: `{ rows: SpecRow[]; colors: string[] }`.

- [ ] **Step 1: Write the failing tests**, under `describe("spec rows")`:
  - `bestFlags`:
    - `bestFlags([3, 5, 5], "higher")` gives `[false, true, true]`.
    - `bestFlags([3, 5], "lower")` gives `[true, false]`.
    - `bestFlags([4, 4], "higher")` gives `[false, false]`.
    - `bestFlags([4, undefined], "higher")` gives `[false, false]`.
  - `specRows` on two groups built from the fixture catalog, as in the `model groups` test in `test/site.test.ts`:
    - The rows' labels, in order, start with the Benchmarks rows for chat groups.
    - Context is tagged best on the larger one.
    - With `currency: "EUR"` and then `"CHF"`, the output cell texts differ, and the `best` arrays are equal.
  - Two embedding groups: there are no Benchmarks rows, and the Output row has no `best` when both are missing.
  - Per-unit prices: the Input row isn't tagged when one group is priced per minute and the other per 1M tokens.
  - `differs` is false for a row where both cells are "–".
- [ ] **Step 2: Run them and check they fail.** Run `pnpm test test/compare.test.ts`; expected FAIL.
- [ ] **Step 3: Implement `bestFlags` and `specRows`.**
  - Rows, labels and "better" directions follow the spec's table exactly.
  - Prices are compared in USD and shown with `money(fromUsd(...))`.
  - Benchmark cells use `text = "<percentile> /100"`, `sub = BENCHMARK_INFO[b].raw(s)` and `bar = percentile`. A missing score shows "Not rated by <SOURCES[info.source].name>".
  - The "Cheapest host" row names the provider of the offer with the lowest output price, or the lowest input price when no offer has an output price.
  - The Hosts cell sets `providers` to the unique provider ids.
  - Privacy and eco take the best `providerScores` value over the group's offers.
  - Feature rows show ✓ or –.
- [ ] **Step 4: Run the tests and check they pass.** `pnpm test` should PASS.
- [ ] **Step 5: Build `SpecSheet`.**
  - A table with one header row per group, and the label column `sticky left-0 bg-background`, inside an `overflow-x-auto` wrapper.
  - The "Only show differences" `ui/switch` above the table, off by default, filters on `row.differs`.
  - A best cell gets a small "best" badge in `text-good`. A `bar` cell shows a thin bar in `colors[i]`. A `providers` cell shows provider `Logo`s, as in `ModelsTable`.
- [ ] **Step 6: Check types and lint.** Run `pnpm typecheck && pnpm lint`; both should PASS.
- [ ] **Step 7: Commit** with `feat: compare spec sheet`.

### Task 6: Best-value line and `PriceScatter`

**Files:**
- Modify: `site/src/lib/compare.ts`
- Create: `site/src/components/PriceScatter.svelte`
- Test: `test/compare.test.ts`

**Interfaces:**
- Produces, in `compare.ts`:
  - `interface PricePoint { key: string; name: string; price: number; score: number }`, where `price` is USD per 1M output tokens and `score` is a percentile
  - `scatterPoints(groups: readonly ModelGroup[], b: Benchmark): PricePoint[]`, covering chat groups that have both `groupStats(g).output` and `g.scores?.[b]`
  - `missingFromScatter(groups: readonly ModelGroup[], b: Benchmark): { name: string; why: "no price" | "not rated" }[]`, where "not rated" wins when both are missing
  - `bestValueFrontier(points: readonly PricePoint[]): PricePoint[]`, sorted by ascending price
- `PriceScatter` props: `{ all: ModelGroup[]; highlights: (Highlight & { group: ModelGroup })[]; benchmark: Benchmark }`, where `benchmark` is `$bindable`.

- [ ] **Step 1: Write the failing tests**, under `describe("price scatter")`:
  - With points a(1, 50), b(2, 40), c(3, 70), d(3, 60) and e(5, 70), the frontier keys are `["a", "c"]`. b, d and e are each beaten by a point that is at least as cheap and scores higher.
  - `bestValueFrontier([])` gives `[]`.
  - `missingFromScatter` on one group with a score but no output price, and one with a price but no score, gives `[{why:"no price"}, {why:"not rated"}]`.
- [ ] **Step 2: Run them and check they fail.** Run `pnpm test test/compare.test.ts`; expected FAIL.
- [ ] **Step 3: Implement `scatterPoints`, `missingFromScatter` and `bestValueFrontier`.**
  - A point is on the line when no other point has `price <= p.price && score > p.score`.
- [ ] **Step 4: Run the tests and check they pass.** `pnpm test` should PASS.
- [ ] **Step 5: Build `PriceScatter` on LayerChart.**
  - Horizontal axis: a log scale over `fromUsd(price, app.currency.value, rates)`, with ticks formatted by `money`. Vertical axis: 0–100.
  - Points: grey `fill-foreground/35` dots for `scatterPoints(all, benchmark)`, and r=6 dots in each highlight's colour, with labels.
  - The frontier is drawn as a dashed `stroke-muted-foreground` step line.
  - The tooltip shows the name, the price and the score.
  - Above the chart: `PillTabs` over `BENCHMARKS`, bound to `benchmark`. Below it, the "Not shown: …" line for the highlights `missingFromScatter` returns.
- [ ] **Step 6: Check types and lint.** Run `pnpm typecheck && pnpm lint`; both should PASS.
- [ ] **Step 7: Commit** with `feat: price vs benchmark scatter`.

### Task 7: Compare page, model picker and the "Compare with…" button

**Files:**
- Create: `site/src/pages/ComparePage.svelte`
- Create: `site/src/components/ModelPicker.svelte`
- Modify: `site/src/App.svelte`, to render `{#key app.route.ids.join(",")}<ComparePage ids={app.route.ids} />{/key}` for `compare`
- Modify: `site/src/pages/ModelPage.svelte`, to add the "Compare with…" button in the header

**Interfaces:**
- Consumes:
  - From Task 3: `resolveKeys`, `MAX_COMPARE`, `SERIES`, `app.replaceCompare`, `href.compare`
  - From Task 5: `specRows`, `SpecSheet`
  - From Task 6: `PriceScatter`
  - From Task 2: `BenchmarkField` with `size="wide"`
- Produces: `ModelPicker` props `{ mode: string; exclude: string[]; onpick: (key: string) => void; label: string }`. It is a `ui/popover` with a `ui/command` list of groups whose offers are not all deprecated, filtered by `mode` and `exclude` and searchable by name and lab. `label` is the trigger text.

- [ ] **Step 1: Build `ModelPicker`.**
- [ ] **Step 2: Build `ComparePage`.**
  - `ids` is cut to the first `MAX_COMPARE`. When more were given, show "Showing the first 3 of n".
  - `cols` is `resolveKeys(...)` on the cut `ids`, and colour `i` is `SERIES[i]`.
  - Header: sticky at `top-15`, the site header's height. Each column has its swatch, `Logo`, a name link, the lab, and ✕, which calls `app.replaceCompare(ids without it)`. An unknown key shows "Unknown model" with ✕. While there are fewer than 3 columns, a "+ Add" `ModelPicker` slot follows, for the first known group's mode, or `"chat"` when there is none. It calls `app.replaceCompare([...ids, key])`.
  - Below the header, in order, following the spec's edge cases:
    - fewer than 2 known groups: "Add another model to compare", nothing else
    - mixed modes: the notice, then the `SpecSheet` without Benchmarks
    - all chat: the three wide `BenchmarkField`s, then `PriceScatter`, then the `SpecSheet`
    - one non-chat mode: the `SpecSheet` only
  - The header and `SpecSheet` use the same column template, a fixed label column followed by `repeat(n, minmax(12rem, 1fr))`, so their columns line up.
  - Each strip's title is followed by "· not rated: <names>" for the known groups without that score.
  - `PriceScatter`'s `benchmark` starts from `app.benchmark.value` in a local `$state`.
  - `SpecSheet` gets `rows = specRows(cols, { catalog, currency: app.currency.value, providerScores: app.scores })`.
- [ ] **Step 3: Add "Compare with…" on `ModelPage`.** It's a `ModelPicker` with `mode={g.mode}`, `exclude={[g.key]}`, `label="Compare with…"`, and `onpick` set to `(k) => (location.hash = href.compare([g.key, k]))`.
- [ ] **Step 4: Check it.**
  - Run `pnpm typecheck && pnpm lint && pnpm test`; all should PASS.
  - In `pnpm dev`:
    - Open `#/compare/moonshotai%2Fkimi-k3,zhipuai%2Fglm-5.3,mistral%2Fmistral-medium-2604`.
    - Remove one model with ✕ and add it back with + Add. The URL updates and Back doesn't step through each edit.
    - Switch the currency to CHF. The scatter and sheet prices change, and the best tags stay.
    - Open a link with an unknown key, one with 4 keys, one with a chat and an embedding model, and one with two embedding models. Each shows the notice or layout the spec gives for it.
- [ ] **Step 5: Commit** with `feat: compare page`.

### Task 8: Full check and screenshots

**Files:**
- None, unless a check fails. A fix goes in the task's own file, with a `fix:` commit.

- [ ] **Step 1: Run the full suite.** Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build`; all should PASS.
- [ ] **Step 2: Take screenshots.**
  - Run `pnpm build`, then serve it with `python3 -m http.server -d dist 4173`.
  - Capture these with headless Chrome at 1280px wide:
    - Home with 5 picks and "only selected" on
    - a lab page with the tray
    - the compare page for three chat models
    - the compare page for two embedding models
    - a model page's cards
    - the side panel's cards
  - Capture the compare page at 390px wide too.
  - Put the files in `/tmp/compare-shots/`. Read each one and fix overlaps, clipping or tray-covers-content before finishing.
- [ ] **Step 3: Check the checkbox by hand.** Clicking or pressing Space on a row checkbox doesn't expand the row or open the side panel. This is Review Focus 5.
- [ ] **Step 4: Commit any fixes,** then report the screenshot paths.
