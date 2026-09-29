# PRD — Azgaar Assistant

## Problem Statement

People making maps in the Fantasy Map Generator have two kinds of questions. Some are about the tool: "how do I make rivers wider?", "why is there no autosave?". Others are about their own world: "which states have no ports?", "list the five largest burgs", "write a description for this city". Answering the first needs the documentation. Answering the second needs something that can read the open map, and often change it.

A user should not have to know which kind of question they are asking, or which service can answer it. They care about three things: can I ask, how much can I ask, and what can the Assistant do for me right now. The answers depend on who they are:

- a visitor who hasn't signed up and wants a quick answer for free
- a community member who has signed in and deserves a larger free allowance
- a power user willing to bring their own AI key, who expects no limits and an Assistant that works on their map

Self-hosted copies and the desktop app have no access to the project's server at all. There, the only way to get an Assistant is with the user's own key.

## Solution

**Azgaar Assistant** is one chat panel beside the map, with one text box, one transcript and one look.

What the Assistant can do depends only on the user's **tier**:

| Tier       | How the user gets it                              | What the Assistant does                                                                                                   |
| ---------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Guest**  | Default on the official site                      | Answers questions about the generator from the documentation, with a small daily allowance                                |
| **Member** | Signs in with Discord                             | The same, with a larger daily allowance                                                                                   |
| **Key**    | Connects an AI provider key or a local model      | Answers about the generator **and** about the open map, and makes changes to the map, each with Undo, with no daily limit |
| _No tier_  | Self-hosted copy or desktop app, no key connected | Explains that a key is needed here and offers to connect one                                                              |

The tier is always visible in the panel's footer, next to what is left of it. There are no modes or tabs, and no choice of "where" to ask. Who answers is an internal detail chosen by the tier: the Azgaar server for Guest and Member, the user's Provider for Key. Every free-tier surface — the welcome message, the limit notices, the reply to a map question — invites the user to connect their own key, and says what that unlocks.

Chats are first-class. Every chat is kept in the browser, belongs to one map, can be reopened from a chat list, and can be replaced by a new chat at any time. When a chat grows long enough to slow answers and raise costs, the Assistant suggests starting a new one.

### The panel

A non-modal, resizable dialog titled **Azgaar Assistant**, docked at the bottom right, above its call bubble. From top to bottom:

- **Title bar:** _Chats_ (the chat list, which also holds _New chat_), minimise, close.
- **Transcript:** Assistant messages on the left, the user's on the right. Map reads show as collapsed step rows, and map changes as cards with Undo.
- **Context chip:** shown when the notes editor is open, e.g. `Note: Gondesthe`.
- **Notice area:** limits, countdowns, provider errors, the "long chat" suggestion.
- **Composer:** one text box and a send button that turns into Stop while answering.
- **Footer:** _Wiki_ and _Policy_ links on the left; the tier and its account actions on the right.

Key tier, notes editor open:

```
┌ Azgaar Assistant ────────────────────── [☰] [_] [×] ┐
│                    ┌───────────────────────────────┐ │
│                    │ Which states have no ports?   │ │
│                    └───────────────────────────────┘ │
│  ▸ Read the map · 38 ms                              │
│  ┌─────────────────────────────────────────────┐     │
│  │ Three states are landlocked: **Orwin**,     │     │
│  │ **Kahores** and **Batshinuria**.            │     │
│  └─────────────────────────────────────────────┘     │
│  ✎ Updated note “Gondesthe” · 1.2k chars   [↶ Undo]  │
│                                                      │
│  Note: Gondesthe                                     │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Ask a question…                              [➜] │ │
│ └──────────────────────────────────────────────────┘ │
│ Wiki · Policy · 🔑 Sonnet 5.5 · 12.4k tokens · Key   │
└──────────────────────────────────────────────────────┘
```

Guest tier, first open:

```
┌ Azgaar Assistant ─────────────────────── [☰] [_] [×] ┐
│  ┌─────────────────────────────────────────────┐     │
│  │ Hi! Ask anything about the Fantasy Map      │     │
│  │ Generator.                                  │     │
│  │ Connect your own AI key and I can read      │     │
│  │ this map, answer questions about it and     │     │
│  │ edit it — with no daily limit.              │     │
│  │ [🔑 Connect your AI key]                    │     │
│  └─────────────────────────────────────────────┘     │
│                                                      │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Ask a question…                              [➜] │ │
│ └──────────────────────────────────────────────────┘ │
│ Wiki · Policy · 5 questions left · Sign in · Use key │
└──────────────────────────────────────────────────────┘
```

Footer, right side, by tier:

- **Guest:** `5 questions left · Sign in · Use key`
- **Member:** `18 questions left · Sign out · Use key`
- **Key:** `🔑 <model> · <tokens in this chat> · Key`. No sign-in or sign-out.
- **No tier:** `Use key`

### The key sheet

Opened from _Use key_, _Key_, or any _Connect your AI key_ button. It replaces the transcript inside the panel; it is not a separate dialog.

```
┌ Azgaar Assistant ─────────────────────── [☰] [_] [×] ┐
│  Connect your AI key                                 │
│  Unlimited questions, and I can read and edit this   │
│  map. Your key stays in this browser and goes only   │
│  to the provider.                                    │
│  ⚠ I run scripts in this page to read your map.      │
│    Only use me on maps from sources you trust.       │
│                                                      │
│  Provider  [ Anthropic            ▾]                 │
│  Model     [ claude-sonnet-5-5    ▾]                 │
│  API key   [ ••••••••••••••••     ] Where to get one │
│                                                      │
│  ⓘ Local models need no key. Point to the server     │
│    and enter the model name.                         │
│                                                      │
│                [Cancel]  [Disconnect]  [Connect]     │
└──────────────────────────────────────────────────────┘
```

- **Providers:** Anthropic, OpenAI, Mistral, Qwen, DeepSeek and Local.
  - The model list comes only from discovery: the chat models the provider says this key can use, cached for a day. Until discovery returns, one default model per provider is preselected. The model field also accepts any typed model id.
  - Local shows a server address (default Ollama) and a model name, and notes that the server's context window must fit the Assistant's instructions (about 20k tokens).
- **Discovery doubles as the key check.** Entering a key fetches the model list; if that fails, the provider's error is shown inline. It never blocks **Connect**: the user may type a model id, and a failing key is handled like any other (see "A failing key changes nothing").
- **Disconnect** forgets the key and returns the user to Guest or Member.

### The chat list

Opened from _Chats_. It replaces the transcript inside the panel.

```
┌ Azgaar Assistant ────────────────────── [☰] [_] [×] ┐
│  Chats                                   [+ New chat]│
│  ────────────────────────────────────────────────    │
│  Which states have no ports?          2 min ago  [🗑] │
│  Kingdom of Orwin · 🔑 · 14.2k tokens                │
│  ────────────────────────────────────────────────    │
│  How do I make rivers wider?          yesterday  [🗑] │
│  Kingdom of Orwin                                    │
│  ────────────────────────────────────────────────    │
│  Write a history for Gondesthe         3 days ago [🗑]│
│  Isles of Varn (other map) · 🔑                       │
└──────────────────────────────────────────────────────┘
```

- Every chat belongs to exactly one map from the moment it is created, identified by the **map id**: the map's creation time, carried in the `.map` file. Each row shows the chat's title (its first question), when it was last used, its map's name, whether the Key tier answered it, and its size.
- Selecting a chat opens its transcript.
  - A chat can be **continued** only in the tier it was started in (Guest and Member count as one: the free tiers) and only while its map is open.
  - Otherwise it opens **read-only**, with one generic banner ("Start a new chat to continue") and a _New chat_ button.
- Deleting a chat takes one click, without confirmation.

### When a new chat starts

A new chat starts only on one of these events, and never carries anything over:

- the user presses _New chat_, or _Start a new chat_ in the long-chat notice;
- the tier changes (connect, disconnect, sign in, sign out). The previous chat stays in the list;
- the map changes: a new map is generated (even from the same seed), a different map is loaded, or the Submap or Transform tool produces a new map. A running answer is cancelled first, exactly like Stop. Reloading the same saved map keeps its map id, so its chats continue.

### Long chats

Every Key-tier question re-sends the whole chat, so cost and latency grow with length. When a chat's re-sent message history (not the displayed transcript) exceeds 100,000 characters, roughly 25–30k tokens, the notice area shows after every answer:

> This chat is getting long — each question re-sends all of it. **[Start a new chat]**

Guest and Member chats are kept short by the Azgaar server itself and never show this notice.

## User Stories

### Everyone

1. As a map maker, I want one Assistant with one text box, so that I never have to decide where to ask.
2. As a map maker, I want the feature to have one name, Azgaar Assistant, everywhere I meet it, so that the docs, menus and panel clearly refer to the same thing.
3. As a map maker, I want the footer to show my tier and what's left of it, so that I know what to expect from my next question.
4. As a map maker, I want the welcome message to say what I can ask now and what a key would add, so that I discover map questions and map editing.
5. As a map maker, I want the call bubble, the command palette and the notes editor all to open the same panel, so that there is one Assistant to learn.
6. As a map maker, I want Enter to send and Shift+Enter to add a line, so that the composer works like a messenger.
7. As a map maker, I want answers rendered as Markdown with tables and lists, so that multi-column results are readable.
8. As a map maker, I want a typing indicator with a short status ("Thinking", "Reading the map"), so that I know what the Assistant is doing.
9. As a map maker, I want the send button to become Stop while an answer is running, so that I can cancel a slow or wrong answer.
10. As a map maker, I want the panel to stay beside the map, resizable and non-modal, so that I can look at the map while reading.
11. As a map maker, I want links in answers to open in a new tab, so that I don't lose my map.
12. As a keyboard or screen-reader user, I want the transcript announced as a live log and every control labelled, so that the Assistant works without a mouse or sight.
13. As a map maker, I want to hide the Assistant's call bubble in Options, so that it stays out of the way when I don't need it.

### Chats

14. As a map maker, I want to start a new chat from the chat list at any time, so that I can change topic cleanly.
15. As a map maker, I want my chats kept in this browser and listed with titles and dates, so that I can return to an earlier answer.
16. As a map maker, I want each chat titled after its first question, so that I can recognise it in the list.
17. As a map maker, I want to see which map a chat belongs to, so that I don't confuse answers from different worlds.
18. As a map maker, I want to reopen an old chat and continue it when it still applies, so that I keep its context.
19. As a map maker, I want a chat from another tier or another map to open read-only with a _New chat_ button, so that old answers stay readable and new ones always come from the right place.
20. As a map maker, I want to delete a chat in one click, so that I can keep the list tidy.
21. As a map maker, I want my current chat to survive closing the panel and reloading the page, so that a long session isn't lost.
22. As a map maker, I want generating or loading a different map to cancel any running answer and start a fresh chat, and reloading the same saved map to keep my chat, so that answers always refer to the map I'm looking at.
23. As a map maker, I want a tier change to start a fresh chat, so that one chat never mixes answers from different sources.
24. As a Key-tier user, I want to see how many tokens the current chat has used, so that I can manage cost.
25. As a Key-tier user, I want to be told when a chat has grown long and offered a new one, so that answers stay fast and cheap.
26. As a map maker, I want _Chats_, _New chat_ and tier actions disabled while an answer is running, so that an answer never lands in the wrong chat.
27. As a map maker, I want my chats kept until I delete them, never removed automatically, so that old chats and their Undo stay available.

### Guest and Member

28. As a visitor, I want a few free documentation answers a day without signing up, so that I can try the Assistant at no cost.
29. As a visitor, I want to see how many free questions I have left today, so that I can spend them wisely.
30. As a visitor, I want to sign in with Discord from the footer for a larger allowance, so that I can get more help without paying.
31. As a Member, I want a visible sign-out in the footer, so that I control my account on a shared computer.
32. As a Guest or Member, I want to rate an answer up or down, so that the documentation answers improve.
33. As a Guest or Member, I want a countdown when I'm rate-limited and one automatic retry when it ends, so that I don't have to resend.
34. As a Guest or Member who has run out of questions, I want the notice to offer both Discord sign-in and my own key, so that I can continue today.
35. As a Guest or Member who asks about my map, I want the answer to tell me that this needs my own key and point me to _Use key_, so that I understand why and how to get the answer.
36. As a Guest or Member with the notes editor open, I want the welcome message to say that my own key would let the Assistant write this note, so that I discover note editing where it helps.
37. As a Guest or Member, I want to know that only my question and a chat id are sent — nothing from my map — so that I can trust the Azgaar server.

### Key tier

38. As a map maker, I want to connect a key from Anthropic, OpenAI, Mistral, Qwen or DeepSeek, so that I can use the provider I already pay for.
39. As a map maker, I want to use a local model without a key, so that I can use the Assistant offline and for free.
40. As a map maker, I want the model list to show what my key can actually use, and to type any model id myself, so that new models work without an app update.
41. As a map maker, I want a wrong key to show the provider's error as soon as I enter it, so that a typo shows up immediately.
42. As a map maker, I want my key kept only in this browser and sent only to the provider, and to be told so, so that I can trust the feature.
43. As a map maker, I want to be warned that the Assistant runs scripts in the page, so that I only use it on maps I trust.
44. As a map maker, I want to disconnect my key and fall back to Guest or Member, so that I can stop spending at any time.
45. As a Key-tier user, I want a rejected request (bad key, no credit, provider down) to show the provider's message and keep my key and chat, so that I can fix it and ask again.
46. As a Key-tier user, I want unlimited questions about the generator, answered from the same documentation Guests and Members get, so that my key fully replaces the free tiers.
47. As a Key-tier user, I want exact answers about the open map — counts, names, comparisons — so that I can explore my world without clicking through editors.
48. As a Key-tier user, I want each map read shown as a collapsed step with its duration and result, so that I can check how an answer was reached.
49. As a Key-tier user, I want to ask for a CSV or JSON built from my map and have it downloaded, so that I can take out exactly the data I need.
50. As a Key-tier user, I want to ask the Assistant to write or rewrite a note, so that I can draft lore quickly.
51. As a Key-tier user, I want to ask the Assistant to rename burgs, states, provinces, cultures, religions, rivers and markers, so that I can rework names in bulk without opening each editor.
52. As a Key-tier user with the notes editor open, I want the Assistant to know which note I'm on and what I've selected, so that "make this more ominous" does the right thing.
53. As a Key-tier user, I want every change shown as a card saying what changed, with an Undo, so that nothing the Assistant does is irreversible.
54. As a map maker, I want Undo offered only while the target still holds exactly what the Assistant wrote — in any tier and even in a read-only chat — so that Undo never overwrites my own later edits or another version of the map.
55. As a Key-tier user, I want open editors to refresh when the Assistant changes what they show, so that I see the change immediately.
56. As a Key-tier user, I want the Assistant to refuse changes it has no tool for and say so, so that I'm never told something changed when it didn't.
57. As a Key-tier user, I want suggestion buttons that fit my context (a note open or not), so that I see what the Assistant does well in one click.

### Self-hosted and desktop

58. As a self-hosted or desktop user, I want to be told that the free tiers only run on the official site and be offered my own key, so that the Assistant still works for me.
59. As a desktop user, I want the Assistant bubble and its Options setting in the desktop app, with my own key or local model behaving exactly as on the web, so that I'm not a second-class user.

## Implementation Decisions

### Name and vocabulary

- **Azgaar Assistant** is the product name: dialog title, call-bubble tooltip, the Options setting, the command palette entry ("Open Azgaar Assistant"), wiki and Knowledge Base. The short form is **the Assistant**. "Bot", "Agent", "AI Chat", "Help mode" and "This map" are not used in the UI, docs or identifiers.
- Domain terms (defined in the glossary): **Tier** (Guest, Member, Key), **Chat**, **Map id**, **Change**, **Azgaar server**, **Provider**. Supporting terms used below:
  - **Answerer** — whoever answers a chat: the Azgaar server or the Provider.
  - **Transcript item** — one visible entry in a chat.
  - **Map tool** — a capability the Provider can call on the open map.
  - **Connection** — the user's provider, model and key settings.
- **Code names follow the vocabulary.** The feature is `Assistant`: one controller and one service family under `services/assistant/`. The Azgaar server client lives in `services/assistant/azgaar-server/` and throws `AzgaarServerError`. A chat is a `Chat` in a `chats` store. The Azgaar server's wire field `conversationId` is the only place "conversation" remains, because it is the server's contract.

### Architecture

The Assistant follows the project's layering. Services know nothing about `pack`, `grid`, `options.map` or the DOM. Everything that reads or changes the map — the map tools and the per-question map context — lives in the controller layer and is handed to the Provider answerer when a question is sent.

```
Assistant controller (dialog, transcript view, key sheet, chat list, footer)
   │  resolves the tier, picks the answerer, renders transcript items
   ├── Map tools (controller layer): read_map, write_note, rename — each Change carries its undo
   ├── Map context (controller layer): map summary, open note and selection
   │
   ▼
Assistant services (no world state, no DOM)
   ├── Tier            pure: Azgaar server available? signed in? key connected? → tier
   ├── Chats           store of chats, each bound to its answerer and a map id
   ├── Answerer        one contract; two implementations
   │     ├── Azgaar server → ask, limits, ratings, Discord sign-in
   │     └── Provider      → tool loop over Providers + Knowledge + injected map tools
   ├── Providers       Anthropic adapter + one OpenAI-compatible adapter; model discovery
   ├── Connection      provider, model, keys, local server
   ├── Knowledge       Knowledge Base headings in the instructions; sections via read_help
   └── Instructions    hand-written rules + reference generated from the codebase
```

### Modules

1. **Tier (pure).** Inputs: whether the Azgaar server serves this origin, whether a sign-in token exists, whether a key is connected. Output: the tier, or none. Precedence: key > member > guest; none when the Azgaar server is unavailable and no key is connected. A user who connected a key has chosen unlimited use, so their key answers everything and the free allowance is never spent silently.

2. **Answerer contract.** `send(chat, question, onItem, signal)`: the answerer appends to the chat and reports every new transcript item as it arrives. `status()` returns the footer text for its tier. Transcript items form one closed union:
   - `question`
   - `answer` — Markdown, optional rating id
   - `step` — a map read, with its result and duration
   - `change` — a Change card
   - `notice` — a limit, error or countdown, optionally with actions
   - `divider` — the Azgaar server started a new memory

   The controller renders items and never checks which answerer produced them.

3. **Azgaar server answerer.** Talks to the Azgaar server: ask, daily limits, answer ratings, Discord sign-in and sign-out.
   - The Azgaar server keeps chat memory on its side. The client stores the server's chat id with the chat and never sends transcript content back.
   - When the server starts a new memory because the old one expired, the answerer emits a `divider`.
   - The server's limit texts are shown as they come. On an exhausted allowance the answerer adds its own actions below them: _Sign in_ for a Guest, and _Connect your AI key_ always.
   - Map-specific questions are answered by the server itself, whose instructions recommend the user's own key via _Use key_. The client does no detection.

4. **Provider answerer.** A loop: send the instructions, history and tool definitions to the provider; run the tools it asks for; feed the results back; repeat until it answers or a step limit is reached.
   - Its tools are `read_help` (Knowledge) plus the map tools passed in by the controller.
   - Old tool results are shortened in the stored history to hold down cost.
   - Token usage is added to the chat after every request.
   - The fixed instructions are marked cacheable. The per-question map context comes from the controller and is sent separately, so it never invalidates the cache.
   - **A failing key changes nothing.** When the provider rejects a request (revoked key, no credit, outage, local server down), its message appears as a notice with a _Key_ button. The key stays connected, the tier stays Key, and the user retries by asking again. There is no automatic disconnect and no fallback to the Azgaar server.

5. **Providers.** One internal message format (text, tool calls, tool results) with two adapters: Anthropic's native Messages API, and one OpenAI-compatible adapter for OpenAI, Mistral, Qwen, DeepSeek and local servers. Model discovery asks the provider for its models, keeps only chat models and caches the list for a day; it is the only source of the model list, besides one default model per provider and any typed id. Every request is routed by the connection, not by the model name, so identical model names on two providers never collide.

6. **Connection.** One record: provider, model, one key per provider, local server address, local model name. It offers `get`, `save`, `clear` and `isConnected`. "Connected" means the user set a key and has not disconnected it; validity is never tracked, and discovery is the only key check. Keys are stored per provider in `localStorage`, shared with the AI text generator, and never go anywhere except their provider.

7. **Knowledge.** The Knowledge Base, the same source that grounds the Azgaar server, is split on its question headings. All headings (about 3.3k tokens) go into the cached instructions; `read_help({headings})` returns the full sections for the headings the model picks, loading the Knowledge Base lazily on first use. The model does the ranking, so there is no search or scoring code. The instructions say: `read_help` for "how do I…" questions, map tools for questions about this map.

8. **Instructions.** A hand-written part (role, rules, map pitfalls, note format, the Knowledge Base headings) and a part generated from the codebase at build time (global declarations, core data types, generator and registry names, the configuration and data-model docs). A test fails when the generated part is stale.

9. **Map tools (controller layer).**
   - `read_map({code})` runs a script against the open map and returns its value and console output, trimmed to a size limit. A `describe()` helper for inspecting unfamiliar data is available inside the script. It is read-only by instruction only; there is no snapshot or revert. Asking the browser to save a file (CSV, JSON) is allowed and is not a change.
   - `write_note({id?, html})` replaces an entity's note, defaulting to the note open in the notes editor. It accepts only the notes editor's HTML subset, with no event-handler attributes and no `javascript:` URLs, because notes are rendered into tooltips as HTML. It returns a Change.
   - `rename({id, name})` renames a burg, state, province, culture, religion, river or marker. It changes the name only (not a state's form or full-name pattern) and goes through the same domain path the editors use, so labels and dependent names update exactly as they do there. It returns a Change.
   - **Change contract.** Every mutating tool returns a Change with the map id, the entity key, a label ("Updated note “Gondesthe”"), a size or summary, and the before and after states. Undo is a normal undo, allowed only while the target still holds exactly the after state; otherwise it is refused with "Changed since". The map id is only a cheap first filter. Undo needs no model, so it works in any tier and in read-only chats. Future tools (recolouring, moving burgs…) implement the same contract and need no new UI.
   - The map context — the map summary, the open note's key, HTML and selection — is recomputed after every Change, so later steps in the same question never see stale content.

10. **Chats.** A chat holds:
    - an id, a title (its first question) and the last-used time
    - its answerer (`azgaar-server` or `provider`), and the map id and map name of the map open when it was created
    - its transcript items
    - its answerer memory: the Azgaar server's chat id, or the message history for Provider chats
    - its token usage

    `canContinue(chat, tier, mapId)` is true when the chat's answerer is the current tier's answerer and its map id is the open map's. All chats are kept in IndexedDB under one key through the app's existing key-value store, with no size budget and no automatic deletion; the store loads once when the panel first opens. A Key-tier chat is **long** when its message history exceeds 100,000 characters — a string length, independent of providers and their usage reports.

11. **Assistant controller.** Owns the dialog and its three in-panel views — transcript, key sheet, chat list — plus the composer, context chip, notice area and footer.
    - Opening from any entry point takes no arguments; the notes editor's presence alone changes the welcome message, suggestions and context chip.
    - It starts a new chat on the events in "When a new chat starts". Map changes are detected through the app's `map:generated` event, which fires on generate, load, Submap and Transform.
    - While an answer runs, _Chats_, _New chat_ and tier actions are disabled. The map itself is never locked: the `customization` edit-mode flag is not used, because it blocks every editor yet is reset by loading a map.

### Other decisions

- **Scripts run in the page — an accepted, disclosed risk.** In the Key tier, model-written JavaScript runs with the app's full access, including stored API keys, and text written by other people (notes and names in shared `.map` files) reaches the model, so prompt injection is possible. The alternatives were a "confirm each script" option (little protection, rarely enabled) and a worker sandbox over a copy of the map (the real fix, but significant work). Following simplicity first, the risk is disclosed instead: the key sheet carries a warning line, and the Policy wiki page has Risks and Disclaimer sections. Sanitising note HTML closes the one persistent vector. The sandbox is the planned fix if users report a real problem.
- **Storage.** Everything stays in this browser, never in the `.map` file and never on an FMG server: chats in IndexedDB, the connection in `localStorage`. Azgaar server chats keep their transcript locally for display; only the server's chat id is ever sent back.
- **No tier.** The transcript shows one welcome message explaining that the free tiers are official-site-only, with _Connect your AI key_. The composer is hidden until a key is connected.
- **Desktop app.** The Assistant bubble and its Options row appear in the desktop app. Like a self-hosted copy, the desktop app has no free tiers: no tier until a key is connected. The Azgaar server's origin allowlist and Discord sign-in are web-only.

## Testing Decisions

- Tests check behaviour through public interfaces: given inputs and a mocked network, assert the transcript items and the visible output — never internal state or call order.
- **Tier:** a table test over every combination of inputs.
- **Answerer contract:** one shared suite run against both answerers with mocked transport: the item sequence for a plain question, abort leaving history consistent, and token usage or limits reported.
- **Azgaar server answerer:** limit notices carry the right actions per tier; rate limits give a countdown and exactly one auto-retry; an expired sign-in falls back to Guest; a new server memory emits a divider.
- **Provider answerer:** tool dispatch, unknown-tool errors, the step limit, shortening of old tool results, the split between cached and per-question instructions, and a rejected request leaving key and tier untouched.
- **Providers:** round-tripping the internal format through the OpenAI-compatible adapter; routing by connection; discovery filtering to chat models.
- **Connection:** save and clear, one key per provider, local defaults.
- **Knowledge:** splitting on headings, the heading list in the generated instructions, and `read_help` returning the right sections and reporting unknown headings.
- **Map tools:** note HTML validation, including rejected event attributes; rename through the editors' path with labels updated; Change creation; Undo refused once the target no longer equals the after state (manual edit, another saved version, another map); Undo working in a read-only chat; editor refresh after a write.
- **Chats:** titles, ordering, IndexedDB persistence, `canContinue` across answerer and map id, and the long-chat threshold.
- **Assistant controller:** DOM tests that every transcript item type renders, user text is never rendered as HTML, controls lock while answering, views switch, and `map:generated` cancels a running answer and starts a new chat.
- **Prior art:** the tests of the Azgaar server client, the provider tool loop and its tools, the provider adapters, the notes editor, and the browser DOM tests for dialogs.
- No new Playwright tests. A manual pass on the official site, a self-hosted origin and the desktop app covers each tier.

## Out of Scope

- Changes to the Azgaar server itself: limits, prompts, models. The daily numbers belong to the server; the client only displays them. The one server-side follow-up is the instruction to answer map questions with a key recommendation.
- Map tools beyond `read_map`, `write_note` and `rename`. Each further tool implements the Change contract and gets its own PRD.
- A sandbox for `read_map` scripts, and any snapshot or revert of script side effects — added only if users actually hit the problem.
- Streaming token-by-token answers.
- Summarising a long chat into a new one. The long-chat notice starts an empty chat.
- Syncing chats or connections across devices.
- Hosted or paid keys. The Assistant never proxies or bills a user's key.

## Further Notes

- **Simplicity first.** Every decision here takes the simplest option that works; complexity is added only in response to problems users actually report.
- **Why "Azgaar Assistant".** It is the dialog title, the Options setting and the name used across the wiki. "Bot" suggests the Discord bot, and "Agent" describes an implementation detail of one tier.
- **Local models.** The fixed instructions are around 20k tokens. The key sheet and the Ollama wiki page state the context window local servers need (Ollama's `num_ctx`).
- **Default models** per provider are the first thing a Key-tier user sees and are reviewed each release.
- **Docs that describe the Assistant:** the architecture doc's Assistant section, the glossary, the wiki's Assistant, Ollama, Omnibar, User Interface, Quick Start and Policy pages, and the Knowledge Base entries about the Assistant.
