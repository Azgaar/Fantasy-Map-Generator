# PRD — Azgaar Assistant

## Problem Statement

People making maps in the Fantasy Map Generator have two kinds of questions. Some are about the tool: "how do I make rivers wider?", "why is there no autosave?". Others are about their own world: "which states have no ports?", "list the five largest burgs", "write a description for this city". Answering the first needs the documentation. Answering the second needs someone who can read the open map, and often someone who can change it.

A user should not have to know which kind of question they are asking, or which service can answer it. They care about three things: can I ask, how much can I ask, and what can the Assistant do for me right now. Today's answers depend on who they are:

- a visitor who hasn't signed up and wants a quick answer for free
- a community member who has signed in and deserves a larger free allowance
- a power user willing to bring their own AI key, who expects no limits and an Assistant that works on their map

Users on self-hosted copies and the desktop app have no free service at all. The only way they get an Assistant is with their own key.

## Solution

**Azgaar Assistant** is one chat panel beside the map, with one text box, one transcript and one look.

What the Assistant can do depends only on the user's **tier**:

| Tier            | How the user gets it                              | What the Assistant does                                                                                                   |
| --------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Free**        | Default on the official site                      | Answers questions about the generator from the documentation, with a small daily allowance                                |
| **Member**      | Signs in with Discord                             | The same, with a larger daily allowance                                                                                   |
| **Own key**     | Connects an AI provider key or a local model      | Answers about the generator **and** about the open map, and makes changes to the map, each with Undo, with no daily limit |
| **Unavailable** | Self-hosted copy or desktop app, no key connected | Explains that a key is needed and offers to connect one                                                                   |

The tier is always visible in the panel's footer, next to what is left of it. There are no modes or tabs, and no choice of "where" to ask. The engine behind an answer is an internal detail chosen by the tier. Every free-tier surface — the welcome message, the limit notices, the reply to a map question — invites the user to connect their own key, and says what that unlocks.

Conversations are first-class. Every chat is kept in the browser, can be reopened from a chat list, and can be replaced by a new chat at any time. When a chat grows long enough to slow answers and raise costs, the Assistant suggests starting a new one.

### The panel

A non-modal, resizable dialog titled **Azgaar Assistant**, docked at the bottom right, above its call bubble. From top to bottom:

- **Title bar:** _Chats_ (list of conversations + new chat button), minimise, close.
- **Transcript:** Assistant messages on the left, the user's on the right. Map reads show as collapsed step rows, and map changes as cards with Undo.
- **Context chip:** shown when the notes editor is open, e.g. `Note: Gondesthe`.
- **Notice area:** limits, countdowns, the "long chat" suggestion.
- **Composer:** one text box and a send button that turns into Stop while answering.
- **Footer:** community links on the left; the tier and its account actions on the right.

Own key tier, notes editor open:

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

Free tier, first open:

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

- **Free:** `5 questions left · Sign in · Use key`
- **Member:** `18 questions left · Sign out · Use key`
- **Own key:** `🔑 <model> · <tokens in this chat> · Key`
- **Unavailable:** `Use key`

### The key sheet

Opened from _Use key_, _Key_, or any _Connect your AI key_ button. It replaces the transcript inside the panel; it is not a separate dialog.

```
┌ Azgaar Assistant ─────────────────────── [☰] [_] [×] ┐
│  Connect your AI key                                 │
│  Unlimited questions, and I can read and edit this   │
│  map. Your key stays in this browser and goes only   │
│  to the provider.                                    │
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
  - The model list shows recommended models first, then whatever the key can actually use.
  - Local shows a server address (default Ollama) and a model name, and notes that the server's context window must fit the Assistant's instructions.
- **Connect** checks the key against the provider before accepting it, and shows the provider's error inline if it fails.
- **Disconnect** forgets the key and returns to the Free or Member tier.

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

- Each chat shows its title (from its first question), when it was last used, the map it was about, whether it used the user's key, and its size.
- Selecting a chat opens its transcript.
  - A chat can be **continued** only when it can still be answered the way it started: same kind of engine (free or own key) and, for own-key chats, its map is open.
  - Otherwise it opens **read-only**, with a banner saying why and a _Continue in a new chat_ button.
- Deleting a chat asks NO confirmation.

### Long chats

Every own-key question re-sends the whole chat, so cost and latency grow with length. When a chat passes a size threshold, the notice area shows:

> This chat is getting long — each question re-sends all of it. **[Start a new chat]**

Free and Member chats are kept short by the service itself and never show this notice.

## User Stories

### Everyone

1. As a map maker, I want one Assistant with one text box, so that I never have to decide where to ask.
2. As a map maker, I want the feature to have one name, Azgaar Assistant, everywhere I meet it, so that the docs, menus and panel clearly refer to the same thing.
3. As a map maker, I want the footer to show my tier and what's left of it, so that I know what to expect from my next question.
4. As a map maker, I want the welcome message to say what I can ask now and what a key would add, so that I discover map questions and map editing.
5. As a map maker, I want the call bubble, _Tools → Assistant_, the command palette and the notes editor all to open the same panel, so that there is one Assistant to learn.
6. As a map maker, I want Enter to send and Shift+Enter to add a line, so that the composer works like a messenger.
7. As a map maker, I want answers rendered as Markdown with tables and lists, so that multi-column results are readable.
8. As a map maker, I want a typing indicator with a short status ("Thinking", "Reading the map"), so that I know what the Assistant is doing.
9. As a map maker, I want the send button to become Stop while an answer is running, so that I can cancel a slow or wrong answer.
10. As a map maker, I want the panel to stay beside the map, resizable and non-modal, so that I can look at the map while reading.
11. As a map maker, I want links in answers to open in a new tab, so that I don't lose my map.
12. As a keyboard or screen-reader user, I want the transcript announced as a live log and every control labelled, so that the Assistant works without a mouse or sight.
13. As a map maker, I want to hide the Assistant's call bubble in Options, so that it stays out of the way when I don't need it.

### Conversations

14. As a map maker, I want to start a new chat from the chat list at any time, so that I can change topic cleanly.
15. As a map maker, I want my chats kept in this browser and listed with titles and dates, so that I can return to an earlier answer.
16. As a map maker, I want each chat titled after its first question, so that I can recognise it in the list.
17. As a map maker, I want to see which map a chat was about, so that I don't confuse answers from different worlds.
18. As a map maker, I want to reopen an old chat and continue it when it still applies, so that I keep its context.
19. As a map maker, I want a chat about a different map, or from a different tier, to open read-only with a _Continue in a new chat_ option, so that stale context never leaks into new answers.
20. As a map maker, I want to delete a chat in one click, so that I can keep the list tidy.
21. As a map maker, I want my current chat to survive closing the panel and reloading the page, so that a long session isn't lost.
22. As a map maker, I want generating or loading a different map to start a fresh chat, so that answers always refer to the map I'm looking at.
23. As an own-key user, I want to see how many tokens the current chat has used, so that I can manage cost.
24. As an own-key user, I want to be told when a chat has grown long and offered a new one, so that answers stay fast and cheap.
25. As a map maker, I want _New chat_, _Chats_ and tier actions disabled while an answer is running, so that an answer never lands in the wrong chat.
26. As a map maker, I want the oldest chats dropped automatically when browser storage runs short, so that the Assistant never breaks because of old history.

### Free and Member

27. As a visitor, I want a few free documentation answers a day without signing up, so that I can try the Assistant at no cost.
28. As a visitor, I want to see how many free questions I have left today, so that I can spend them wisely.
29. As a visitor, I want to sign in with Discord from the footer for a larger allowance, so that I can get more help without paying.
30. As a member, I want a visible sign-out, so that I control my account on a shared computer.
31. As a free-tier user, I want to rate an answer up or down, so that the documentation answers improve.
32. As a free-tier user, I want a countdown when I'm rate-limited and one automatic retry when it ends, so that I don't have to resend.
33. As a free-tier user who has run out of questions, I want the notice to offer both Discord sign-in and my own key, so that I can continue today.
34. As a free-tier user who asks about my map, I want to be told that this needs my own key, with a button to connect one, so that I understand why and how to get the answer.
35. As a free-tier user with the notes editor open, I want the welcome message to say that my own key would let the Assistant write this note, so that I discover note editing where it helps.
36. As a free-tier user, I want to know that only my question and a chat id are sent — nothing from my map — so that I can trust the service.

### Own key

37. As a map maker, I want to connect a key from Anthropic, OpenAI, Mistral, Qwen or DeepSeek, so that I can use the provider I already pay for.
38. As a map maker, I want to use a local model without a key, so that I can use the Assistant offline and for free.
39. As a map maker, I want the model list to show recommended models first, then everything my key can use, so that new models appear without an app update.
40. As a map maker, I want Connect to check my key before accepting it, so that a typo shows up immediately.
41. As a map maker, I want my key kept only in this browser and sent only to the provider, and to be told so, so that I can trust the feature.
42. As a map maker, I want to disconnect my key and fall back to my free tier, so that I can stop spending at any time.
43. As an own-key user, I want unlimited questions about the generator, answered from the same documentation the free tier uses, so that my key fully replaces the free tier.
44. As an own-key user, I want exact answers about the open map — counts, names, comparisons — so that I can explore my world without clicking through editors.
45. As an own-key user, I want each map read shown as a collapsed step with its duration and result, so that I can check how an answer was reached.
46. As an own-key user, I want to ask for a CSV or JSON built from my map and have it downloaded, so that I can take out exactly the data I need.
47. As an own-key user, I want to ask the Assistant to write or rewrite a note, so that I can draft lore quickly.
48. As an own-key user with the notes editor open, I want the Assistant to know which note I'm on and what I've selected, so that "make this more ominous" does the right thing.
49. As an own-key user, I want every change shown as a card saying what changed, with an Undo, so that nothing the Assistant does is irreversible.
50. As an own-key user, I want Undo to work only on the map the change was made to, so that undoing an old edit never touches another map.
51. As an own-key user, I want open editors to refresh when the Assistant changes what they show, so that I see the change immediately.
52. As an own-key user, I want the Assistant to refuse changes it has no tool for and say so, so that I'm never told something changed when it didn't.
53. As an own-key user, I want suggestion buttons that fit my context (a note open or not), so that I see what the Assistant does well in one click.

### Self-hosted and desktop

54. As a self-hosted or desktop user, I want to be told that the free tier only runs on the official site and be offered my own key, so that the Assistant still works for me.
55. As a desktop user, I want my own key or local model to behave exactly as on the web, so that I'm not a second-class user.

## Implementation Decisions

### Name and vocabulary

- **Azgaar Assistant** is the product name: dialog title, call-bubble tooltip, the Options setting, the command palette entry ("Open Azgaar Assistant"), wiki and Knowledge Base. The short form is **the Assistant**.
- In code the feature is `Assistant`: one controller and one service family. "Bot", "Agent", "AI Chat", "Help mode" and "This map" are not used in the UI, docs or identifiers.
- Internal terms, added to the glossary:
  - **Tier** — `free`, `member`, `own-key` or `unavailable`.
  - **Engine** — what answers a question: the **hosted engine** (the project's documentation service) or the **own-key engine** (a tool-using model called directly from the browser).
  - **Conversation** — one chat.
  - **Transcript item** — one visible entry in a conversation.
  - **Map tool** — a capability the own-key engine can call on the open map.
  - **Change** — a map mutation made through a map tool, carrying its own undo.
  - **Connection** — the user's provider, model and key settings.

### Architecture

The Assistant follows the project's layering. Services know nothing about `pack`, `grid` or the DOM. Everything that reads or changes the map is a controller-layer map tool, handed to the engine when a question is sent.

```
Assistant controller (dialog, transcript view, key sheet, chat list, footer)
   │  resolves the tier, picks the engine, renders transcript items
   ├── Map tools (controller layer): read map, write note, … — each Change carries its undo
   │
   ▼
Assistant services (no world state, no DOM)
   ├── Tier            pure: gateway available? signed in? connection valid? → tier
   ├── Conversations   store of conversations, each bound to an engine kind and a map id
   ├── Engine          one contract; two implementations
   │     ├── Hosted engine   → documentation service (ask, limits, feedback, Discord sign-in)
   │     └── Own-key engine  → tool loop over Providers + Knowledge search + injected map tools
   ├── Providers       Anthropic native adapter + one OpenAI-compatible adapter; model discovery
   ├── Connection      provider/model/keys/local server; verify()
   ├── Knowledge       search over the Knowledge Base, exposed to the own-key engine as a tool
   └── Instructions    system prompt: hand-written rules + reference generated from the codebase
```

### Modules

1. **Tier (pure).** Inputs: whether the hosted engine serves this origin, whether a sign-in token exists, whether a verified connection exists. Output: the tier. Precedence: own-key > member > free > unavailable. A user who connected a key has chosen unlimited use, so their key answers everything and the free allowance is never spent silently.

2. **Engine contract.** `send(conversation, question, onItem, signal)`: the engine appends to the conversation and reports every new transcript item as it arrives. `status()` returns the footer text for its tier. Transcript items form one closed union:
   - `question`
   - `answer` — Markdown, optional rating id
   - `step` — a map read, with its result and duration
   - `change` — a Change card
   - `notice` — a limit, error or countdown, optionally with actions
   - `divider` — a new server memory or a tier switch

   The controller renders items and never checks which engine produced them.

3. **Hosted engine.** Talks to the documentation service: ask, daily limits, answer ratings, and Discord sign-in and sign-out.
   - The service keeps conversation memory on its side. The client stores only the service's conversation id with the conversation, and never sends transcript content back.
   - When the service starts a new memory, because the old one expired, the engine emits a `divider`.
   - The service's limit texts are shown as they come. On an exhausted allowance the engine adds its own actions below them: _Sign in_ when the user is Free, and _Connect your AI key_ always.

4. **Own-key engine.** A loop: send the instructions, history and tool definitions to the provider; run the tools it asks for; feed the results back; repeat until it answers or a step limit is reached.
   - Its tools are `search_help` (Knowledge), plus the map tools passed in by the controller.
   - Old tool results are shortened in the stored history to hold down cost.
   - Token usage is added to the conversation after every request.
   - The fixed part of the instructions is marked cacheable, and the per-question part (the map summary, the open note) is sent separately so it doesn't invalidate the cache.

5. **Providers.** One internal message format (text, tool calls, tool results) with two adapters: Anthropic's native Messages API, and one OpenAI-compatible adapter for OpenAI, Mistral, Qwen, DeepSeek and local servers. Model discovery asks each provider for its models, keeps only chat models, caches the list for a day and puts it after the recommended models. Every request is routed by the connection, not by the model name, so identical model names on two providers never collide.

6. **Connection.** One record: provider, model, one key per provider, local server address, local model name. It offers `get`, `save`, `clear`, `isVerified` and `verify` (a model-list request; success makes the connection verified). Keys never go anywhere except their provider.

7. **Knowledge.** Splits the Knowledge Base — the same source that grounds the hosted engine — into question-and-answer sections, loaded lazily on first use, and ranks sections against a query. It is exposed as `search_help({query})`, returning the best few sections with their headings. The instructions tell the model: `search_help` for "how do I…" questions, map tools for questions about this map.

8. **Instructions.** A hand-written part (role, rules, map pitfalls, note format) and a part generated from the codebase at build time (global declarations, core data types, generator and registry names, the configuration and data-model docs). A test fails when the generated part is stale.

9. **Map tools (controller layer).**
   - `read_map({code})` runs a script against the open map and returns its value and console output, trimmed to a size limit. A `describe()` helper for looking at unfamiliar data is available inside the script.
     - It is read-only by instruction, and the world state is snapshotted before each run as a recovery point.
     - Asking the browser to save a file is allowed and doesn't count as a change.
   - `write_note({id?, html})` replaces an entity's note, defaulting to the note open in the notes editor. It accepts only the notes editor's HTML subset, with no event-handler attributes and no `javascript:` URLs, because notes are later rendered into tooltips as HTML. It returns a Change.
   - **Change contract:** every mutating tool returns a Change with the map id, the entity key, a label ("Updated note “Gondesthe”"), a size or summary, and the prior state. Undo refuses, with a message, when the open map is not the Change's map. Future tools (renaming, recolouring, moving burgs…) implement the same contract and need no new UI.
   - The per-question context — the open note's key, HTML and selection — is recomputed after every Change, so later steps in the same question never see stale HTML.

10. **Conversations.** A conversation holds:
    - an id, a title (from its first question) and the last-used time
    - its engine kind (hosted or own-key) and the map id it was about
    - its transcript items
    - its engine memory: the service's conversation id for hosted chats, the message history for own-key chats
    - its token usage

    `canContinue(conversation, tier, mapId)` decides between continuing and read-only. The store keeps the newest conversations within a size budget and drops the oldest first. **Long chat:** an own-key conversation whose last request's history (excluding the cached instructions) passes a threshold is flagged, and the controller shows the long-chat notice.

11. **Assistant controller.** Owns the dialog and its three in-panel views — transcript, key sheet, chat list — plus the composer, context chip, notice area and footer.
    - Opening from any entry point takes no arguments; the notes editor's presence alone changes the welcome message, suggestions and context chip.
    - Tier changes (connect, disconnect, sign in, sign out) start a new conversation with a divider naming the new tier.
    - While a question is running, _Chats_, _New chat_ and tier actions are disabled.

### Other decisions

- **Storage.** Conversations, the connection and the chat list live in this browser only. Hosted conversations store their transcript locally for display; only the service's conversation id is ever sent back.
- **Unavailable tier.** The transcript shows one welcome message explaining that the free tier is official-site-only, with _Connect your AI key_. The composer is hidden until a key is connected.
- **Map questions in free tiers.** The hosted engine can't see the map. The documentation service's own instructions should reply to map-specific questions with a short explanation, and the client shows _Connect your AI key_ under that reply.

## Testing Decisions

- Tests check behaviour through public interfaces: given inputs and a mocked network, assert the transcript items and the visible output — never internal state or call order.
- **Tier:** a table test over every combination of inputs.
- **Engine contract:** one shared suite run against both engines with mocked transport. It checks the item sequence for a plain question, that abort leaves history consistent, and that token usage or limits are reported.
- **Hosted engine:** limit notices carry the right actions per tier; rate limits give a countdown and exactly one auto-retry; an expired sign-in falls back to Free; a new server memory emits a divider.
- **Own-key engine:** tool dispatch, unknown-tool errors, the step limit, shortening of old tool results, and the split between the cached and per-question instructions.
- **Providers:** round-tripping the internal format through the OpenAI-compatible adapter; routing by connection.
- **Connection:** save and clear, one key per provider, local defaults, verify success and failure.
- **Knowledge:** sectioning, and ranking of known questions ("no autosave", "undo button", "export heightmap") to their sections.
- **Map tools:** note HTML validation, including rejecting event attributes; Change creation; Undo refusing on another map; editor refresh after a write.
- **Conversations:** titles, ordering, the size budget, `canContinue` across engine kind and map id, and the long-chat flag.
- **Assistant controller:** DOM tests showing that every transcript item type renders, that user text is never rendered as HTML, that controls lock while answering, and that views switch.
- **Prior art:** the existing tests of the documentation service client, the agent session and its tools, provider adapters, notes editor, and the browser DOM tests for dialogs.
- No new Playwright tests. A manual pass on the official site, a self-hosted origin and the desktop app covers each tier.

## Out of Scope

- Changes to the documentation service itself: limits, prompts, models. The daily numbers belong to the server; the client only displays them. The one server-side follow-up is the instruction about map questions noted above.
- Map tools beyond `read_map` and `write_note`. The Change contract is defined here; each further tool gets its own PRD.
- Running `read_map` scripts in a sandbox (a worker or iframe over a copy of the map).
- Streaming token-by-token answers.
- Summarising a long chat into a new one. The long-chat notice starts an empty chat.
- Syncing conversations or connections across devices.
- Hosted or paid keys. The Assistant never proxies or bills a user's key.

## Further Notes

- **Why "Azgaar Assistant".** It is already the dialog title, the Options setting and the name used across the wiki. "Bot" suggests the Discord bot, and "Agent" describes an implementation detail of one tier.
- **Security.** In the own-key tier the model runs JavaScript in the page, and text written by other people — notes and names in shared `.map` files — reaches the model. Stored keys can be read from the page. Sanitising note HTML closes the persistent vector; the sandbox (out of scope) closes the rest. The key sheet's privacy line must stay accurate as this evolves.
- **Local models.** The fixed instructions are around 20k tokens. The key sheet and the Ollama wiki page must state the context window local servers need (Ollama's `num_ctx`).
- **Recommended models** are the first thing an own-key user sees and should be reviewed each release.
- **Docs to update:**
  - The architecture doc's Assistant section: one controller, services with no world state, map tools in the controller layer.
  - The glossary terms above.
  - The wiki's Assistant, Ollama, Omnibar, User Interface, Quick Start and Policy pages. Policy must describe the new local storage of hosted transcripts.
  - The Knowledge Base entries about the Assistant.
- **Migration.** Keys and the chosen model stored by earlier versions are read into the Connection on first run, so existing users stay connected.
