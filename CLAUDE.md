Azgaar's Fantasy Map Generator is a web application for procedurally generating, editing, and visualizing fantasy maps. Before making architectural decisions, read the `CONTEXT.md` file in the root.

For deeper knowledge, consult the `docs/` directory, especially `docs/domain/glossary.md`, `docs/architecture/architecture.md` and `docs/architecture/data-model.md`.

Keep comments short and to the point. Don't repeat information that is in docs. Prefer one-liners or no comments.

Export only what another module imports today. Types, helpers and constants used within one module stay unexported; export them when an importer appears, not in advance.
