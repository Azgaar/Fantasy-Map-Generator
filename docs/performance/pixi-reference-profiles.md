# Pixi renderer reference profiles

Renderer benchmark reports use a fixed 1280×720 CSS-pixel viewport and the deterministic fixtures declared in
`tests/benchmarks/fixtures.ts`. Each generated fixture fixes the seed and requested cell count. The legacy fixture is
the checked-in `tests/fixtures/1.139.4.map` compatibility map.

## Reference desktop

- Chromium stable, hardware acceleration enabled
- 1280×720 viewport
- device scale factor 1 unless a DPR-specific run is being recorded
- at least 8 logical CPU cores and 8 GB reported device memory
- no CPU throttling

## Constrained profile

- Chromium stable with 4× CPU throttling
- 1280×720 viewport
- device scale factor 2
- renderer memory policy overridden to the 2 GB device-memory class
- reduced motion enabled

Record the exact browser version, user agent, logical CPU count, reported device memory, DPR, selected Pixi backend,
canvas dimensions, and renderer resolution in every report. Reference results are only comparable when fixture,
viewport, browser major version, and profile match.

## Command and report

Run the full reference matrix with:

```sh
npm run benchmark:renderer
```

The command runs every fixture against SVG and Pixi twice, serially, and writes
`artifacts/renderer-benchmark-report.json`. Set `RENDERER_BENCHMARK_RUNS` to request more repetitions or
`RENDERER_BENCHMARK_OUTPUT` to choose another report path. The GPU phase measures CPU submission of pending Pixi
resource uploads; it does not claim hardware-completion time where the browser exposes no portable GPU timer.
