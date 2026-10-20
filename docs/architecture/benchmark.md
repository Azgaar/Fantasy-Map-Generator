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

| Total            | What it is                                                                        |
| ---------------- | --------------------------------------------------------------------------------- |
| Generate the map | the Generation Pipeline, start to end                                             |
| Draw the map     | every layer draw during load, summed                                              |
| Zoom: page work  | main-thread time of zooming in to the 20× maximum and back out, at three spots    |
| Zoom: painting   | raster time of the same zooms                                                     |
| Pan: page work   | main-thread time of one 100-step drag around a 400×300 px square at 20×           |
| Pan: painting    | raster time of the same pan                                                       |

Generation and drawing come from the app's own `performance.measure` entries: `Pipeline.run` records each
step and `Layers.draw` each renderer.

Zoom and pan are real mouse input, one event per frame, and their time comes from a Chrome trace. Each zoom
is 22 wheel ticks in and 22 out at the biggest city, the biggest port and the deepest sea in the middle of
the screen, so dense labels, coast and open water are all covered. Every input must draw exactly one frame
(counted as writes to `#viewbox`'s transform); a gesture that misses the map stops the run rather than
report numbers for less work. The profile is told it already saw this version, because the "what's new"
dialog opens six seconds in and would cover the map mid-gesture.

Page work (script, style, layout, paint recording) and painting (raster) are separate totals because they
fail differently: a slow zoom handler is page work, a costly SVG change is painting. Raster is most of a
gesture's time, more so on slower machines, so a sum would let page work double before it showed. Details
splits each into _while moving_ (the per-frame handler) and _after it stops_ (the settle redraw d3 fires
when the gesture ends), so a regression points at the code that runs it.

## Reading the report

The headline is the verdict: **✅ No slowdowns** or **🔴 Slower:** and what. Below it, one row per total
says _no change_, _N% faster_ or _N% slower_. **Details** lists the generation steps, layers and gesture phases that changed.

A total changes when the median of its per-round after/before ratios moves over 10% **and** every round
agrees; a part needs 25% and at least 10 ms, because the _after it stops_ phases swing by up to ±30% in a
single round. Over five runs with no app change, no total's median moved more than 5%.

How much it catches, measured locally with 3 rounds:

| Change                                   | Zoom: page work | Pan: page work | Pan: painting |
| ---------------------------------------- | --------------- | -------------- | ------------- |
| none (5 runs, worst median)              | +3%             | +2%            | +2%           |
| 5 ms of script per zoom frame            | +7%             | **+18%**       | 0%            |
| 10 ms of script per zoom frame           | **+22%**        | **+20%**       | −1%           |
| 30 ms of script per zoom frame           | **+62%**        | **+88%**       | +1%           |
| `drop-shadow` filter on the coastline    | +4%             | +9%            | **+12%**      |

So script cost from about 5 ms a frame, and a filter on one detailed layer, turn the report red; painting
cost shows most on pan, which keeps redrawing new tiles at 20×.

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
