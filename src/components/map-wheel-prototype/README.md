# PROTOTYPE — Map Wheel

> **Question:** what should a global right-click "Map Wheel" look like, and how should it
> express context-sensitivity when several map entities sit under one click?

Four structurally different variants of the right-click menu, mounted on the **real map**
(sub-shape A — the existing page), switchable via the `?variant=` URL search param and a
floating bottom bar.

| Key | Name                 | Structure                                                                                                                    | The bet it makes                                                                         |
| --- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `A` | Radial ring          | One ring of action sectors around the cursor; hub shows the hovered label; "More…" swaps the ring in place                   | Context is _one_ thing; a flat ring of its actions is enough                             |
| `B` | Orbit (target-first) | Inner ring picks _which_ entity (burg / state / cell / river…), outer band shows that entity's actions; both visible at once | Disambiguation is the hard part, so make the stack of entities the first-class control   |
| `C` | Marking menu         | Invisible until dwell; 8 compass slots, flick-and-release; a trail line follows the cursor                                   | Speed and muscle memory beat discoverability for a tool used hundreds of times a session |
| `D` | Anchored card        | Not a wheel at all: a rectangular card with an entity breadcrumb, grouped list, and type-to-filter                           | The control — is a wheel actually better than a plain contextual list?                   |

## Run

```
npm run dev
```

Then right-click anywhere on the map. Switch variants with the bottom bar, the `←` / `→`
arrow keys, or `?variant=B` in the URL.

## Prototype constraints

- Read-only. Actions that would _open_ an existing editor really open it; anything that
  would mutate the map is stubbed with a toast. The question is what this looks like, not
  whether the mutations work.
- Context resolution (`context.ts`) is shared because it is _data_, not layout. Every
  variant is free to throw out the whole presentation.

## Capture

When a variant wins, fold it into real code and move this whole directory onto a
throwaway branch — do not leave the losing variants in `master`.
