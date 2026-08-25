# Multiplayer and Collaboration Future Work

## Status

This is a future architecture note, not an implementation plan. It records a direction for
collaborative map editing and possible multiplayer game sessions without introducing a
networking dependency or changing the current single-user `.map` format.

## Recommendation

Use a **local-first, thin-coordination** model for map editing:

```text
local map copy + command history
              |
              v
      sync adapter / conflict policy
              |
      +-------+--------+
      v                v
direct peer link    small room service
when possible       auth, invites, signaling, relay fallback,
                    optional encrypted snapshot storage
```

The room service must not be the owner of normal map mutations. It should provide only
membership, rendezvous/signaling, relay fallback, and (optionally) durable storage of
encrypted snapshots. This makes collaboration useful when the service is unavailable or
the user is offline, while retaining a practical path through NATs and corporate networks.

Pure browser peer-to-peer networking is not a reliable product architecture: connections
still need rendezvous/signaling and often a relay fallback. Direct peer links are an
optimization, not a correctness dependency.

## Scope separation

Map collaboration and a live multiplayer game have different consistency requirements.

| Concern | Collaborative editor | Multiplayer game |
| --- | --- | --- |
| Primary operation | Concurrent authored map changes | Validated player commands |
| Offline behavior | Local edits merge after reconnect | Pause/disconnect or resync is normally required |
| Conflict handling | Per-operation merge rules and explicit conflicts | One authoritative simulation result |
| Authority | Shared document membership | Session host for co-op; server for competitive/public play |
| Timing | Immediate, eventually consistent | Deterministic fixed-step simulation |

Do not apply editor CRDT conflict resolution to game simulation. The game model described
in [Grand Strategy Game Feasibility and Roadmap](../prd/grand-strategy-game.md) remains
commands → deterministic simulation → events.

## Collaborative map model

### Snapshot plus semantic operations

A shared map session should use a versioned base snapshot plus a stream of semantic map
operations. The base snapshot remains a valid serialized map; it is not replaced by a
network-specific data format.

```text
map snapshot revision N
        +
ordered / mergeable semantic operations after N
        =
current shared map
```

Operations describe user intent, rather than patches to arbitrary JavaScript objects or
SVG markup. Examples include:

- `RenameState { stateId, name }`
- `MoveBurg { burgId, x, y, cellId }`
- `AssignCells { layer, cellIds, domainId }`
- `UpdateStyle { path, value }`
- `AddMarker`, `MoveMarker`, and `RemoveMarker`

Each operation needs a unique operation ID, actor ID, base revision or causal metadata,
and enough information to validate and apply it. Operations should go through the same
domain command/mutation path whether they are local, remote, imported, or replayed from
history. A successful operation produces explicit affected domains/cells/layers so that
renderers receive the normal invalidations.

The existing direction of editor mutations with affected-domain results is a useful seam
for this work. It must become a stable command boundary before networking is added.

### Do not synchronize raw topology as a CRDT

Do not place the complete `grid` or `pack` object, large typed arrays, renderer caches, or
SVG output in a generic collaborative document. A map can contain up to 100k cells, and
topology-changing operations have broad derived effects.

Keep the following outside normal concurrent merging:

- repacking and full generation;
- heightmap/coastline edits that reconstruct topology or dependent geometry;
- bulk regeneration of cultures, states, routes, rivers, or economy;
- migrations and imports that change the base snapshot.

These actions should use an explicit exclusive session phase: one actor proposes the
operation, collaborators approve or leave, the session applies it once, and all clients
receive a new snapshot revision. The same approach is appropriate for an intentionally
large bulk edit when a per-cell command stream would be inefficient.

### Conflict policy

Conflict behavior must be defined per operation type and shown to the user when it would
otherwise be surprising:

- Independent entity or style fields may merge independently.
- Concurrent text needs a text-aware merge type, or a clear last-writer-wins rule for
  short names and notes.
- Cell painting is represented as a compact batch operation. Conflicting cells resolve by
  a documented order, while the UI reports the cells that were overwritten or skipped.
- Delete versus edit requires tombstones and a predictable rule; deleted IDs must not be
  silently reused.
- Structural/topological actions use the exclusive phase above, not automatic merging.

Undo is actor-local: it submits a compensating operation against the current document,
rather than rewinding global shared history and erasing another collaborator's work.

### Presence is not map state

Cursors, active selection, current tool, viewport, typing indicator, and connection status
are transient presence messages. They should be rate-limited, lossy, and expire quickly.
They are never serialized into `.map` files or included in undo history.

## Transport and persistence

The collaboration model needs pluggable transports. A first production-quality transport
can be a room WebSocket; it is simple to implement, test, observe, and reconnect. A later
WebRTC data-channel transport can carry peer traffic directly when possible, while the
same service remains responsible for signaling and TURN/relay fallback.

Persist local snapshots and operations in IndexedDB. An optional remote store should retain
periodic compacted snapshots plus only the operations since the latest snapshot. The server
may store ciphertext if end-to-end encrypted map content is desired, but authorization,
invite revocation, metadata exposure, and recovery keys still need an explicit product
decision.

Candidate conflict/sync libraries include Automerge and Yjs. Either must sit behind an FMG
sync adapter and operate on semantic documents or operations, never on renderer state or
the full packed graph. No library should be added until an initial collaboration slice
defines its document boundaries, operation schemas, and tests.

## Iroh assessment

Iroh is promising for a future native/Rust host because it provides authenticated,
public-key-addressed QUIC connectivity, hole punching, and relay fallback. It is not the
primary transport for the current browser application: browsers do not directly speak the
custom Iroh QUIC/ALPN protocol, so an Iroh-aware relay/bridge is still required.

Reconsider Iroh if FMG gains a Tauri/native desktop host, a self-hosted local session host,
or a native companion service. For the browser product, prioritize standard WebSocket plus
WebRTC transport options first.

## Multiplayer game sessions

Private co-op games can use a host-authoritative deterministic session:

```text
clients submit commands -> session host validates and advances fixed ticks -> snapshots/events to clients
```

The host owns the serializable random state, tick order, validation, and periodic snapshots.
Host migration can be added later by electing a new host from a recent verified snapshot and
command log.

Competitive or public games require a real authoritative server. Strict peer-to-peer game
simulation cannot reliably prevent cheating, protect secrets, arbitrate a dropped host, or
provide stable public sessions. A networking transport does not replace simulation authority.

## Incremental roadmap

1. Finish a typed map command boundary for editors, including validation, affected-domain
   invalidation, serialization, and actor-local undo.
2. Add command-history and snapshot replay tests without networking.
3. Build a two-browser local collaboration proof using a room transport, cursors, and a
   small safe set of operations (for example labels, markers, burg positions, and style).
4. Add snapshot compaction, reconnection, invite-only rooms, and documented conflict UI.
5. Add WebRTC as a transport optimization with relay fallback; measure it before making it
   the default.
6. Only after the single-player game vertical slice is deterministic, add host-authoritative
   co-op using the same game command API.

## Acceptance criteria for a first editor slice

- Two browsers converge after concurrent safe edits and after one browser reconnects.
- Cursor/presence messages never affect saved map data.
- Remote operations use the same mutation/invalidation path as local operations.
- Save/load and operation replay produce the same map checksum.
- A failed direct connection falls back to the room transport without losing edits.
- Exclusive topology changes either complete as a new snapshot revision or leave all peers
  on the previous revision; no peer receives a partially regenerated map.
