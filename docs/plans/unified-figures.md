# Plan — Unified Figures: One Roster, Many Views

Updated: 2026-10-29. Status: **planned**. Decisions taken in brainstorming:

1. **One roster** — `pack.history.figures` is the single registry of people, serving both the
   OpenConquest campaign and the Living World diorama.
2. **Figures carry positions and progression** — a new **Figures** map layer draws them; XP,
   levels and pool ratings live on the figure and are visible in the diorama.
3. **Roster roll-in** — the default roster's specialist units (Watchmen, Merchant Factors,
   Learned Sages, Zealot Prophets, Royal Magistrates) gain named commanding figures.

Companions: [living-world.md](living-world.md), [history-generation.md](history-generation.md),
[culture-traits.md](culture-traits.md), [openconquest-domain-assets.md](openconquest-domain-assets.md).

## Problem Statement

Two agent systems evolved in parallel and never meet:

| | Conquest Characters | Living World agents |
|---|---|---|
| Storage | `campaign.characters` (per-campaign, string ids) | `pack.history.figures` (per-map) |
| Kinds | `lord \| assassin \| diplomat \| bodyguard` | roles `ruler \| general \| prophet \| rebel \| adventurer` |
| Traits | 9 branch traits (`Brave`, `Pathfinder`, …) | alignment + 50+50 virtues/vices |
| Stats | XP → levels → `{combat, campaign, economy}` | none |
| Resolution | % chance vs cunning | `1d20 + valueModifier(pool) + traits` vs DC |
| Death | `alive = false` | `death = year`, chronicle event |

The only bridge today is `UnitType.troubleRole`: `resolveTrouble()` scans regiments for an
*anonymous* matching unit. No named person is ever dispatched except the adventurer delve.

## Solution Overview

**Units are bodies, figures are souls.**

- A figure is the named person: identity, culture, birth/death, dated roles, alignment,
  virtues/vices — **plus** (new) position, XP, pool ratings, renown, grudges.
- A unit stays the musterable military body (blocks, attack/defense, capacity cost). Mustering a
  specialist unit now also commissions its **commander figure**.
- Agents are musterable too: two new specialist unit types — **Guild Assassins** and **Court
  Envoys** — join the default roster, so a state fields its blades through the same muster
  pipeline as its sages.
- The M/W/S/C capacity pools become the universal character stat block, mirroring
  `UNIT_ROLE_POOLS` (guardsmen/military→`m`, merchant/sage→`w`, prophet/magistrate→`s`) with `c`
  covering intrigue and delving (conquest cunning already rolls on free C; delves roll on `max(W, C)`).
- One resolution shape everywhere:
  `1d20 + figure pool rating + valueModifier(state pool gen) + (virtues − vices) vs DC`.
- The conquest `Character` shrinks to a **campaign overlay**: `{figureId, cooldownUntil}` — a view,
  not a second person.

## Data Model

### `src/types/history.ts` — additive

```ts
export type HistoricalRoleType =
  | "ruler" | "general" | "prophet" | "rebel" | "adventurer"
  | "specialist"   // trouble-solving retainer; specialty below
  | "agent";       // conquest operative; specialty below

export interface HistoricalRole {
  type: HistoricalRoleType;
  target: HistRef;
  from: number;
  to?: number;
  /** specialists: TroubleUnitRole ("guardsmen"|"military"|"merchant"|"sage"|"prophet"|"magistrate");
   *  agents: "assassin"|"diplomat" */
  specialty?: string;
}

export interface FigureSkills { m: number; w: number; s: number; c: number }

export interface FigureGrudge {
  against: number;   // figure id
  reason: "assassinated" | "displaced" | "slew_companion" | "exiled" | "repulsed";
  year: number;
  weight: number;    // decays annually; cleared when avenged
  summary: string;
}

export interface HistoricalFigure {
  // …existing fields unchanged…
  cell?: number;              // position; the Figures layer draws it
  xp?: number;                // lifetime deeds; level is derived (see Progression)
  skills?: FigureSkills;      // 0..5 per pool; one point per level, spent by specialty order
  renown?: number;            // 0..100 fame (slice 7)
  captor?: number;            // state id holding the figure prisoner; absent = free (slice 6)
  grudges?: FigureGrudge[];   // (slice 8)
}
```

New chronicle event type: `"deed"` — figure actions that are not wars (the delve today misfiles
under `conquest`). Additive to `HistoryEventType`.

### `src/model/political/military-generator.ts` — Regiment

```ts
crew?: number[];   // attached figure ids; crew[0] = commanding general; rest = specialist commanders
```

Absorbs the `Regiment.leaderId` intent from living-world.md Pillar 1.

### `src/conquest/engine/game/state.ts` — Character becomes an overlay

```ts
interface Character {
  id: string;             // stable campaign-local key (log continuity)
  figureId: number;       // single identity -> pack.history.figures
  factionId: number;
  kind: "lord" | "assassin" | "diplomat" | "bodyguard";  // cached, derived from figure role
  armyId?: string;
  cooldownUntil?: number;
}
// name, cell, xp, level, skills, traits, alive move to the figure (alive = death === undefined)
```

Lazy migration: on campaign load, characters lacking `figureId` are minted into
`pack.history.figures` (name preserved; alignment/virtues/vices from `traitsRng("figure", i)`).
Legacy conquest TRAITS map onto virtue/vice words where present (`brave`, `just`…), else roll.

### `src/types/living.ts` — StatePolitySim

```ts
court?: number[];   // retained specialist/agent figure ids; each adds +1 load on its primary pool
```

Generalizes the adventurer contract's `+1 W` (`living-generator.ts` capacity ledger).

## The Roster Roll-In

From `src/conquest/content/docs/rosters/default.json`, plus two new agent units:

| Unit | Specialty | Primary pool | Commander title |
|---|---|---|---|
| Watchmen (`guardsmen`) | guardsmen | m | Captain of the Watch |
| Merchant Factors (`merchant_company`) | merchant | w | Master Factor |
| Learned Sages (`sage_coven`) | sage | w | Loremaster |
| Zealot Prophets (`prophet_band`) | prophet | s | High Prophet |
| Royal Magistrates (`magistrates`) | magistrate | s | Chief Magistrate |
| **Guild Assassins** (`assassins`) — new | assassin | c | Master of Whispers |
| **Court Envoys** (`envoys`) — new | diplomat | c | Chief Envoy |
| (any combat unit) | military | m | — (anonymous; the regiment's general covers it) |

The two agent units are added to `default.json` with C-weighted capacity costs (assassins `c: 2`,
envoys `c: 1, w: 1`) and weak combat stats — they fight as bodies poorly, which is the point.

Mustering any specialist unit (Living `muster` agenda or conquest recruit) spawns its commander
figure at the mustering burg: named from the state's culture namebase, traits rolled from
`traitsRng(living.seed, "figure", id)`, role `{type: "specialist" | "agent", specialty, target:
{kind: "state", id}}`. The unit remains musterable, fights as a weak body in battles, and carries
its `capacityCost`; the figure is who the state *dispatches*. Re-mustering an existing specialist
unit type while its commander lives re-attaches that figure (no duplicates).

## Progression

- `figureLevel(xp)`: threshold per level `40 + 20 × level` (conquest's `xpPerLevel` shape).
- Each level grants 1 skill point, **spent deterministically** by specialty order (sage: `w, w, c,
  s, m`; watchcaptain: `m, s, m, c, w`; …) — no stored choices, no save bloat, AI-free.
- XP sources: trouble resolution (10/25), mission outcomes (30/50/10), battles won with the
  regiment (20), agent actions (conquest values carried over).
- Virtues/vices stay as rolled at birth; **renown** (slice 7) is the earned reputation axis.

## Unified Resolution

```ts
figureCheck(rng, figure, pool, statePoolGen, dc): boolean
// total = 1d20 + (figure.skills?.[pool] ?? 0) + valueModifier(statePoolGen)
//         + ((figure.virtues?.length ?? 0) - (figure.vices?.length ?? 0))
```

- `resolveTrouble` (slice 2): pool = `troubleDef.pool`; figure = the attached commander whose
  `specialty === troubleDef.requiredRole`; anonymous-unit fallback preserved for legacy maps.
- Missions (slice 5): same roll, mission-defined pool and DC.
- Conquest agent actions (slice 1 wiring, slice 5 parity): `assassinate`/`sabotage` become C
  checks vs the defender's effective cunning — same odds shape as today, one code path.
- **Survival save** (slice 6): when a figure's regiment is wiped in battle, the commander rolls
  `1d20 + skills.c + (virtues − vices)` vs **DC 12**. Success: the figure slips away to the
  nearest friendly burg. Failure: **captured** by a good/lawful victor or **slain** by an
  evil/chaotic one — the victor's dominant culture alignment decides; a neutral victor rolls
  50/50. Capture sets `figure.captor`; a captive cannot act, may be ransomed (W to the captor),
  released by diplomacy or god-mode, and escapes on a natural 20 checked each season.

---

## Slices

### Slice 1 — The Roster Spine

Unified figure fields; campaign overlay link; roster roll-in on muster; lazy campaign migration.
`recruitCharacter` mints figures; `grantXp`/`spendSkillPoint` operate on the figure (deterministic
spend); conquest UI (log, battle-screen lord panels) reads through the overlay.
**Acceptance**: campaign recruits and Living figures are the same objects; Legends browser lists
conquest agents; old campaigns and maps load unchanged; same seed → same figures.

### Slice 2 — Named Dispatch ✅

`resolveTrouble()` dispatches the specialist commander instead of an anonymous unit. Success: XP,
event and news name the figure (`"Loremaster Etien quelled the Ancient Curse in Ems"`). Failure:
unit disruption as today, fumble (roll ≤ DC − 6) risks a vice gained or the figure's death.
**Acceptance**: every trouble resolution names a figure when the state fields a matching
specialist; specialists gain XP; fumbles produce chronicle events.

*Shipped 2026-10-29: the roll is now `1d20 + commander pool skill + domain + (virtues − vices) −
disruption` vs DC; a cleared trouble writes a `deed` chronicle event naming the figure (new
`HistoryEventType`), +25 xp (clear) / +10 (partial); a fumble draws a vice via `drawVice()` or
slays the commander (role spans closed, crew freed for a replacement on the next sync). Legacy
maps without a matching specialist resolve anonymously, unchanged.*

### Slice 3 — The Cast Layer

`src/renderers/draw-figures.ts`, `#figures` group, Layers tab entry **Figures** (+`figures` style
element). Anchors at `figure.cell`: ruler at capital, general & specialists at regiment cells
(following movement), adventurers at last mission target, agents at court. Role/specialty icons
from the Icon Library; click → living inspector card and Legends figure page. Idempotent redraw
per tick/regiment move.
**Acceptance**: layer toggles; anchors track movement; same state → same DOM; inspector shows
alignment, traits, XP bar, level, pool ratings, role spans. The layer is **auto-on**: the Living
HUD and the conquest battle screen enable it when opened; the user may toggle it off like any
layer.

### Slice 4 — Court & Retainers

States retain a court: ruler + hired specialists/agents, recorded in `StatePolitySim.court`, each
retainer loading `+1` on its primary pool (capacity as the cost of interesting people, matching
the AER doctrine). AI hires against its worst deficit pool; god-mode *Hire Retainer*; dismissed or
dead retainers close their role span.
**Acceptance**: hiring consumes free capacity; court visible in the state inspector; dead
retainers free their load.

### Slice 5 — Missions

Generalize `sendAdventurersToLair` into `dispatchOnMission(stateId, provinceId, missionId)` with a
mission table in `src/data/living-missions.ts`: `delve` (adventurer, `max(W,C)` — today's delve
unchanged in odds), `envoy` (magistrate/prophet, S — accelerates unrest decay), `plague` (sage, W
— reduces `recurrent_sickness` trouble level), `curse` (sage/adventurer, C — `ancient_curse`,
`leyline_blight`). Missions add `"commission"` news items and `deed` events; cooldowns per figure
(the conquest `cooldownUntil` pattern).
**Acceptance**: ≥3 mission types ship; all use `figureCheck`; the old delve is a table row.

### Slice 6 — Careers & Captivity

Role transitions, each closing one role span and opening another with a chronicle event:
adventurer (≥2 delve successes, renown ≥ 30) → `general`; succession picks the highest-S court
figure as regent (ties broken by level); specialist fumble-exile → `rebel` in a kin-culture
neighbor; victorious rebel → `ruler` (`coronation`). `HistoricalRole[]` is already dated spans —
this slice makes transitions happen.

Captivity: the survival save above fires whenever a figure's regiment is wiped (Living battles
and conquest battles alike). Captives sit in the captor's capital (`captor` set, role spans
paused), feed slice 8 grudges on release, and can be ransomed: the captor's state gains W, the
paying state a `repulsed`-weight grudge against the captor unless relations are warm. A slain
figure writes a `death` year, a chronicle event, and — for adventurers — the slice 7 ruins echo.
**Acceptance**: each career path fires once per eligible figure per save; Legends shows
multi-role lifelines; a wiped regiment's commander survives, is captured, or dies per the save
and the victor's alignment; ransom frees the captive.

### Slice 7 — Guilds & Renown

Free Burgs (pop ≥ threshold) host an **adventurer guild**: mints and retainer-hires adventurer
figures, whose contracts cost `f(renown)`. Alignment gate: an alignment ≥2 steps from the hiring
ruler's culture refuses (alignment finally does mechanical work). Renown: +10 per deed, +25 per
lair purge, decay on failure. A slain adventurer's band leaves a `ruins` marker with a note (map
echo). Rival states may outbid when a contract lapses. The renown economy — hire cost curve, outbid
rules, decay rates — is tuned during this slice's implementation, not pre-defined.
**Acceptance**: guild hires respect renown and alignment; famous adventurers visibly change
employers; delve deaths leave markers.

### Slice 8 — Blood Feuds

`FigureGrudge` on figures, mirroring state `GrudgeRecord`: sources — `assassinated` (target's
court), `displaced` (passed-over succession heir), `slew_companion` (delve/mission death),
`exiled` (slice 6 fumbles). Weights decay annually; a court figure with an active grudge biases
its state's agenda scoring toward the grudge target's state, and casus belli naming extends to
figures (*"The Vengeance for Loremaster Etien"*).
**Acceptance**: grudges are created, decay, and demonstrably steer one war's target and name.

---

## UI Summary

- **Figures layer** (slice 3): anchors, icons, click-through. Auto-on with the Living HUD and
  the conquest battle screen.
- **Living inspector**: figure card — name, age, alignment badge, virtues/vices, XP bar, level,
  pool ratings, cooldown, role history, court status, active grudges.
- **Conquest**: log, agent panels and battle screens read the same figure through the overlay —
  one person, consistent name and traits in both games.
- **Legends browser**: Figures tab gains the new roles, specialties and lifeline spans for free
  (it already renders `HistoricalFigure`).

## Testing & Invariants

- **Overlay consistency**: every campaign `figureId` resolves; dead figures are never dispatched;
  `crew[0]` is the regiment's general when set.
- **Muster idempotency**: re-mustering a specialist type attaches the living commander, never
  mints a duplicate.
- **Progression**: XP only increases; `figureLevel` derived from XP; skills total = starting
  package + level.
- **Determinism**: same pack + seed → identical figures, traits, and rolls (existing `traitsRng`
  stream guarantees; new rolls must use `Living.rng` streams).
- **Save round-trip**: figures/court/crew survive `.map` record 53 and conquest campaign
  serialization byte-for-byte; old records load with fields absent → defaults.
- **Layer idempotency**: same state → same DOM anchors.

## Build Order

| # | Slice | Size | Key Modules |
|---|---|---|---|
| 1 | Roster Spine | L | `src/types/history.ts`, `src/conquest/engine/game/{state,characters}.ts`, `src/model/physical/{living,history}-generator.ts`, `military-generator.ts`, `src/conquest/content/docs/rosters/default.json` |
| 2 | Named Dispatch | M | `living-generator.ts`, `src/data/living-troubles.ts` |
| 3 | Cast Layer | M | `src/renderers/draw-figures.ts`, `layers.ts`, `src/controllers/living-hud.ts` |
| 4 | Court & Retainers | M | `src/types/living.ts`, `living-generator.ts`, `living-hud.ts` |
| 5 | Missions | M | `src/data/living-missions.ts`, `living-generator.ts`, `characters.ts` |
| 6 | Careers & Captivity | M | `living-generator.ts`, `src/model/physical/history-generator.ts` |
| 7 | Guilds & Renown | L | `living-generator.ts`, `markers-generator.ts`, `src/data/living-lairs.ts` |
| 8 | Blood Feuds | M | `living-generator.ts`, `src/types/history.ts` |

Each slice is shippable; nothing user-visible breaks if work stops between slices.

## Glossary & Docs

When slices ship, update `docs/domain/glossary.md`: **Figure Roster** (`pack.history.figures` as
the single registry), **Specialist** (a figure with a `specialist` role and TroubleUnitRole
specialty), **Court** (retained figures on `StatePolitySim.court`), **Mission**, **Renown**,
**Figures Layer**, **Figure Grudge**. Extend `docs/wiki/Living-World.md` (cast, court, missions)
and the conquest docs (overlay migration).

## Resolved 2026-10-29

1. **Agents musterable** — yes. Guild Assassins (`assassins`) and Court Envoys (`envoys`) join
   the default roster as specialist units; both the Living `muster` agenda and the conquest
   `recruitCharacter` path field them.
2. **Figures layer** — auto-on. The Living HUD and the conquest battle screen enable it when
   opened; the user may toggle it off like any layer.
3. **Renown economy** — hire cost curve, outbid rules and decay are tuned during slice 7
   implementation, not pre-defined here.
4. **Regiment wipes** — the commander rolls a survival save (`1d20 + skills.c + traits` vs DC 12).
   Failure means **captured** by a good/lawful victor or **slain** by an evil/chaotic one; a
   neutral victor rolls 50/50. See Unified Resolution and Slice 6.
