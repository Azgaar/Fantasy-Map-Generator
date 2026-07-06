# PRD — Good Multipliers

## Background

The goods system has a single production modifier: a `cultureType` scalar on each good (e.g., `Nomadic × 2`). There is no way to suppress or boost a good's production based on a specific state, culture, religion, or biome. Military units have a boolean allow/disallow per dimension; goods need a more powerful numeric multiplier.

This PRD introduces a unified five-dimension multiplier system on `Good`, replaces the existing top-level `culture` field, and extends the Goods Editor with per-dimension popup configuration.

## Goals

- Any good can carry an optional multiplier for each of five dimensions: cultureType, culture id, state id, religion id, biome id.
- Absent or 1 = no effect. 0 = production fully suppressed. Any positive value scales production proportionally.
- All production contexts (rural cell, bonus resource, burg manufacture) apply the same multipliers consistently through a single helper function.
- The Goods Editor exposes per-dimension multiplier popups for every good.

## Non-goals

- Boolean allow/disallow (use multiplier = 0).
- Map-level default multipliers across all goods.
- Multipliers on market pricing or deal values (production-side only).
- Any backward-compatibility migration (the goods branch is not yet in production).

## Data model changes

### `Good` interface (`src/generators/goods-generator.ts`)

```typescript
export interface Good {
  i: number;

  // generation — raw goods
  chance?: number;
  distribution?: string;
  biomeOutput?: Partial<Record<number, number>>; // renamed from 'biome'

  // generation — manufactured goods
  recipes?: Record<number, number>[];

  // multipliers — all dimensions optional; absent or 1 = no effect; 0 = fully suppressed
  multipliers?: {
    cultureType?: Partial<Record<CultureType, number>>; // moved from top-level 'culture'
    culture?:     Partial<Record<number, number>>;      // by specific culture id
    state?:       Partial<Record<number, number>>;      // by specific state id
    religion?:    Partial<Record<number, number>>;      // by specific religion id
    biome?:       Partial<Record<number, number>>;      // scalar modifier per biome id
  };

  // effects
  demandCoverage?: Partial<Record<DemandCategory, number>>;

  // lore
  name: string;
  tags: string[];
  value: number;
  unit: string;

  // ui
  icon: string;
  color: string;
}
```

### `GOODS_DATA` (`src/generators/goods-generator.ts`)

- Every `biome: {...}` entry → `biomeOutput: {...}`.
- Every `culture: {...}` entry → `multipliers: { cultureType: {...} }`.
- Entity-specific multipliers (culture id, state id, religion id) are map-specific and are never present in `GOODS_DATA`.

Example diff:
```typescript
// before
{ name: "Wood", biome: { 5: 0.1, 6: 0.1 }, culture: { Hunting: 1.5 }, ... }
// after
{ name: "Wood", biomeOutput: { 5: 0.1, 6: 0.1 }, multipliers: { cultureType: { Hunting: 1.5 } }, ... }
```

### `GoodsModule.getBiomesProduction`

Update to read `good.biomeOutput` instead of `good.biome`.

## Production logic changes (`src/generators/production-generator.ts`)

### New helper: `getModifiers`

Add to `production-generator.ts` (module-level, not on the class):

```typescript
function getModifiers(good: Good, cellId: number): number {
  const m = good.multipliers;
  if (!m) return 1;

  const biomeId    = pack.cells.biome[cellId];
  const cultureId  = pack.cells.culture[cellId];
  const stateId    = pack.cells.state[cellId];
  const religionId = pack.cells.religion[cellId];

  const burgId      = pack.cells.burg[cellId];
  const cultureType = burgId
    ? pack.burgs[burgId].type
    : pack.cultures[cultureId]?.type ?? DEFAULT_CULTURE_TYPE;

  return (
    (m.cultureType?.[cultureType] ?? 1) *
    (m.culture?.[cultureId]       ?? 1) *
    (m.state?.[stateId]           ?? 1) *
    (m.religion?.[religionId]     ?? 1) *
    (m.biome?.[biomeId]           ?? 1)
  );
}
```

### `getCellProduction` (line ~677)

```typescript
// before
const cultureType = pack.cultures[pack.cells.culture[cellId]]?.type || DEFAULT_CULTURE_TYPE;
const modifier = (good: Good) => good.culture?.[cultureType] || 1;

// after
const modifier = (good: Good) => getModifiers(good, cellId);
```

The `cultureType` local variable can be removed if it is no longer used elsewhere in the function.

### `executeManufacture` (line ~133)

```typescript
// before
const cultureModifier = good.culture?.[state.burg.type || DEFAULT_CULTURE_TYPE] || 1;

// after
const cultureModifier = getModifiers(good, state.burg.cell);
```

The variable name `cultureModifier` is retained to minimise diff scope. The existing record annotation `if (cultureModifier !== 1) record.cultureModifier = cultureModifier;` remains valid — the value now represents the full combined multiplier.

### `makeProductionDecision` (lines ~439–487)

Two additional calls to `good.culture?.[burgType]` exist for cost/profitability estimation. Replace both with `getModifiers(good, state.burg.cell)` using the same pattern.

## Editor UI (`src/controllers/goods-editor.ts`)

### Edit good dialog — Multipliers section

Replace the existing "Culture modifier" label + inline grid with a **Multipliers** section containing five rows. Each row has:
1. A readable summary string showing currently configured non-default values.
2. A static edit (pencil) icon button that opens a popup for that dimension.

**Summary string format:**

| State | Displayed text |
|---|---|
| No non-default values | `(none)` |
| One or more set | Comma-separated `name ×value` pairs |

Names are resolved from map data:
- `cultureType` — the key itself (e.g., `Nomadic`, `Hunting`)
- `culture` — `pack.cultures[id]?.name`
- `state` — `pack.states[id]?.name`
- `religion` — `pack.religions[id]?.name`
- `biome` — `biomesData.name[id]`

Example rows:
```
CultureType:  Nomadic ×2, Hunting ×1.5          [✏️]
Culture:      (none)                              [✏️]
State:        Republic of Arabira ×0.5           [✏️]
Religion:     (none)                              [✏️]
Biome:        hot desert ×0.2, savanna ×1.4      [✏️]
```

Numbers are rounded to 2 decimal places for display.

### Per-dimension popup

Opened by clicking the edit icon for a dimension. Follows the same modal pattern as the "Limit unit" popup in the military units editor.

**Content:**
- Title: e.g., `State multipliers for Wood`
- A scrollable list of all map entities for that dimension (all states, all cultures, etc.)
- Each entity: colored dot (using its map color) + name + number input pre-filled with `1`
- Existing non-default values are pre-loaded from `good.multipliers.<dimension>[id]`
- For `cultureType`: list is the fixed `CULTURE_TYPES` array (no color dot needed)
- For `biome`: list is `biomesData.i` with `biomesData.name[id]` as label

**Buttons:** Apply / Cancel (identical pattern to military units popup).

**On Apply:**
- Collect all number inputs
- Store only values where `v !== 1` and `Number.isFinite(v) && v >= 0`
- Write result to `good.multipliers.<dimension>` (or delete the key if result is empty)
- Refresh the summary string in the edit dialog

**Save behavior (edit good dialog Apply):**
- Multipliers are read from the in-memory `multipliers` object being built up by the popups
- Only non-1 values are persisted; if `multipliers` would be empty, the key is omitted entirely

### Reading multiplier summary in `renderCulture` / edit dialog

The existing `renderCulture` function and its grid are removed. Replace with a `renderMultipliers` helper that returns the five-row HTML described above.

## Files affected

### Modified

- `src/generators/goods-generator.ts`
  - Update `Good` interface: rename `biome` → `biomeOutput`, move `culture` → `multipliers.cultureType`, add remaining multiplier dimensions
  - Update all `GOODS_DATA` entries: rename fields as above
  - Update `getBiomesProduction` to read `good.biomeOutput`
  - Update `GoodData` type alias accordingly

- `src/generators/production-generator.ts`
  - Add `getModifiers(good, cellId)` helper
  - Update `getCellProduction`: replace per-good modifier with `getModifiers`
  - Update `executeManufacture`: replace `cultureModifier` lookup with `getModifiers`
  - Update both `makeProductionDecision` cost/profitability paths (lines ~439 and ~484)
  - Remove now-unused `DEFAULT_CULTURE_TYPE` import if applicable

- `src/controllers/goods-editor.ts`
  - Replace inline culture modifier grid with five-row multipliers section + per-dimension popups
  - Add `renderMultiplierSummary(dim, values, nameResolver)` helper
  - Add `openMultiplierPopup(good, dim, nameResolver, onApply)` helper
  - Update `editGoodDialog` read/write paths for `multipliers` (previously read/wrote `good.culture`)

### Docs

- `docs/domain/glossary.md` — already updated: Good Multiplier, Biome Output terms added
- `docs/domain/goods_schema.md` — Multipliers section documents the implemented design (no separate ADR was created)

## Acceptance criteria

1. All goods in `GOODS_DATA` have `biomeOutput` instead of `biome`, and `multipliers.cultureType` instead of top-level `culture`. No good has a top-level `culture` or `biome` key.
2. `getModifiers(good, cellId)` returns `1` for any good with no `multipliers` object.
3. Setting `multipliers.state[5] = 0` for a good reduces production to 0 for all cells and burgs in state 5, and leaves all other states unaffected.
4. Setting `multipliers.cultureType.Nomadic = 2` produces twice the output in nomadic cells, identical to the behaviour of the previous top-level `culture.Nomadic = 2`.
5. All five multiplier dimensions stack multiplicatively: a cell matching biome × 2 and state × 0.5 yields net × 1 production.
6. The edit good dialog shows five multiplier rows. Each row displays a readable name-based summary of non-default values (or `(none)`) and an edit icon.
7. Clicking the edit icon opens a popup listing all map entities for that dimension with number inputs. Apply persists only non-1 finite non-negative values. Cancel discards changes.
8. A good with no non-default multipliers has no `multipliers` key in the serialized `.map` JSON.
9. `BONUS_RESOURCE_PRODUCTION` in bonus-resource cells is scaled by `getModifiers`, including the biome dimension.
