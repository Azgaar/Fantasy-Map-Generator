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
| **Key**    | Connects an AI provider key or a local model      | Answers about the generator **and** about the open map, and proposes changes that the user applies and can undo, with no daily limit |
| _No tier_  | Self-hosted copy or desktop app, no key connected | Explains that a key is needed here and offers to connect one                                                              |

The tier is always visible in the panel's footer, next to what is left of it. There are no modes or tabs, and no choice of "where" to ask. Who answers is an internal detail chosen by the tier: the Azgaar server for Guest and Member, the user's Provider for Key. Every free-tier surface — the welcome message, the limit notices, the reply to a map question — invites the user to connect their own key, and says what that unlocks.

Chats are first-class. Every chat is kept in the browser, belongs to one map, can be reopened from a chat list, and can be replaced by a new chat at any time. When a chat grows long enough to slow answers and raise costs, the Assistant suggests starting a new one.

### The panel

A non-modal, resizable dialog titled **Azgaar Assistant**, docked at the bottom right, above its call bubble. From top to bottom:

- **Title bar:** _Chats_ (the chat list, which also holds _New chat_), minimise, close.
- **Transcript:** Assistant messages on the left, the user's on the right. Map reads show as collapsed step rows, proposed changes as cards with Apply, Discard and, once applied, Undo, and widgets inline (see "Widgets").
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
│  ┌ Proposed change ──────────────────────────┐       │
│  │ Note “Gondesthe” · rewrite · 1.2k chars   │       │
│  │                         [Discard] [Apply] │       │
│  └───────────────────────────────────────────┘       │
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
│  I run scripts in this page to read your map.      │
│    Only use me on maps from sources you trust.       │
│                                                      │
│  Provider  [ OpenAI               ▾]                 │
│  Model     [ gpt-6-luna           ▾]                 │
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
  - Local shows a server address (default Ollama) and a model name, and notes that the server's context window must be at least 8k tokens.
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

### Proposals: Preview → Apply → Undo

The Assistant never changes the map by itself. It **proposes**, and the user decides:

- A **proposal** is one batch of **operations** the model asks for in one `propose_change` call: one note rewrite, or thirty renames. It appears as one card, however many operations it holds.
- The card previews every change as rows of entity, field, and before → after. That includes the side effects the operations make, such as a burg's label text or a state's full name. Notes show as rendered text. Long batches show the first rows and "… N more".
- **Apply** runs the whole batch, or nothing if any part of it is no longer possible. **Discard** drops it. There is no per-row selection: to change the batch, the user asks the Assistant to revise it.
- After Apply, the card offers **Undo**, which restores the whole batch.

```
┌ Proposed · Rename coastal burgs ─────────────────┐
│ Burg Vel       name   Vel → Saltmere             │
│                label  Vel → Saltmere             │
│ Burg Orn       name   Orn → Gullhaven            │
│                label  Orn → Gullhaven            │
│ … 24 more                                        │
│                              [Discard]  [Apply]  │
└──────────────────────────────────────────────────┘

┌ Applied · Rename coastal burgs ──────────────────┐
│                                        [↶ Undo]  │
└──────────────────────────────────────────────────┘
```

A card is **Proposed**, **Applied**, **Undone** or **Discarded**. Undone and Discarded are final: to redo, the user asks again.

- Apply is allowed only while the map id matches and every "before" value still holds.
- Undo is allowed only while every "after" value still holds.
- Otherwise the button reads **Changed since** and is disabled. This protects the user's own later edits, another saved version of the map, and other proposals that touched the same data.
- Apply and Undo need no model, so they work in any tier and in read-only chats.

The model learns what happened. The `propose_change` result says the proposal is waiting for the user, so the model never claims a change was made. The next question's map context lists the outcome of the chat's earlier proposals ("#3 applied, #4 discarded"). The map context itself always describes the applied map, never pending proposals.

### Widgets

An answer is more than text. **Widgets** tie it to the map: they point at entities, open the right editor, and show data and places the way the app itself would. They come in two forms:

- **Links**, written inline in an answer's Markdown. They need no tool, so every answerer can write them.
- **Widget items**, placed in the transcript by a `show_*` tool, one per widget. They need the open map, so only the Key tier has them.

Every widget stores references, never copies: it reads the map when drawn. The one exception is a chart, which holds the numbers the model computed, as a snapshot. An inset's picture is drawn when first shown and kept in memory for the session, never in the chat. A reference to a removed entity, or to a chat's map that is not the open one, renders as plain text or as a "not on this map" row, never as a link to the wrong thing.

| Widget | Form | What the user sees | Clicking it |
| --- | --- | --- | --- |
| **Entity link** | `[Ashvale](burg:12)` | the entity type's icon and the name as a link, as in the command palette | zooms to the entity, shows its layers and outlines it, as the command palette does; an entity with no place on the map (a good) opens its editor |
| **Command link** | `[Heightmap editor](command:editHeightmapButton)` | a small button | runs the command. Only commands that open a dialog, tab or chart qualify; never one that generates, regenerates, loads or resets |
| **Entities** | `show_entities` | a titled list of entity links with each one's context (capital, state…) | _Show on map_ zooms to fit them all and rings each one until pressed again |
| **Entity card** | `show_card` | a state first: emblem, full name and form, capital, population, area, burgs, culture, the capital's religion, the start of its note | _Locate_ reveals the state; _Edit_ opens the States Editor |
| **Chart** | `show_chart` | horizontal bars scaled to the largest value with their values, or a pie whose legend shows each share, the amount behind it on hover, and a caption naming the total ("Share of 9.1M people"); a row may name an entity | a row's entity link |
| **Choices** | `show_choices` | two to four options, e.g. name candidates | a choice with operations becomes a normal proposal; one without is sent as the next question. Once one is picked, the rest are disabled |
| **Inset** | `show_inset` | a picture of the map around an entity or a box, as it is styled and layered now, with the entity ringed | zooms the main map to that region |
| **Source** | `show_source` | the wiki page an answer came from | opens it in a new tab |

The model can also **look at an emblem**: `view_emblem(key)` returns the rendered emblem as a small image, and the same emblem appears in the chat so the user sees what the model saw. A model without vision gets a text reply saying the image is unavailable.

```
┌ Entities · Landlocked states ──────── [Show on map] ┐
│ 👑 Orwin           Capital: Vel                     │
│ 👑 Kahores         Capital: Ornhall                 │
│ 👑 Batshinuria     Capital: Tesh                    │
└─────────────────────────────────────────────────────┘
```

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
27. As a map maker, I want my chats kept until I delete them, never removed automatically, so that old chats and their proposals stay available.

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
53. As a Key-tier user, I want every change the Assistant wants to make shown first as a card listing each change, before → after, with nothing changed until I press Apply, so that I stay in control of my map.
54. As a Key-tier user, I want a request that changes many things ("rename all coastal burgs") to arrive as one card that I apply in one click, so that bulk edits are quick to review and to take back.
55. As a Key-tier user, I want the card to show the side effects too (labels, full names, codes), so that I know everything Apply will touch.
56. As a Key-tier user, I want to discard a proposal, and the Assistant to know whether I applied or discarded it, so that its follow-up answers make sense.
57. As a map maker, I want an applied proposal to have an Undo that restores the whole batch, so that nothing the Assistant does is irreversible.
58. As a map maker, I want Apply and Undo offered only while the map still holds exactly what they expect — in any tier and even in a read-only chat — so that they never overwrite my own later edits or another version of the map.
59. As a Key-tier user, I want open editors and map layers to refresh after Apply and Undo, so that I see the result immediately.
60. As a Key-tier user, I want the Assistant to refuse changes it has no operation for and say so, so that I'm never promised a change it cannot make.
61. As a map maker, I want a rename or note made through the Assistant to follow exactly the same rules as the same edit made in an editor, so that the result never depends on who made it.

### Widgets

62. As a map maker, I want every burg, state or other entity named in an answer to be a link that shows it on the map, so that I can find what the Assistant is talking about.
63. As a map maker, I want an answer to "how do I…" to include a button that opens the right editor, so that I don't hunt through menus.
64. As a map maker, I want a command button in an answer never to generate, regenerate, load or reset anything, so that one click on a model-written button cannot cost me my map.
65. As a Key-tier user, I want a list of entities with a _Show on map_ toggle that rings them all, so that I see where a set of results lies.
66. As a Key-tier user, I want a state card with its emblem and key figures, so that "tell me about Orwin" reads like a profile.
67. As a Key-tier user, I want statistics answered with a chart when it reads better than a table, so that comparisons are clear at a glance.
68. As a Key-tier user, I want name suggestions offered as choices that I pick from, so that the chosen one arrives as a proposal I can apply and undo.
69. As a Key-tier user, I want an inset of the region an answer is about, which zooms the map there when clicked, so that I see the place without losing my view.
70. As a Key-tier user, I want the Assistant to be able to see an emblem, so that it can describe it or write heraldic lore that matches.
71. As a map maker, I want widgets in an old chat to keep working while their map is open and to turn inert otherwise, so that a link never points at the wrong entity.

### Self-hosted and desktop

72. As a self-hosted or desktop user, I want to be told that the free tiers only run on the official site and be offered my own key, so that the Assistant still works for me.
73. As a desktop user, I want the Assistant bubble and its Options setting in the desktop app, with my own key or local model behaving exactly as on the web, so that I'm not a second-class user.

## Implementation Decisions

### Name and vocabulary

- **Azgaar Assistant** is the product name: dialog title, call-bubble tooltip, the Options setting, the command palette entry ("Open Azgaar Assistant"), wiki and Knowledge Base. The short form is **the Assistant**. "Bot", "Agent", "AI Chat", "Help mode" and "This map" are not used in the UI, docs or identifiers.
- Domain terms (defined in the glossary): **Tier** (Guest, Member, Key), **Chat**, **Map id**, **Proposal**, **Operation**, **Change**, **Widget**, **Azgaar server**, **Provider**.
  - **Operation** — a named, well-scoped edit that a model class owns as a public method, such as `Burgs.rename`, and that is registered for the Assistant.
  - **Proposal** — a batch of operations the model asks for, shown as one card and applied, undone or discarded as a whole.
  - **Change** — the recorded before and after values of everything a proposal touches, which Apply and Undo write.
  - **Widget** — an interactive part of an answer tied to the map: a link written in its Markdown, or a transcript item placed by a `show_*` tool.
- Supporting terms used below:
  - **Answerer** — whoever answers a chat: the Azgaar server or the Provider.
  - **Transcript item** — one visible entry in a chat.
  - **Map tool** — a capability the Provider can call on the open map: `read_map`, `propose_change`, a `show_*` tool or `view_emblem`.
  - **Operations registry** — the map from operation names to model-class methods.
  - **Connection** — the user's provider, model and key settings.
- **Code names follow the vocabulary.** The feature is `Assistant`: one controller and one service family under `services/assistant/`. The Azgaar server client lives in `services/assistant/azgaar-server/` and throws `AzgaarServerError`. A chat is a `Chat` in a `chats` store. The Azgaar server's wire field `conversationId` is the only place "conversation" remains, because it is the server's contract.

### Architecture

The Assistant follows the project's layering. Services know nothing about `pack`, `grid`, `options.map` or the DOM. Everything that reads or changes the map lives in the controller layer and is handed to the Provider answerer when a question is sent: the map tools, the operations registry, proposals and the per-question map context. The edits themselves belong to the model classes, which both the editors and the Assistant call.

```
Assistant controller (dialog, transcript view, key sheet, chat list, footer)
   │  resolves the tier, picks the answerer, renders transcript items
   ├── Map tools (controller layer): read_map, propose_change, show, view_emblem
   ├── Widgets (controller layer): link resolver, widget rendering, reveal on the map
   ├── Proposals (controller layer): dry run → Change → Apply / Undo / Discard, redraw
   ├── Operations registry (controller layer): name → model-class method, what it touches, layers to redraw
   │        │
   │        ▼
   │   Model classes: Burgs, States, Provinces, Cultures, Religions, Rivers, Markers (generators) and Notes
   │        own every operation as a public method; the entity editors call the same methods
   ├── Map context (controller layer): map summary, units, open note and selection, proposal outcomes
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
   ├── Knowledge       Knowledge Base search via read_help; reference docs via read_docs
   └── Instructions    hand-written rules + reference generated from the codebase
```

### Modules

1. **Tier (pure).** Inputs: whether the Azgaar server serves this origin, whether a sign-in token exists, whether a key is connected. Output: the tier, or none. Precedence: key > member > guest; none when the Azgaar server is unavailable and no key is connected. A user who connected a key has chosen unlimited use, so their key answers everything and the free allowance is never spent silently.

2. **Answerer contract.** `send(chat, question, onItem, signal)`: the answerer appends to the chat and reports every new transcript item as it arrives. `status()` returns the footer text for its tier. Transcript items form one closed union:
   - `question`
   - `answer` — Markdown, optional rating id
   - `step` — a map read, with its result and duration
   - `proposal` — a proposal card: its operations, its Change and its state (proposed, applied, undone, discarded)
   - `notice` — a limit, error or countdown, optionally with actions
   - `divider` — the Azgaar server started a new memory
   - `widget` — one widget placed by a `show_*` tool: its type and the references it draws from

   The controller renders items and never checks which answerer produced them.

3. **Azgaar server answerer.** Talks to the Azgaar server: ask, daily limits, answer ratings, Discord sign-in and sign-out.
   - The Azgaar server keeps chat memory on its side. The client stores the server's chat id with the chat and never sends transcript content back.
   - When the server starts a new memory because the old one expired, the answerer emits a `divider`.
   - The server's limit texts are shown as they come. On an exhausted allowance the answerer adds its own actions below them: _Sign in_ for a Guest, and _Connect your AI key_ always.
   - Map-specific questions are answered by the server itself, whose instructions recommend the user's own key via _Use key_. The client does no detection.

4. **Provider answerer.** A loop: send the instructions, history and tool definitions to the provider; run the tools it asks for; feed the results back; repeat until it answers or a step limit is reached.
   - Its tools are `read_help` and `read_docs` (Knowledge) plus the map tools passed in by the controller.
   - Tool results of earlier questions, and all but the latest few of the current one, are shortened in the stored history to hold down cost.
   - Token usage is added to the chat after every request.
   - A turn in which the model said nothing is not kept, and none is ever sent: every provider rejects an empty turn in the history, which would break the chat for good.
   - The fixed instructions are marked cacheable. The per-question map context comes from the controller and is sent separately, so it never invalidates the cache.
   - **A failing key changes nothing.** When the provider rejects a request (revoked key, no credit, outage, local server down), its message appears as a notice with _Retry_ and _Key_ buttons. _Retry_ asks the failed question again; when it failed before any step, the question and its error leave the transcript so the retry reads as one question. The key stays connected and the tier stays Key. There is no automatic disconnect and no fallback to the Azgaar server.

5. **Providers.** One internal message format (text, tool calls, tool results) with two adapters: Anthropic's native Messages API, and one OpenAI-compatible adapter for OpenAI, Mistral, Qwen, DeepSeek and local servers. Model discovery asks the provider for its models, keeps only chat models and caches the list for a day; it is the only source of the model list, besides one default model per provider and any typed id. Every request is routed by the connection, not by the model name, so identical model names on two providers never collide.

6. **Connection.** One record: provider, model, one key per provider, local server address, local model name. It offers `get`, `save`, `clear` and `isConnected`. "Connected" means the user set a key and has not disconnected it; validity is never tracked, and discovery is the only key check. Keys are stored per provider in `localStorage`, shared with the AI text generator, and never go anywhere except their provider.

7. **Knowledge.** Nothing bulky rides in the instructions; the model fetches it. `read_help({query})` searches the Knowledge Base, the same source that grounds the Azgaar server, split on its question headings: it returns the best few sections in full plus the headings of other matches, and an exact heading returns that section. `read_docs({topics})` returns data-model sections, the configuration doc, the global declarations, the registries, the core data types or the commands a command link may name. Both load their sources lazily on first use.

8. **Instructions.** Kept under about 3k tokens. A hand-written part (role, rules, units, map pitfalls, note format, link syntax, and which widget answers which kind of question) and a part generated from the codebase at build time (generator names, the registered operations with their signatures, the field names of each data-model section, and the linkable commands served by `read_docs`). A test fails when the generated part is stale or the instructions outgrow their budget.

9. **Map tools (controller layer).** `read_map`, `propose_change`, one `show_*` tool per widget and `view_emblem`, plus the Knowledge tools. Each declares the status the typing indicator shows while it runs:
   - `read_map({code})` runs a script against the open map and returns its value and console output, trimmed to a size limit.
     - Inside the script are a `describe()` helper for inspecting unfamiliar data and a `units` object with the app's own formatters (`si`, `getArea`, `getHeight`, `convertTemperature`…), so answers use the map's units exactly as the UI shows them.
     - It is read-only by instruction; scripts must never write map data. Asking the browser to save a file (CSV, JSON) is allowed and is not a change.
   - `propose_change({summary, operations: [{op, args}]})` proposes one batch of registered operations. `op` is an operation name such as `Burgs.rename`; `args` are that method's arguments in order, as in its declared signature.
     - The tool never changes the map. It returns either "Proposal #N is waiting for the user" or the first error: an unknown operation (with the list of registered ones), or a method's own validation error. The model can correct the batch and try again.
   - Each `show_*` tool places one widget item and never changes the map. It returns the first problem instead, so the model can fix it. One tool per widget, not one tool with a `widget` switch: a focused schema with its own required fields, and a description that says when to use it, are what get a widget chosen at all.
     - `show_entities {title, entities}` — 1 to 50 live entity keys.
     - `show_card {entity}` — a live state key.
     - `show_chart {chart: bar | pie, title, unit?, rows: [{label, value, entity?}]}` — 1 to 30 rows of non-negative numbers; an entity key must be live.
     - `show_inset {entity | box, title?}` — a live entity with a place on the map, or a box `[x0, y0, x1, y1]` in map units that overlaps the map.
     - `show_choices {title, choices: [{label, operations?}]}` — 2 to 4 choices. Each choice's operations are dry-run like `propose_change`, and the first failing choice is named. The result tells the model to stop and wait for the pick.
   - `view_emblem({entity})` returns the emblem of a state, province or burg as a 256 px PNG for models with vision, and places the same emblem in the transcript as an `emblem` widget. The picture is drawn by the same code as the Emblems Editor's download.
   - **Images in the provider format.** A tool result may hold text and image blocks. Anthropic takes them natively; the OpenAI-compatible adapter sends a tool's images as one user message after its text result. When a request carrying images fails, the images are replaced by a note that the model cannot see them and the request is sent once more, so a model without vision still answers. Images are shortened out of earlier questions like any tool result and do not count towards a long chat.
   - There are no per-type write tools. Every capability is an operation, so the model learns one write tool and one list of operations.

10. **Model-class operations (the edits live with the data).** Every operation is a public method of the model class that owns the data, so there is exactly one implementation of each edit:
    - **Signatures:** `Burgs.rename(burgId, name)`, `States.rename(stateId, name)`, `Provinces.rename`, `Cultures.rename`, `Religions.rename`, `Rivers.rename`, `Markers.rename` and `Notes.write(key, html)`.
    - **One implementation, used everywhere.** The entity editors call these methods instead of assigning fields inline, so an edit gives the same result whether a user or the Assistant made it. Today each editor keeps its own copy of these rules; this removes the copies.
    - **Each method owns its invariants and dependent data**, so a rename never breaks the map:
      - a burg's label text follows its name;
      - a state keeps a custom full name ("United Realms of Old") when the old name stands in it as a whole word, and otherwise rebuilds it;
      - a province keeps its full-name pattern;
      - a culture or religion recomputes its code.
    - **Each method validates its own arguments** (entity exists and is not removed, name not empty) and throws a readable message. It only changes data: model classes cannot reach renderers, so redrawing is not their job.
    - **Notes own the safe-HTML rule.** Notes render into tooltips as HTML, so `Notes.write` accepts only the notes editor's subset: no event-handler attributes, no `javascript:` URLs, no scripts or iframes. The notes editor keeps its own path for its rich-text output.

11. **Operations registry (controller layer).** A plain map from operation name to a model-class method. It holds no logic of its own:
    ```ts
    "Burgs.rename":  { run: (id, name) => Burgs.rename(id, name),  touches: ["burg"],   redraw: ["labels"] },
    "States.rename": { run: (id, name) => States.rename(id, name), touches: ["state"],  redraw: ["labels"] },
    "Notes.write":   { run: (key, html) => Notes.write(key, html), touches: ["entity"], redraw: [] },
    ```
    - `touches` lists the data the operation may change: entity types (every burg, every state…), or `entity` for the entity its first argument names. This is what a proposal snapshots.
    - `redraw` lists the layers to redraw after Apply or Undo, since model classes cannot do it themselves.
    - **Adding a capability** means adding one public method to the model class that owns the data, plus one registry line. It needs no new tool, UI or PRD.
    - The generated instructions list every registered operation with its signature, and a test fails when the list is stale.
    - FMG has hundreds of possible edits, and the registry grows one well-scoped operation at a time. Arbitrary writes are never allowed.

12. **Proposals (controller layer).** One mechanism for every operation:
    - **Dry run.** Snapshot what the batch's operations touch, run the operations in order, compare with the snapshot, then restore it. The comparison is the proposal's **Change**: every changed path with its before and after values, including the side effects the methods made. If any operation throws, the snapshot is restored and the whole proposal fails with that message, so a batch is all or nothing. The map is never left changed by a proposal.
    - **Card rows** come from the Change. Paths are labelled through the entity lookup ("Burg Vel · name"), and notes are rendered as a preview.
    - **Apply** checks that the map id matches and every "before" value still holds, writes the "after" values, redraws the registry's layers for the batch and refreshes open editors.
    - **Undo** checks that every "after" value still holds, then writes the "before" values and redraws.
    - A failed check shows **Changed since**. The map id is only a cheap first filter.
    - **Map context after Apply.** The map context (summary, open note, selection) is recomputed after every Apply, so later steps never see stale content. Pending proposals are not part of it.
    - **Proposal outcomes.** The next question's map context lists what happened to the chat's earlier proposals.

13. **Chats.** A chat holds:
    - an id, a title (its first question) and the last-used time
    - its answerer (`azgaar-server` or `provider`), and the map id and map name of the map open when it was created
    - its transcript items, including each proposal with its Change and state, so Apply and Undo still work after a reload
    - its answerer memory: the Azgaar server's chat id, or the message history for Provider chats
    - its token usage

    `canContinue(chat, tier, mapId)` is true when the chat's answerer is the current tier's answerer and its map id is the open map's. All chats are kept in IndexedDB under one key through the app's existing key-value store, with no size budget and no automatic deletion; the store loads once when the panel first opens. A Key-tier chat is **long** when its message history exceeds 100,000 characters — a string length, independent of providers and their usage reports.

14. **Widgets (controller layer).**
    - **Links.** The Markdown renderer stays generic: it takes a link resolver, and only `http(s)` links render without one. The Assistant's resolver turns an entity key into an entity link and `command:<id>` into a command button, and returns nothing for anything else, which then stays plain text. Links resolve only while the chat's map is open.
    - **Every data type links.** Keys cover the entities the command palette searches and notes attach to (states, provinces, burgs, markers, rivers, routes, features, zones, journeys, markets, regiments, labels, cultures, religions, biomes, goods) and the map's other **records**: cells, ice, relief icons, measurers, deals, transports and name bases. Records resolve like entities but stay out of search and cannot hold notes. A record with a place on the map is revealed there; one without (a transport, a name base) opens its editor.
    - **Keys without an id.** Models sometimes know an entity's type and name but not its id (`[Midhill](feature:?)`). Such a link still resolves when exactly one live entity of that type bears the label; otherwise the label stays plain text. The instructions ask the model to link only ids it has read.
    - **Command allowlist.** A command qualifies when its name starts with _Open_, _Show_ or _Edit_ and it is not the Assistant itself. The same rule builds the `read_docs` list, so the model is never shown a command it cannot link.
    - **Reveal.** Entity links and the command palette share one reveal: show the entity's layers, zoom to fit its geometry, outline it. An entity with no place on the map (a good) opens its editor instead. From the Assistant, the view is fitted and centred in the part of the map beside the panel, not under it.
    - **Inset pictures.** The map draws only what is on screen, so a live copy of it would miss anything outside the view. An inset is rendered through the export pipeline instead: a region option crops the map clone, renders the viewport layers for that box and rasterizes it to a small PNG. Around an entity the box is padded, widened to the picture's proportions and kept inside the map. The picture shows the layers that are on, so the entity is ringed on top of it.
    - **Show on map.** One widget at a time rings its entities in the debug layer. The rings go when the toggle is pressed again, another widget's is pressed, the chat changes or the panel closes.

15. **Assistant controller.** Owns the dialog and its three in-panel views — transcript, key sheet, chat list — plus the composer, context chip, notice area and footer.
    - Opening from any entry point takes no arguments; the notes editor's presence alone changes the welcome message and context chip.
    - It starts a new chat on the events in "When a new chat starts". Map changes are detected through the app's `map:generated` event, which fires on generate, load, Submap and Transform.
    - While an answer runs, _Chats_, _New chat_ and tier actions are disabled. The map itself is never locked: the `customization` edit-mode flag is not used, because it blocks every editor yet is reset by loading a map.

### Other decisions

- **Proposals, not direct writes.** The model proposes and the user applies. This replaces the earlier direct write followed by Undo, for three reasons:
  - The user sees every change before it happens.
  - A bulk edit is one reviewable card instead of many.
  - Text from other people's `.map` files can no longer change the map through the tools without a click.
  The cost is one click per proposal, including for quick note iterations. An auto-apply setting is deferred until users ask for it.
- **Registered operations, not arbitrary writes.** Bad data is a real problem in FMG: many fields depend on each other (full names, labels, codes, cell ownership), and a raw field write breaks them silently. Two alternatives were considered and rejected:
  - A universal, data-model-based write that could set any field. It reaches everything but guarantees nothing.
  - Capturing whatever a model-written script changed. It reaches everything, but a script can still leave inconsistent data.
  Operations are finite and each is owned by the model class that knows its invariants. Registering them one by one is slower to grow but never corrupts the map. It also removes duplication, because the editors and the Assistant share one implementation.
- **Scripts run in the page — an accepted, disclosed risk.** In the Key tier, model-written JavaScript in `read_map` runs with the app's full access, including stored API keys. Text written by other people (notes and names in shared `.map` files) reaches the model, so prompt injection is possible.
  - Proposals gate every change the tools make. A script could still write data or read keys despite the read-only instruction.
  - The alternatives were a "confirm each script" option (little protection, rarely enabled) and a worker sandbox over a copy of the map (the real fix, but significant work).
  - Following simplicity first, the risk is disclosed instead: the key sheet carries a warning line, and the Policy wiki page has Risks and Disclaimer sections. The safe-HTML rule in `Notes.write` closes the one persistent vector.
  - The sandbox is the planned fix if users report a real problem.
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
- **Knowledge:** `read_help` ranking sections for a query, returning an exact heading alone and reporting no match; `read_docs` resolving topics and listing the available ones for an unknown topic.
- **Model-class operations** are tested in each model class's own suite:
  - each rename keeps its dependent data (burg label, custom and generated state full names, province pattern, culture and religion code);
  - a missing or removed entity and an empty name throw readable errors;
  - `Notes.write` rejects event attributes, `javascript:` URLs and scripts.
  - An editor test confirms the editor calls the shared method.
- **Operations registry:** every entry points at an existing public method, and the generated operations list in the instructions is not stale.
- **Proposals:**
  - a dry run leaves the map byte-for-byte unchanged;
  - the Change includes side effects;
  - a failing operation fails the whole batch and changes nothing;
  - an unknown operation returns the registered list;
  - Apply writes the batch and redraws the listed layers;
  - Apply and Undo are refused with "Changed since" after a manual edit, on another map, or after an overlapping proposal was applied;
  - Discard is final;
  - Apply and Undo work in a read-only chat;
  - proposal outcomes reach the next question's map context.
- **Chats:** titles, ordering, IndexedDB persistence, `canContinue` across answerer and map id, and the long-chat threshold.
- **Widgets:** an entity key and an allowed command render as links, entity links with their type's icon; a key without an id links by a unique name match; a removed entity, an unknown or disallowed command and any link in a chat of another map stay plain text; model text inside a link is escaped; a `show_*` tool rejects an invalid key and names it; the `read_docs` command list matches the allowlist.
- **Assistant controller:** DOM tests that every transcript item type renders, user text is never rendered as HTML, controls lock while answering, views switch, and `map:generated` cancels a running answer and starts a new chat.
- **Prior art:** the tests of the Azgaar server client, the provider tool loop and its tools, the provider adapters, the notes editor, and the browser DOM tests for dialogs.
- No new Playwright tests. A manual pass on the official site, a self-hosted origin and the desktop app covers each tier.

## Out of Scope

- Changes to the Azgaar server itself: limits, prompts, models. The daily numbers belong to the server; the client only displays them. The server-side follow-ups are the instruction to answer map questions with a key recommendation, and teaching the server's model the command link syntax.
- Operations beyond the first set: renames for the seven entity types and `Notes.write`. Each further operation is one model-class method plus one registry line, and needs no new tool, UI or PRD. Recolouring, burg population and marker icons are the natural next ones.
- Operations that create or delete entities, or change geometry (cell ownership, heightmap, moving burgs). They need model-class methods that keep their invariants first.
- Arbitrary writes to any field, and capturing changes made by scripts.
- Selecting individual rows inside a proposal, and auto-apply.
- A sandbox for `read_map` scripts — added only if users actually hit the problem.
- Streaming token-by-token answers.
- Widgets beyond the catalog in "Widgets", outlining an entity on link hover, and letting the model see an inset as an image.
- Summarising a long chat into a new one. The long-chat notice starts an empty chat.
- Syncing chats or connections across devices.
- Hosted or paid keys. The Assistant never proxies or bills a user's key.

## Further Notes

- **Simplicity first.** Every decision here takes the simplest option that works; complexity is added only in response to problems users actually report.
- **Widget delivery order.** Entity links, command links and the entities list first; then the state card, charts and choices; then the inset and `view_emblem`; the source card last.
- **Why "Azgaar Assistant".** It is the dialog title, the Options setting and the name used across the wiki. "Bot" suggests the Discord bot, and "Agent" describes an implementation detail of one tier.
- **Local models.** The fixed instructions are under 3k tokens, so an 8k context window is enough. Ollama's OpenAI-compatible endpoint cannot set `num_ctx` per request, so the key sheet and the Ollama wiki page tell the user to set it on the server.
- **Default models** per provider are the first thing a Key-tier user sees and are reviewed each release.
- **Docs that describe the Assistant:** the architecture doc's Assistant section, the glossary, the wiki's Assistant, Ollama, Omnibar, User Interface, Quick Start and Policy pages, and the Knowledge Base entries about the Assistant.
  - The glossary gains **Proposal** and **Operation**, and redefines **Change** as a proposal's recorded before and after values.
  - The architecture doc's model section states that model classes own their edits as public methods, used by both the editors and the Assistant.
