This page describes what data the _Fantasy Map Generator_ (FMG) handles, where it goes, and how long it is kept. It covers the tool as published at [azgaar.github.io/Fantasy-Map-Generator](https://azgaar.github.io/Fantasy-Map-Generator/); a self-hosted or offline copy has no server side at all beyond what you connect yourself.

FMG is a hobby project, not a company. There is no account system, no user profile and nothing is sold to anyone.

## Your maps stay in your browser

Map generation and editing run entirely in the browser. A generated world is never uploaded anywhere.

* **Autosave** writes the current map into your browser's own storage (IndexedDB) so it can be restored when you come back. Clearing the site data removes it. You can turn autosave off in _Options → Interface settings_.
* **Save** and **Load** work with files on your own machine.
* **Settings** (theme, units, locked options, "don't ask again" flags) are stored in this browser's `localStorage`.
* Nothing in this group is readable by the project.

## Optional services you connect yourself

These are off by default. Using one means sending data to that third party under their own terms.

* **Dropbox** — only if you sign in from _Save/Load → Cloud_, and only the map files you choose to store there.
* **AI text generation** (_Tools → AI generator_) — your prompt goes directly from your browser to the provider you pick (OpenAI, Anthropic, or a local Ollama instance). The API key you enter is kept in this browser's `localStorage` and is sent only to that provider. The project never sees the prompt or the key.

## Azgaar Assistant

The Assistant uses the Azgaar server for Guest and Member documentation questions. With your own AI key or local model, it answers questions about the Generator and the open map, and can edit the map through a small set of tools. Everything below up to _With your own AI key_ describes Guest and Member use.

**What is sent.** The question you type and a conversation id. Nothing from your map, your files or your browser is sent — without a key the Assistant cannot see the world you are working on.

**How long questions are kept.** Questions and the answers given to them are retained for **90 days**, then deleted. They are read only to fix wrong answers and to find gaps in the wiki. They are not published, shared or used to identify anyone.

**Chat memory.** The Azgaar server remembers a free chat so follow-up questions make sense. The client stores its server-issued chat id with that chat, and sends only the id on later questions. If server memory expires, the panel marks the boundary. Chats and their visible transcripts stay in this browser's IndexedDB until you delete them; they are never part of a `.map` file.

**Feedback.** The 👍 / 👎 buttons post the rating and the id of that one answer. No text is attached.

**Daily limits.** Questions are budgeted per day to keep a shared free service affordable. The count is tied to your sign-in when you are signed in, and otherwise to a coarse anonymous bucket.

**Availability.** The free tiers are available only on the official site. Self-hosted copies and the desktop app can use a connected key or local model.

**Turning it off.** _Options → Interface settings → Azgaar Assistant → Hide_ hides the call bubble. Nothing is sent when you do not ask a question.

### With your own AI key

When you connect your own key (Anthropic, OpenAI, Mistral, Qwen, DeepSeek) or a local model server, questions go **directly from your browser to that provider**, never through the project. The project never sees your questions, your map data or your key.

* **What is sent to the provider.** Your question and the earlier messages of the same chat; the Assistant's instructions, including a short summary of the open map (its name, seed and counts of states, burgs and so on); the note open in the notes editor and any text you have selected in it; and the results of scripts that read your map, which can include any data from the map. The provider handles all of it under its own terms and privacy policy.
* **Your key** is kept in this browser's `localStorage` and sent only to its provider. It is shared with the AI text generator.
* **Chats** are kept in this browser's IndexedDB with no automatic deletion, never in the `.map` file and never on an FMG server. Deleting a chat removes it; clearing site data removes them all.
* **Costs.** Provider usage is billed by the provider to your account. The token count in the panel is an estimate; the provider's own dashboard is authoritative.

## Risks

Read this before connecting your own AI key.

* **The Assistant runs code in this page.** To read your map, the model writes small JavaScript programs that run in the Generator with the same access as the app itself. They are meant to be read-only, but that is an instruction to the model, not a technical barrier.
* **Maps from other people can carry hidden instructions.** Notes, names and legends in a `.map` file you downloaded are read by the model. Text written to manipulate it ("prompt injection") could make it run a script that sends data elsewhere — including the API keys stored in this browser. Only use the Assistant on maps from sources you trust, and use a key with a spending limit.
* **Changes to your map.** The Assistant can propose rewriting notes, renaming entities, recoloring them and editing details such as burg population, full names and marker icons. Nothing changes until you press Apply on the proposal card, and an applied proposal has Undo while the map still holds what Apply wrote. Scripts that read the map could still change it despite the read-only instruction. Save your map before large edits: autosave and your own `.map` files are the safety net.
* **Answers can be wrong.** Language models make mistakes, including confident ones about your map's numbers. Check anything that matters.

## Disclaimer

The Assistant, with or without a key, is an experimental convenience provided as is, without warranty of any kind. The project is not responsible for provider charges, for data you send to a provider you choose, for changes to your maps applied from the Assistant, or for the accuracy of its answers. Using your own key means you accept your provider's terms, and you are responsible for keeping the key secure and for any use made of it.

## Signing in with Discord

Signing in raises your daily question allowance. It is optional; the Assistant works without it.

* Sign-in is a redirect to Discord's own OAuth screen. FMG never sees your Discord password.
* The Azgaar server learns your Discord account id so it can count your questions against your own allowance.
* A token is stored in this browser's `localStorage`. **Sign out** in the panel deletes it, on the server and here.

## Analytics

The official site loads Google Analytics, which records anonymous usage such as page views and rough location. It tells the project how many people use the tool and which features are worth maintaining. It is not linked to your maps or to your Assistant questions. Browser-level tracking protection or an ad blocker stops it, and the Generator works exactly the same with it blocked. A self-hosted copy of the repository does not load it.

## Licence and your work

The Generator's source is [MIT-licensed](https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/LICENSE). Maps you create are yours, for any purpose, commercial included, with no attribution required — though a link back is always appreciated. Some bundled assets (fonts, icon sets, coat-of-arms artwork) carry their own licences; see [Dependencies](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Dependencies).

The tool is provided as is, without warranty of any kind, as the licence states.

## Questions and removal requests

Ask on the [Discord server](https://discordapp.com/invite/X7E84HU), open an [issue](https://github.com/Azgaar/Fantasy-Map-Generator/issues), or write to azgaar.fmg@yandex.com. To have an Assistant question removed before the 90 days are up, include roughly when you asked it and what it was about.
