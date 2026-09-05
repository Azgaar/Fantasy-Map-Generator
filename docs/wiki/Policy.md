This page describes what data the _Fantasy Map Generator_ (FMG) handles, where it goes, and how long it is kept. It covers the tool as published at [azgaar.github.io/Fantasy-Map-Generator](https://azgaar.github.io/Fantasy-Map-Generator/); a self-hosted or offline copy has no server side at all beyond what you connect yourself.

FMG is a hobby project, not a company. There is no account system, no user profile and nothing is sold to anyone.

## Your maps stay in your browser

Map generation and editing run entirely in the browser. A generated world is never uploaded anywhere.

* **Autosave** writes the current map into your browser's own storage (IndexedDB) so it can be restored when you come back. Clearing the site data removes it. You can turn autosave off in _Options → Generator settings_.
* **Save** and **Load** work with files on your own machine.
* **Settings** (theme, units, locked options, "don't ask again" flags) are stored in this browser's `localStorage`.
* Nothing in this group is readable by the project.

## Optional services you connect yourself

These are off by default. Using one means sending data to that third party under their own terms.

* **Dropbox** — only if you sign in from _Save/Load → Cloud_, and only the map files you choose to store there.
* **Google Translate** — only if you switch the interface language; the page text is then processed by Google.
* **AI text generation** (_Tools → AI generator_) — your prompt goes directly from your browser to the provider you pick (OpenAI, Anthropic, or a local Ollama instance). The API key you enter is kept in this browser's `localStorage` and is sent only to that provider. The project never sees the prompt or the key.

## Azgaar Assistant

The Assistant answers questions about using the Generator. It talks to the project's help gateway at `ask.azgaarsfmg.com`, which is the only FMG server involved anywhere in the tool.

**What is sent.** The question you type and a conversation id. Nothing from your map, your files or your browser is sent — the Assistant cannot see the world you are working on and cannot describe it back to you.

**How long questions are kept.** Questions and the answers given to them are retained for **90 days**, then deleted. They are read only to fix wrong answers and to find gaps in the wiki. They are not published, shared or used to identify anyone.

**Conversation memory.** The Assistant remembers the current thread so follow-up questions make sense. Only the server-issued conversation id is stored in your browser, in `sessionStorage`, which means one tab and one sitting. The gateway forgets the thread two hours after the last question, and the panel marks the boundary with a _new conversation_ line. The **New chat** button in the panel's title bar drops the id and clears the transcript immediately.

**Feedback.** The 👍 / 👎 buttons post the rating and the id of that one answer. No text is attached.

**Daily limits.** Questions are budgeted per day to keep a shared free service affordable. The count is tied to your sign-in when you are signed in, and otherwise to a coarse anonymous bucket.

**Availability.** The gateway only accepts requests from the official site. On a self-hosted copy the panel says so and offers the wiki instead.

**Turning it off.** _Options → Generator settings → Azgaar assistant → Hide_ removes the button and the panel. Nothing is sent when you do not ask a question.

## Signing in with Discord

Signing in raises your daily question allowance. It is optional; the Assistant works without it.

* Sign-in is a redirect to Discord's own OAuth screen. FMG never sees your Discord password.
* The gateway learns your Discord account id so it can count your questions against your own allowance.
* A token is stored in this browser's `localStorage`. **Sign out** in the panel deletes it, on the server and here.

## Analytics

The official site loads Google Analytics, which records anonymous usage such as page views and rough location. It tells the project how many people use the tool and which features are worth maintaining. It is not linked to your maps or to your Assistant questions. Browser-level tracking protection or an ad blocker stops it, and the Generator works exactly the same with it blocked. A self-hosted copy of the repository does not load it.

## Licence and your work

The Generator's source is [MIT-licensed](https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/LICENSE). Maps you create are yours, for any purpose, commercial included, with no attribution required — though a link back is always appreciated. Some bundled assets (fonts, icon sets, coat-of-arms artwork) carry their own licences; see [Dependencies](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Dependencies).

The tool is provided as is, without warranty of any kind, as the licence states.

## Questions and removal requests

Ask on the [Discord server](https://discordapp.com/invite/X7E84HU), open an [issue](https://github.com/Azgaar/Fantasy-Map-Generator/issues), or write to azgaar.fmg@yandex.com. To have an Assistant question removed before the 90 days are up, include roughly when you asked it and what it was about.
