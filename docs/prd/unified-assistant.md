# Unified assistant branch

`feat/unified-assistant` replaces the visible Help / This Map split with one Azgaar Assistant panel. The hosted FMG connection is the default; the existing personal providers, model controls, optional Discord sign-in and saved chats are in settings.

This frontend must be paired with the same branch of `fmg-bot`. The detailed design and deployment runbook live there at `docs/proposals/unified-fmg-assistant.md` and `docs/runbooks/unified-assistant.md`. Deploy the new `/v2` backend before enabling this client. The branch builds on the Bazgaar fork at `ed20d3cc`, including its Quill 2/entity-note integration.

## Local entry and data access

Right-click **Here** offers a conventional subject selector and actions that open the same assistant. Describing or drafting prepares a prompt; the user presses Send. Opening the selector does not contact a model. The prototype wheel is no longer registered; normal application menus remain.

The service contract is `src/services/agent/contract.ts`, mirrored in `fmg-bot/src/web/agent-contract.ts`. The session loop exposes only the approved documentation, map search/context, note read/proposal and report-drafting tools. The previous arbitrary JavaScript tool is no longer registered.

`map-tools.ts` constructs bounded records from the live map. Full map objects and arrays are never serialized for a provider. A single place-context call collects political, cultural and religious assignments, biome, nearby visible markers and approximate nearest coast/river distances in configured units. Local scans yield for cancellation. There is no cross-edit spatial cache in this initial implementation.

## Notes and reports

Read the whole note, or select a passage in the Quill editor and use `scope: selection`. Only the selected passage is sent for a selection read; surrounding note content stays local. Replacements are composed in a detached Quill editor and displayed before Apply. Apply writes through the existing note bridge; Undo refuses to overwrite an intervening manual edit. A map reload invalidates old proposals. Selection Apply requires the original note editor to remain available.

Generated HTML uses a conservative formatting allowlist. Whole-note reads and selected passages are limited to 8,000 UTF-8 bytes; local source notes for selection previews are limited to 200,000 characters. These limits prevent silent truncation and excessive preview/storage growth.

Bug/idea drafts appear as editable fields. Only **Submit report** sends them to the moderated backend queue. Check status can expose an approved public GitHub link, not a private Discord review link.

Unsupported origins now show provider setup before sending. Hosted access is available on the official origin, or through the existing explicit development gateway override. A self-hosted copy defaults to personal-provider setup; unavailable documentation retrieval is not offered to the model.

Search supports `port: false` for states and burgs, including burgs without a port field. Repeated identical reads are reused within a task, and the next model call is restricted to producing an answer. The last permitted step is also reserved for an answer, rather than another tool request. These controls do not increase the step or context budgets.

The assistant uses an independent 16px body font, larger controls, and a wider default panel.

## Limits and history

Both connection types use at most eight model steps per task, four tools per response, 12,000 bytes per result and a 48,000-byte task context budget. The hosted allowance is provisionally 30 tasks per UTC day, configurable on the server; every model call still receives separate budget accounting. This counting/reset interpretation needs confirmation before release.

Changing provider starts a fresh chat; the old chat stays in history. Existing map-agent text conversations migrate as read-only archives, without executable actions. Browser history expires after 90 days and is capped by conversation count/storage size. Old proposals are not replayable after a map reload.

## Development and verification

Use `npm run dev`. In development only, set `localStorage["fmg-help-gateway"]` to the local backend's base URL and allow the dev origin in backend CORS configuration. Do not put hosted provider credentials in the browser.

Unit tests cover the Here selector, native session contracts, note conflicts and Undo, selected-passage formatting, history migration/expiry, cancellation and a synthetic 70 MB payload remaining local. TypeScript, Biome checks on changed files, and the production build are part of validation.

Before rollout, use representative real maps around 70 MB to measure local scan latency, responsiveness and actual outbound traffic for hosted and personal providers. Manually check zoomed Here placement, note Apply/Undo and map save/reload, provider/sign-in changes and moderator reporting in staging. Unit tests do not establish real-provider quality or large-map browser performance; Playwright is not run automatically in this repository.
