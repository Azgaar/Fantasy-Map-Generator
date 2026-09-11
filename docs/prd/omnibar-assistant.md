# Omnibar assistant

The `feat/omnibar-assistant` branch integrates `feat/unified-assistant` with upstream `codex/omnibar`. Search and conversation share one overlay. Existing menus and the Here selector remain available.

## Interaction

- Press Space with map focus, or use the menu Search button, to open local search.
- Typing searches commands, entities and note text in the browser. It never submits an LLM request.
- Normal queries also show **Ask assistant: “…”** after local matches. With no local match, this is the selected result. Enter or clicking the row submits the question once.
- A leading `>` keeps command-only search. Normal feature activation still uses the omnibar's existing navigation/editor behaviour.
- Select a feature with the arrow keys and use **Ask about [name]** to attach it as context without sending a question. Tab reaches this action. The context appears as a removable chip in the conversation.
- The Assistant button opens or resumes the conversation without sending. Existing assistant bubble, menu, notes-editor and right-click Here actions reach the same surface.
- On assistant activation the overlay expands, hides the search input and displays the conversation, one message composer and the existing provider/settings drawer. There are no Help/This Map tabs.
- **Search** returns to local results without losing the conversation or message draft. **New chat** uses the existing conversation controls; provider changes start a separate conversation.
- Escape, Close, clicking the map or switching away collapses the overlay. An existing conversation remains mounted, so an accepted task may finish while collapsed. Use the composer's Stop button to cancel it. Reopening Assistant restores the draft and transcript.
- Note proposals retain Preview, Apply, Discard and Undo. Preview is read-only and opens above the omnibar. Escape in the preview closes that dialog, not the underlying conversation.

## Implementation

`controllers/omnibar.ts` owns search, ranking and presentation. It lazily imports the assistant panel when requested. `help-assistant.ts` is a compatibility entry point into `Controllers.Omnibar.open({assistant: true})`; the retired v1 chat dialog is removed. `help-assistant-styles.ts` supplies the existing assistant presentation to its new host.

`help-assistant-map.ts` remains responsible for the composer, settings, history, reports and note proposal controls. Its session uses the existing hosted or personal-provider connection and bounded tools. Sending a question from search enters that same validation and setup flow; a missing provider configuration leaves the question in the composer for submission after setup.

`MapEntities` owns entity reference parsing, lookup, names and positions. `components/notes.ts` owns note storage. The assistant note bridge and tools now consume those modules rather than the removed `generators/notes.ts`. Rich-text selection, application and conflict-aware Undo are retained.

Keyboard handling distinguishes search from conversation controls. Native text editing, button activation and Tab navigation work inside the expanded panel, while map hotkeys do not consume those keystrokes. Modal note previews and confirmation dialogs receive their own input and focus.

A `map:generated` event invalidates context and pending note proposals, cancels the old task and mounts the current map's conversation. This works even if generation reuses the pack object. Mount guards prevent an old task's completion from resetting the new composer's state. Entity context is revalidated after lazy loading, and a question is not submitted against a map that changed during loading.

## Data and permissions

- The omnibar's index is local. It is not passed to the model, stored in chat history or uploaded.
- Selected entities supply only a stable reference, label and map identity. Map facts and note text are collected through the approved bounded tools when required.
- The full map, embedded assets and geometry arrays never become provider context.
- Search result count remains capped at 50 local results, plus the assistant submission row. Indexing cost is separate from this display cap.
- The existing maximum question, tool-result, task-context and step limits still apply.
- The command registry is for explicit human actions. It is not registered as a model tool; generation and export actions are not granted to the assistant by this integration.
- Hosted anonymous access and personal-provider settings retain their existing origin checks and storage behaviour. No new backend route or shared tool-contract change is needed.

## Verification

Unit coverage includes local-only typing, question submission, command-only filtering, entity context, draft preservation, keyboard ownership, map replacement, existing note Apply/Undo and the 70 MB synthetic payload guard. Existing omnibar tests continue covering navigation, search ranking, safe snippets, stale entities and command history. The integration also requires the full non-browser unit suite, TypeScript/Vite build and Biome checks.

Manual acceptance is still required for visual positioning, mouse/keyboard focus across the map and dialogs, actual provider responses, saving/reloading edited maps and responsiveness on representative real maps around 70 MB. No browser automation is run automatically under this repository's instructions.
