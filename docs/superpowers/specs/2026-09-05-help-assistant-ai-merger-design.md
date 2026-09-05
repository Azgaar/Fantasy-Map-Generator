# Assistant merger: help first, map AI behind a click, notes editing through Quill

**Date:** 2026-09-05
**Status:** design for an unattended fork-only test build. Decisions below were taken by the
agent under the user's brief ("help first; model choice accessible but not front and centre;
start with notes editing; free rein on look and feel"). Anything the user would want to revisit
is marked *(decision)*.
**Worktree:** `.claude/worktrees/help-assistant-ai`, branch `worktree-help-assistant-ai`, off fork
main `cbe08801` (1.151.2-fork.1). Local commits only; nothing is pushed.

## Purpose

Three lineages exist today and the brief is to make them one surface:

| Lineage | Where it lives | What it is |
|---|---|---|
| Help assistant (Azgaar #1804, 1.151.2) | `upstream/master`, `upstream/help-assistant` — not yet on fork main | The "?" bubble and `#helpAssistant` dialog: one wiki-grounded question at a time to the fmg-bot gateway, Discord sign-in, thumbs feedback, server-side conversation id. Free, budgeted, official origin only. |
| AI chat (Azgaar `ai-interface` + fork PRs #39/#40 + model discovery) | fork main: `src/controllers/ai-chat.ts`, `src/services/agent/*` | BYOK agent with one `run(code)` tool over the live map, read-only by prompt, six providers, local models, persisted conversations per map, snapshot before every run. Opened from Tools → "AI Chat". |
| Notes editor on Quill 2 (Azgaar #1803) | being built by the Quill agent in `~/dev/fmg-quill`, branch `feat/notes-editor-quill` off upstream master; not yet created | TinyMCE replaced by a bundled Quill 2 view over the HTML in `note.legend`; module-scope Quill instance; `loadNote`/`updateLegend` paths; raw-HTML textarea mode for non-representable notes. |

After this work the "?" dialog is the only assistant surface. It opens on **Help**. One click away
is **This map**, the BYOK assistant, which can now edit notes through the notes editor and whose
model and key settings sit behind a gear. The separate "AI Chat" dialog is gone.

## Decisions from the brief

1. **Help first.** The dialog always opens on the Help panel when opened from the bubble. Only
   contextual entry points (Tools → Assistant, the notes editor's AI button) land on This map,
   because there the user has already asked for the map assistant.
2. **Model choice is a click away, not a bar of controls.** The model, key and local-server fields
   live in a settings drawer toggled by a gear. A status line names the current model in one short
   phrase. The drawer opens itself only when sending is impossible without it (no key).
3. **Notes first, map later.** The only mutation the model gets is `write_note`. `run` stays
   read-only by prompt exactly as today. The tool plumbing is generic so Stage-2 map editing (per
   `docs/prd/ai-chat.md`) adds tools, not architecture.
4. **Fork-only test build.** Nothing here is shaped for an upstream PR. Where the upstream help
   widget code is touched, the touch is minimal and additive so the next sync stays easy.

## Approaches considered

- **A. Two dialogs, cross-linked.** Keep `#helpAssistant` and `#aiChat` and add a link between
  them. Rejected: the brief says one dialog, and two transcripts, two "new chat" controls and two
  layouts would fight each other on screen next to the notes editor.
- **B. One dialog, two panels (chosen).** The help dialog gains a segmented mode control; the AI
  chat UI moves in as the second panel, restyled to the help dialog's idiom. The gateway help path
  and the BYOK agent path stay separate services with separate transcripts, so neither budget,
  trust model nor contract changes.
- **C. One conversation, the model routes.** A single transcript where the user's own model answers
  usage questions too and decides when to run scripts. Rejected: the help answers must stay
  wiki-grounded and free (the gateway refuses client-supplied history by design), a BYOK model
  answering "how do I export SVG" from its training data is worse than the gateway, and the
  unlisted-origin case (every fork deployment) would leave Help with no provider at all.

## Design

### 1. Dialog shell

- Element id `helpAssistant`, title "Azgaar's Assistant" (unchanged — the name is Azgaar's call).
  Same lazy controller, same bubble, same `azgaarAssistant` option and Electron exclusion of the
  bubble.
- **Mode control** at the top: two segments, `Help` (`icon-help-circled`) and `This map`
  (`icon-robot`). Exactly one panel is visible. Switching never re-renders the other panel, so a
  half-typed question or an in-flight request survives a switch.
- **Size and position** *(decision)*: resizable, default 460×600, minimum 360×420, opened at the
  right edge of the map (`my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"`) so it
  sits beside the centred notes editor instead of on top of it. The help dialog was 420 wide,
  fixed and centred; This map needs the height, and one geometry for both panels avoids a jump on
  switch. Each panel is a flex column filling the dialog; the transcript areas take the slack.
- **`open(options?)`**: `{ mode?: "help" | "map" }`. When the dialog is already mounted, `open`
  switches mode and refreshes the map panel's context instead of rebuilding — the notes editor's
  AI button can be clicked repeatedly without losing the transcript.
- **Entry points.** Bubble → `open()` (Help). Tools menu button `openAiChatButton`, relabelled
  "Assistant" → `open({ mode: "map" })`. Notes editor's `notesGenerateWithAi` (robot) →
  `open({ mode: "map" })`; the note context is implicit because the editor is open. The AI Text
  Generator controller stays in the tree, registered and untouched, but nothing opens it any more
  *(decision — the assistant with `write_note` covers its one use)*.
- **Electron**: the bubble stays hidden (help gateway is web-only), the Tools button still opens the
  dialog on This map, and the Help panel shows the same unlisted-origin explanation a fork
  deployment sees. The desktop CSP already allows `connect-src https:`.

### 2. Help panel

The upstream widget's markup and behaviour, moved under a panel wrapper, otherwise unchanged:
form (log, notice, question, footer with limits/auth/ask, disclosure) on the official origin or in
DEV, the unlisted-origin explanation elsewhere, the four community links under either. All exported
helpers (`noticeFor`, `shouldAutoRetry`, `limitsLabel`, `normalizeQuestion`,
`buildFeedbackControl`) and their tests stay as they are. The only edits are: the panel wrapper,
the id-based `isMounted()` check becoming panel-aware where needed, and the dialog options above.

### 3. This map panel

Derived from `src/controllers/ai-chat.ts` (which is deleted; `Controllers.AiChat` leaves the
registry; the agent context is regenerated).

- **Header row**: conversation `<select>`, new (`icon-plus`) and delete (`icon-trash`) — the
  existing per-map conversation store is kept as is.
- **Transcript**: the existing entry kinds (`message` user/assistant/system/error, `script` with
  collapsible code and result) plus a new **`edit`** entry: one line such as
  "Updated note **Kelmora** · 1.2k chars" with an **Undo** button (`icon-ccw`). The markdown
  renderer, link handling and follow-scroll behaviour are reused.
- **Context chip**: when the notes editor is open, a chip above the composer reads
  "Note: *name*" (id in the tooltip). It is informational and refreshes on open and on every
  send; selection changes in the editor are not tracked live because the prompt is rebuilt per
  turn anyway. No chip when the editor is closed.
- **Composer**: auto-growing textarea (Enter sends, Shift+Enter newline), send/stop button,
  gear button (`icon-cog`) toggling the settings drawer.
- **Status line** under the composer: `claude-sonnet-5 · Anthropic · key set` or `· no key`,
  then the token line when the conversation has usage. The model name is a button that also opens
  the drawer.
- **Settings drawer** (hidden by default): model select grouped by provider with discovered
  models merged in, API key field with the provider's key link, local URL/model fields for the
  Local sentinel. Storage keys unchanged (`fmg-ai-chat-model`, `fmg-ai-kl-<provider>`,
  `fmg-ai-local-url`, `fmg-ai-local-model`). Sending with no key (non-local) opens the drawer,
  focuses the key field and shows an inline hint "Add your API key to start" instead of a red
  tip. The drawer state is not persisted; it closes on send.
- **Empty state**: one line of intent and suggestion chips. Without a note context: the three
  existing map questions. With a note context: "Write a description for this note", "Make it
  more ominous", "Tighten the wording, keep the facts" *(decision — copy is editable later)*.

### 4. Notes editing

**Bridge on the notes editor** (fork-side additions to `NotesEditor`'s public surface, agreed
with the Quill agent on 2026-09-05; the upstream Quill PR itself gets none of this):

- `current(): Note | null` — the note selected in the open editor, `null` when closed.
- `write(id, legend, name?): Note` — create-or-update in `notes`. When the editor is open on
  that id it reloads the view through the editor's own `loadNote` + `updateNotesBox` path (the
  same path its AI-generator apply uses, so raw-mode detection is automatic). When the editor is
  open on a different note the new id is added to the element select. When closed, only the data
  changes.
- `remove(id)` — drop the note; if the editor shows it, move to the first remaining note or close.
- `getSelectionHtml(): string | null` — Quill selection as semantic HTML; `null` in raw mode, when
  nothing is selected or when closed.

Until the Quill branch is merged, the same four functions are implemented over the current
TinyMCE/contenteditable controller (`write` sets `innerHTML` and `tinymce.activeEditor.setContent`,
`getSelectionHtml` returns `null`). The interface is the contract; the implementation swaps.

**Tool `write_note`** — `{ id?: string; name?: string; html: string }`. `id` defaults to the
current editor note; when neither exists the tool returns an error telling the model to find the
element id first. `html` is the whole legend. The handler:

1. Rejects HTML the editor cannot hold (the Quill module's `canEditAsRichText` tag allowlist;
   before the merge a local stub with the same signature) with an error naming the offending tag,
   so the model simplifies rather than silently pushing the editor into raw mode.
2. Captures the previous state (`null` when the note is new, else `{ legend, name }`).
3. Calls `NotesEditor.write` through the lazy `Controllers` registry (the notes chunk, and Quill
   with it, loads on the first edit — acceptable: an edit implies the notes UI).
4. Appends an `edit` entry to the conversation and returns a short confirmation to the model
   (`updated note burg12 "Kelmora", 1204 chars`).

**Undo** is the assistant's own: the `edit` entry's button restores the captured state through
`write` (or `remove` for a created note), marks the entry undone and disables itself. Whole-note
writes clear Quill's undo stack by design (the Quill agent's `setEditorHtml` is silent), which is
why the assistant does not rely on Ctrl+Z. Entries persist with the conversation, so undo survives
a reload as long as the note still exists. The `run` snapshot (`capture()` before every script)
is unchanged.

**Prompt changes** (`src/services/agent/context.ts`):

- RULES: the read-only rule gains one exception — notes change only through `write_note`, never
  by assigning to `notes` in a script.
- New `# Notes` section: what a note is (`{id, name, legend}` with HTML in `legend`), the id
  convention (`burg<i>` for burgs, markers and other elements use their SVG element id — find it
  with a script when the user names a thing rather than a note), the HTML the editor holds
  (`p strong em u s a ul ol li blockquote h1-h6 sub sup table…`, inline styles only, no
  markdown, no classes), and "keep what the user wrote unless asked to change it".
- The dynamic per-turn block gains the notes editor state when it is open: id, name, the current
  legend HTML (truncated at 6000 chars with a pointer to read the rest via `notes`), and the
  selection HTML when there is one. The controller passes this text in; the service layer keeps
  importing nothing from controllers.

**Session plumbing** (`src/services/agent/session.ts`): `createSession(getConfig, tools)` takes a
list of `{ definition, handle(input) => Promise<string | { content, isError }> }`. `run` is the
built-in first tool. The loop dispatches `tool_use` blocks by name and reports unknown names back
to the model as errors. `SessionHandlers` gains `onTool(name, input)` so the UI can show an
in-progress line, and the notes handler emits its own transcript entry.

### 5. Files

| File | Change |
|---|---|
| `src/controllers/help-assistant.ts` | upstream code + mode control, `open(options)`, panel wrappers, dialog options |
| `src/controllers/help-assistant-map.ts` | new: the This map panel (moved from `ai-chat.ts`, restyled) |
| `src/controllers/help-assistant-notes.ts` | new: note context text, `write_note` tool, undo |
| `src/controllers/ai-chat.ts` | deleted; registry entry removed; `npm run generate:agent-context` |
| `src/controllers/notes-editor.ts` | bridge functions; robot button opens the assistant |
| `src/controllers/notes-rich-text.ts` | pre-merge stub exporting `canEditAsRichText` only; replaced wholesale by the Quill agent's module at merge |
| `src/services/agent/session.ts`, `context.ts`, `conversations.ts` | tool list, prompt sections + dynamic notes block, `edit` entry kind |
| `src/components/tools.ts`, `src/index.html` | Tools button → assistant map mode; label "Assistant" |
| `public/index.css` | help assistant styles extended; ai-chat's inline `<style>` moved here under `helpAssistant*` names; `npm run stamp-assets` |
| `public/main.js`, `electron/main.ts`, `public/libs/openwidget.min.js`, `tests/e2e/help-token-stash.spec.ts` | arrive with the upstream help-assistant merge |

### 6. Testing

**Unit (vitest, jsdom):**
- `help-assistant-notes.test.ts`: `write_note` update and create paths capture the right previous
  state and call the bridge with the right arguments; id defaults to the current note; no id and no
  current note → error; non-representable HTML → error naming the tag; undo restores or removes
  and marks the entry; note context block formatting incl. the 6000-char truncation and the
  selection line.
- `session.test.ts` additions: a registered tool handler is called with the parsed input and its
  string lands in the `tool_result`; an unknown tool name produces an `is_error` result; `run`
  still executes.
- `help-assistant.test.ts` (upstream) unchanged and green; additions for the pure helpers
  `resolveOpenMode` and `needsKey`.
- `notes-editor` bridge: `write` on a closed editor mutates `notes` only; `write` on an open
  editor reloads the view (DOM assertions).

**Browser (Playwright, own dev server on port 5199, system chromium, a repo-local config that
overrides `baseURL`/`webServer` — the user's 5173 is never used):**
1. Bubble → dialog on Help; the mode control switches to This map and back without losing typed
   text.
2. Help round trip with the gateway stubbed by `page.route` (DEV passes the origin gate): answer
   rendered as markdown, limits line updated, thumbs present.
3. Map mode with the Anthropic endpoint stubbed by `page.route`: the first completion returns a
   `write_note` tool use, the second a text answer. Assert `notes[i].legend` changed, the open
   notes editor shows the new HTML, the transcript has the edit entry, Undo restores the old HTML
   in both places.
4. Notes editor robot button → dialog on This map with the note chip.
5. No key → drawer opens with the hint; typing a key and sending proceeds.

**Not run:** the Electron app; live provider or gateway calls (they cost money and the fork
origin is unlisted anyway).

### 7. Delivery sequence

1. `git merge upstream/help-assistant` (26 commits on 1.150.0, already an ancestor of fork
   main). Expected conflicts: `src/index.html` (version line and one hunk) and
   `src/utils/markdown.test.ts` (add/add, both sides are the same renderer's tests). Resolve
   block by block, never whole-file. Unit tests green, `tsc` clean.
2. Build sections 1–5 with tests (section 6), committing per task.
3. When the Quill agent reports Tasks 1–3 building: merge `feat/notes-editor-quill`. Expected
   conflicts: `package.json`, `package-lock.json`, `src/services/versioning.ts`,
   `src/types/global.ts` (their `tinymce` deletion), the `notes-rich-text.ts` stub (take theirs).
   Then `npm install --package-lock-only && npm ci`, `npm run generate:agent-context`, re-implement
   the bridge over Quill, rerun everything.
4. Browser verification, `npx biome check`, `npm run stamp-assets`. Results ticked into the
   checklist at the end of this file. No push.

## Out of scope

- Map mutation through `run` (PRD Stage 2), change summaries, streaming, cost display beyond the
  existing token line.
- `replaceSelection` and live change listeners on the notes editor (the per-turn context rebuild
  makes them unnecessary for v1).
- Help questions answered by the user's own model; any change to the gateway contract.
- Electron support for the help gateway; upstream PRs for any of this.
- Removing the AI Text Generator controller.

## Verification checklist (filled in as the build proceeds)

- [ ] upstream/help-assistant merged; unit tests green; tsc clean
- [ ] mode control, open(options), entry points
- [ ] This map panel with drawer, status line, chip, empty state
- [ ] notes bridge (TinyMCE-era implementation)
- [ ] write_note tool + undo + prompt sections
- [ ] unit tests listed in §6
- [ ] browser scenarios 1–5 on port 5199
- [ ] Quill branch merged; bridge re-implemented over Quill; scenarios rerun
- [ ] biome + stamp-assets clean
