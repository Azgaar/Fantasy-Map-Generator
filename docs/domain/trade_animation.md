# Trade Animation

Trade animation turns the market system's abstract deal log into a spatial story on the map. It makes trade legible by showing batched deal flows as moving markers along plausible routes between trade endpoints.

The feature is not a simulation layer. It reads existing deals and does not change prices, stock, burg treasury, or market state.

## Domain Model

- **Inputs**: `pack.deals`, `pack.burgs`, `pack.cells`, `pack.markets`, `pack.goods`.
- **Output**: temporary animated paths and moving dots for deal batches.
- **Batch semantics**: all deals with the same ordered start and end burgs are animated as one trade flow.
- **Path semantics**: trade-aware pathfinding over the cell graph.
- **Interaction**: clicking a dot opens a standard trade details dialog.

## Animation Flow

1. Keep the animation loop active only while the Trade layer is enabled.
2. Group deals by ordered trade endpoints.
3. Pick a trade batch from the available batches.
4. Resolve the start and end burgs from the deal direction.
5. Find a path across the map with trade-specific travel costs.
6. Build a curved path through the visited cells.
7. Animate the dot along the path.
8. Remove the visual when the motion finishes or when animations are cleared.

## Direction Rules

- `in` deals move from the counterparty burg or market center into the deal's market center.
- `out` deals move from the deal's market center out to the counterparty burg or market center.
- Batching uses this resolved movement direction, so opposite flows remain separate.

## Path Rules

- Land-to-water transitions are allowed only through a port.
- Existing roads, trails, and sea routes are strongly preferred.
- Land cost is affected by biome habitability, elevation, and whether the destination is a burg.
- Water cost is blocked by frozen seas.
- The route should stay consistent with the trade system's notion of connectivity, not just with straight-line distance.

## Visual Language

- The visible dot is small and color-coded by the highest-value good in the batch.
- The path is faint and dashed so it reads as context, not as a dominant overlay.
- The path fades in before motion and fades out after arrival.
- The click target is larger than the visible dot so the feature is easy to use.

## Trade Details

Clicking an animated batch opens the Trade Details dialog. It shows:

- Start and end burgs.
- Number of deals in the batch.
- Good name and icon for every deal.
- Deal direction, market center, and counterparty.
- Units, unit price, and total value.
- Buttons to zoom to the start or end of the animated route.

## Style Controls

Trade Animation is a separate map layer with style controls for:

- Animation speed.
- Maximum spawned batches per interval.
- Spawn interval.
- Dot size.
- Dot opacity.
- Path opacity.

## Performance and Cleanup

- Only a limited number of batches are spawned per interval.
- The spawn interval keeps the map readable on busy trade networks.
- Animations are removed after completion.
- Turning the Trade layer off stops the loop and clears all active animation SVG.
- Transient animation elements are removed before map save so `.map` files do not store stale dots or paths.

## Architectural Intent

- The trade module chooses batches and computes routes, but does not touch DOM state.
- The renderer owns SVG path and dot drawing.
- The Trade Details controller owns dialog UI and click behavior.
- The feature reads from world state only; it does not mutate trade data.
- The animation layer is disposable, restartable, and safe to clear at any time.

## Implementation Notes

- Batch selection and pathfinding live in `src/modules/trade-animation.ts`.
- SVG drawing lives in `src/renderers/draw-trade-animation.ts`.
- The standard details dialog lives in `src/controllers/trade-details.ts`.
- Layer and style controls are wired through the legacy UI modules.
