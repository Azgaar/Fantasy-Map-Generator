# Optional cylindrical and spherical worlds

Investigation: 2026-09-29, source checkout `a1c616a3`. Research only; application behavior is unchanged.

## Conclusion

Generate the surface topology before terrain generation, and preserve it through repacking. This is feasible. Neighbor-based propagation can then cross the longitude seam naturally, with one height, culture, state, etc. per canonical cell.

However, changing the graph's neighbor lists alone cannot make the current application seamless. FMG embeds planar geometry and physical-border assumptions in several consumers. The achievable design is **surface-aware graph and geometry, surface-independent entity data**. It requires migrating geometric operations and fixing a few generator assumptions, rather than teaching every entity about wrapping.

Recommend an optional cylinder first, designed to admit a spherical backend. A true sphere is a separate topology/geometry backend, not a second wrapping checkbox. The algorithm evidence and primary references are in [spherical-graph-sources.md](spherical-graph-sources.md).

## What the modes mean

| Mode | Horizontal boundary | Vertical boundary | Use |
| --- | --- | --- | --- |
| Plane (existing/default) | Physical edge | Physical edge | Regional and existing maps |
| Cylinder | Periodic longitude | Two physical edges | Seamless east/west world band; first deliverable |
| Sphere | Periodic longitude in the flat view | Two distinct poles, no physical edge | Complete globe |

Ordinary wrapping in both directions produces a torus. On a sphere, crossing a pole continues back into the same hemisphere with longitude shifted by 180°; it does not teleport to the opposite pole. At each exact pole all longitudes represent one location. These follow from spherical coordinates; see the [source note](spherical-graph-sources.md#findings).

The flat map must still have a display cut. A state spanning that cut remains one state even when rendered as two pieces. The globe can be continuous if these pieces meet correctly in its texture or are rendered directly from spherical geometry.

## Current implementation and consequences

| Area | Evidence in this checkout | Implication |
| --- | --- | --- |
| Initial graph | [Grid.generate / rebuildGraph](../../src/generators/grid-generator.ts) call [calculateVoronoi](../../src/generators/voronoi.ts), with outside pseudo-sites on all four sides | Natural place for a surface backend; remove only the boundaries that really disappear |
| Dual topology | `cells.c/v`, `vertices.c/v` come from the same triangulation; `connectVertices` assumes three incident cells per Voronoi vertex | Preserve consistent cyclic incidence. Patching neighbors without the dual mesh breaks coastline/border traversal |
| Repacking | [Pack.generate](../../src/generators/pack-generator.ts) discards deep ocean sites, inserts coastal midpoints, and triangulates again | Apply the surface to both graphs. A wrapped grid followed by planar repacking loses wrapping |
| Feature types | [Features.markupGrid / markupPack](../../src/generators/features-generator.ts) use `land ? island : border ? ocean : lake` | With no border, every water component becomes a lake. Even a cylinder can have an ocean that reaches neither remaining edge |
| Terrain | [HeightmapGenerator](../../src/generators/heightmap-generator.ts) mixes neighbor propagation with raw coordinate distances, edge masks, and rectangular image templates | Hills/smoothing can benefit immediately; range direction, masking, and source images need attention for natural world terrain |
| Rainfall | [Precipitation.compute](../../src/generators/precipitation-generator.ts) starts winds at map sides and walks array indices by `±1` / `±cellsX` | It never consults graph adjacency. Connecting the graph cannot remove rainfall's artificial start/end boundary |
| Rivers | [Rivers](../../src/generators/river-generator.ts) follows neighbors but also lets rivers exit border cells and excludes those cells in depression resolution | A longitude cut must not be an outlet. Closed surfaces need real water/sink handling, including all-land cases |
| Political/cultural spread | [States.expand](../../src/generators/states-generator.ts), [Cultures.expand](../../src/generators/cultures-generator.ts), [Religions](../../src/generators/religions-generator.ts) traverse cell neighbors | These propagation loops largely carry over; planar seed-spacing quadtrees elsewhere in these modules still need migration |
| Routes | [Routes](../../src/generators/routes-generator.ts) uses planar Delaunay for candidate burg connections and squared planar distance for path costs | Fix both candidate connections and costs, then route geometry; changing adjacency alone leaves seam routes absent or expensive |
| Areas, queries, borders | [Pack](../../src/generators/pack-generator.ts) uses polygon area and a quadtree; [pathUtils](../../src/utils/pathUtils.ts) emits raw vertex coordinates and uses planar label placement | Need local coordinates/metrics, seam-aware queries, projected polygons and sensible label anchors |
| Globe display | [updateGlobeTexure / addGlobe3dMesh](../../src/renderers/view-3d-renderer.ts) wraps a rasterized exported map around `SphereGeometry` | The globe currently displays the planar world; constructing a sphere mesh for display does not connect its map data |
| Persistence | [Save](../../src/services/io/save.ts) saves grid sites/boundary and cell arrays; [Load](../../src/services/io/load.ts) rebuilds grid and pack | Surface and reconstruction algorithm must survive saving; stable cell/vertex ordering matters for saved arrays and graph overrides |

Two concrete examples illustrate why geometry must change:

- On a width-1000 cylinder, sites at x=2 and x=998 are four units apart. Their coastal midpoint is x=0, not x=500. Current repacking averages their raw coordinates.
- One canonical vertex near the longitude cut may need x≈0 in one cell's local polygon and x≈1000 in another. A single flat `vertices.p[id]` cannot serve both without image offsets or derived display copies.

## Proposed ownership boundary

Keep one canonical cell ID and the existing per-cell arrays. Ghost copies used for construction or drawing must never receive independent population, height, feature, or political state.

The graph/geometry owner should provide:

- Construction of both grid and pack, consistent cell/vertex incidence, and true physical-boundary flags.
- Distance and interpolation, including coastal midpoints and route segments.
- Cell area in documented units, point lookup and radius queries.
- Local cell rings and projected line/polygon fragments, including winding, holes, and pole-containing regions.

Consumers request these operations without branching on `plane`, `cylinder`, or `sphere`. Rendering fragments reference their canonical owner. Sphere geometry can use unit 3D vectors internally while presenting projected coordinates to the flat UI; keep derived projection data disposable. Avoid an application-wide replacement of generic Euclidean utilities: UI geometry still needs Euclidean distances.

This fits the existing [state/generator/renderer separation](../architecture/architecture.md). It also reveals a real limit to the original premise: ocean classification and atmospheric boundary conditions are domain decisions that cannot be solved by graph manipulation alone.

### Required domain decisions

**Ocean versus lake.** Adopt an explicit closed-world rule. A simple starting policy is the largest water component as the primary ocean, with a configurable area criterion for additional disconnected oceans. This is a proposal, not a geometric truth: topology cannot distinguish an ocean from a lake on a sphere. Classify on the complete grid and carry the decision into pack via source-cell relationships. Keep `border` truthful rather than marking fake borders to preserve old classification.

**Rainfall.** A cylinder can preserve row indexing while changing zonal winds to periodic transport. Bound the iteration and establish humidity from ocean evaporation/convergence rather than resetting at the chosen display cut. A spherical sample may require neighbor/direction-based transport; it must not assume globally parallel north/south directions. This need not become a full physical climate simulation, but it is distinct work.

**Point distribution and packing.** Mapping existing latitude/longitude sites onto a sphere can retain source IDs and rectangular climate sampling initially, but over-samples the poles. Approximately equal-area sites are a better long-term spherical sample and require replacing row-index lookup assumptions. Packed maps need sufficient ocean support sites: deleting almost all oceans can leave highly uneven or hemisphere-confined samples and enormous cells. Validate or revise that optimization for the spherical backend.

## Construction approaches

### Cylinder

Use existing Delaunator on sites copied at x−width, x, x+width, with periodic north/south guard sites and no east/west guards. Extract cells around the central sites, canonicalize image IDs and dual vertices, and retain per-incidence image offsets. Derive all four incidence arrays from this mesh. Start with full copies; optimize to a ghost strip only when a geometric bound or validation guarantees sufficient coverage, especially after ocean thinning.

Use locally unwrapped coordinates for lengths, midpoints and polygon areas. Drawing must split/clip the resulting geometry into the viewport, retaining interior rings and regions that wind around the cylinder. A seam crossing is not a coastline or state boundary.

### Sphere

Build sites on the unit sphere, obtain their spherical Delaunay mesh from a 3D convex hull, then construct its Voronoi dual. For a well-distributed sample enclosing the origin, outward unit face normals give dual vertex positions. Order rings using halfedge incidence and preserve the three-cell vertex convention for nondegenerate triangles. This is the method documented by [SciPy](https://docs.scipy.org/doc/scipy/reference/generated/scipy.spatial.SphericalVoronoi.html).

The existing `three` package contains [ConvexHull](https://threejs.org/docs/pages/ConvexHull.html), so an isolated prototype requires no new dependency. Its floating-point robustness, degenerate cases, memory use and bundle impact still need validation. The current Voronoi walker stops after 20 incidences; do not carry that arbitrary cap into a spherical implementation, especially for uneven samples.

Capping a cylinder with special polar cells can produce spherical topology, but does not by itself provide spherical distances, natural sampling, or projection geometry. It is a possible intermediate experiment, not an equivalent spherical Voronoi algorithm. Collapsing an entire ring into one high-valence Voronoi vertex would also violate current traversal assumptions.

## Generation and compatibility

Resolve an explicit optional surface request before `Grid.prepare`. Save the resulting surface with map graph configuration, with absent values meaning the existing plane behavior. Keep it immutable for an existing world except through deliberate regeneration/conversion.

Today [Coordinates.generate](../../src/generators/coordinates.ts) chooses coverage after height generation and feature marking. Therefore automatic surface selection based on that late result is circular. A sphere request must establish full latitude/longitude coverage up front; a geographic cylinder needs 360° longitude. Validate the actual extent, not just the map-size percentage: longitude span currently also depends on aspect ratio. The globe renderer's `latT > 179` check alone does not establish full longitude coverage.

All graph rebuild paths must honor the stored surface: initial generation, explicit gallery grids, file loading, heightmap editing and resampling. Regional submaps generally become planar. Persist whatever canonical construction inputs and algorithm version are necessary to reproduce IDs; deterministic generation from a seed alone is insufficient protection if triangulation/order changes between versions. Preserve old planar construction unchanged.

## Feasibility probes performed

Transient Node.js probes used installed dependencies; no application code was modified:

| Probe | Result |
| --- | --- |
| Seeded 24×12 jittered sample, 240×120 domain, three horizontal copies plus top/bottom guards, canonical central-site Delaunay adjacency | 288 cells, 23 seam edges, zero asymmetric neighbor pairs, traversal reaches opposite-side cells |
| Three.js convex hull of 1,000 Fibonacci sphere sites | 1,996 triangular faces, 2,994 edges, Euler characteristic 2, no missing twin halfedges |
| Same with 10,000 sites | 19,996 faces, 29,994 edges, Euler characteristic 2, no missing twin halfedges |

The two hull constructions took approximately 9 ms and 59 ms in one local run. These are feasibility observations, not browser performance guarantees. The probes did not build complete FMG duals, test spherical areas, exercise repacking or render a world. No claim of end-to-end correctness follows from them.

## Suggested implementation slices and acceptance checks

1. **Graph/geometry proof:** cylinder grid and pack; canonical reciprocal incidence; consistent rings; locally correct midpoint, distance and area; point/radius queries across the seam. Compare small samples with independent/reference constructions.
2. **Visible vertical slice:** an island and one state crossing the seam, one river and one route crossing it, rendered on the flat map and existing textured globe. Include polygon fills, strokes, labels, editor selection, and save/reload. This demonstrates whether the abstraction actually contains the complexity.
3. **Generation integration:** explicit surface configuration, ocean classification, terrain metrics/masks, periodic rainfall, all rebuild paths. Validate plane compatibility and natural continuity under several templates.
4. **Sphere:** spherical graph and sampling, retained ocean coverage, pole queries, geodesic metrics and area, projected geometry, climate integration. Reuse the canonical-entity and geometry boundary established by the cylinder work.

Before calling sphere support complete, verify Euler characteristic 2, total cell area near `4πR²`, consistent pole geometry, no artificial river outlet, and deterministic reconstruction. Include all-water/all-land worlds, a polar continent, multiple water components, a region covering most of the world, seam-crossing holes, sparse packed oceans, and a 100k-site memory/performance run. Move the display longitude cut on a fixed world and verify that entity ownership, physical areas and route costs do not change.

The likely integration cost is in geometry consumers and boundary-dependent generation, not obtaining a closed triangulation. A cylinder is a useful first milestone; a claim that all current features become seamless solely through graph creation would be misleading.
