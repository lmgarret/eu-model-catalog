/** Vertical offsets 0, +step, -step, +2·step, -2·step… from the middle outwards. */
function* offsets(step: number) {
  yield 0;
  for (let k = 1; ; k++) yield* [k * step, -k * step];
}

/**
 * Vertical offset for each x so dots a `step` apart don't touch. Dots in `first` are placed first
 * (so they get the middle), then the rest, each group by ascending x. Offsets are clamped to ±half.
 */
export function dodge(xs: readonly number[], opts: { step: number; half: number; first?: ReadonlySet<number> }): number[] {
  const { step, half, first } = opts;
  const order = xs.map((x, i) => ({ x, i })).sort((a, b) => Number(!first?.has(a.i)) - Number(!first?.has(b.i)) || a.x - b.x);
  const ys = xs.map(() => 0);
  const placed: { x: number; y: number }[] = [];
  for (const { x, i } of order) {
    const near = placed.filter((p) => Math.abs(p.x - x) < step);
    for (const dy of offsets(step)) {
      if (near.every((p) => (p.x - x) ** 2 + (p.y - dy) ** 2 >= step ** 2)) {
        placed.push({ x, y: dy });
        ys[i] = Math.max(-half, Math.min(half, dy));
        break;
      }
    }
  }
  return ys;
}

/** Row (0, 1, 2…) for each label centred at `xs[i]`, so labels in the same row never overlap. */
export function labelRows(xs: readonly number[], widths: readonly number[], gap: number): number[] {
  const rows = xs.map(() => 0);
  const ends: number[] = [];
  const order = xs.map((x, i) => ({ x, i, w: widths[i] ?? 0 })).sort((a, b) => a.x - b.x);
  for (const { x, i, w } of order) {
    let row = ends.findIndex((end) => end + gap <= x - w / 2);
    if (row < 0) row = ends.length;
    ends[row] = x + w / 2;
    rows[i] = row;
  }
  return rows;
}

/** A model drawn in its own colour on a benchmark strip, with an optional name label. */
export interface Highlight {
  key: string;
  color: string;
  label?: string;
}
