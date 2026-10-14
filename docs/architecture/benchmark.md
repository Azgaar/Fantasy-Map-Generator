# Benchmark

`npm run benchmark` measures a change against the commit it branched from: the same map is generated,
drawn, zoomed and panned on both builds, and the report says what got slower.

## What is compared

**Before** is the merge-base of `HEAD` and `--base` (default `origin/master`, so a stale local `master` is
not the baseline). A branch that is behind `master` is not blamed for what landed there since. **After** is the working tree, uncommitted changes included. On a
pull request that is the PR merged into its base branch.

Both are built with Vite and served side by side, then loaded in fresh, offline Chromium profiles on the
same machine.

## What is tracked

One map: seed `benchmark`, 10k cells, a 1280×720 viewport, the default style and layers.

| Total            | What it is                                                                   |
| ---------------- | ---------------------------------------------------------------------------- |
| Generate the map | the Generation Pipeline, start to end                                        |
| Draw the map     | every layer draw during load, summed                                         |
| Zoom: page work  | main-thread time of 22 wheel ticks in to the 20× maximum and 22 back out     |
| Zoom: painting   | raster time of the same zoom                                                 |
| Pan: page work   | main-thread time of a 600 px drag right and back at 20×, 30 steps each way   |
| Pan: painting    | raster time of the same pan                                                  |

Generation and drawing come from the app's own `performance.measure` entries: `Pipeline.run` records each
step and `Layers.draw` each renderer. Zoom and pan are real mouse input, one event per frame, each followed
by the settle redraw d3 fires when the gesture ends, and their time comes from a Chrome trace.

Page work (script, style, layout, paint recording) and painting (raster) are separate totals because they
fail differently: a slow zoom handler is page work, a costly SVG change is painting. Raster is most of a
gesture's time, more so on slower machines, so a sum would let page work double before it showed.

## Reading the report

The headline is the verdict: **✅ No slowdowns** or **🔴 Slower:** and what. Below it, one row per total
says _no change_, _N% faster_ or _N% slower_. **Details** lists the generation steps and layers that changed.

A total changes when the median of its per-round after/before ratios moves over 15% **and** every round
agrees; a part needs 25% and at least 10 ms. Between identical builds the totals stay within about 10% (zoom
painting at 20× is the noisiest) and the parts within about 15%, so the thresholds sit clear of the noise.

The benchmark is a monitor, not a gate: a slower number turns the report red and never fails the check. The
check fails only when the benchmark itself cannot run, such as a build that breaks.

## When it runs

- **On a pull request to `master`** that changes `src`. The report is a PR comment, updated on every push; a
  fork's token cannot comment, so there it is the job summary of the Benchmark check.
- **By hand**, from the Actions tab or locally.

Each round runs before and after, alternating which goes first so machine drift hits both sides equally:
3 rounds after a warm-up.

## Running it locally

```bash
npm run benchmark                          # the working tree vs where it branched from origin/master
npm run benchmark -- --base v1.155.0       # vs where it branched from another ref
npm run benchmark -- --rounds 7            # more rounds for a tighter median
```

The base is checked out into a temporary worktree that shares this checkout's `node_modules`.

## Changing what is tracked

Keep it to one map and six totals. New work is covered by making it a pipeline step or a layer. Add a
gesture to `sample` in `scripts/benchmark.mjs` only when a real regression slipped past the six totals.
