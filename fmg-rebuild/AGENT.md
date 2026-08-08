# Agent Guidelines: Feature Parity & Modularity

This file outlines the constraints and instructions for AI agents modifying the rebuilt FMG project.

## Domain Reference Map

When replicating features, align variables and structures to the original domain definitions:
* **Grid:** The underlying Voronoi structure mapping coordinates.
* **Pack:** The aggregate world state (contains `burgs`, `states`, `cultures`, etc.).
* **Cell:** The smallest indivisible coordinate unit.
* **Burg:** A settlement. Grouped into `States`.

## Module Interaction Contracts

Modules are designed to be decoupled. They communicate exclusively through the centralized state store using actions/events.

```text
[Module A] ---> (Dispatches Action) ---> [Central State] ---> (Subscribes/Listens) ---> [Module B]
```

* **Rule:** Direct imports or method calls from one simulation module to another (e.g. `Economy` directly calling `Burgs.specify()`) are forbidden. Use actions to chain updates instead.
* **Rule:** UI components must never contain mathematical simulation algorithms. All logic belongs to the `/simulation` modules.
* **Rule:** If a simulation step is updated, verify that it maps to the exact canonical generation sequence outlined in FMG documentation.
