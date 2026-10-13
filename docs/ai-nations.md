# AI Nations

AI Nations turns the open map into a turn-based game. States you choose are ruled by AI models. Each turn they read
a briefing about their own realm, then send orders and letters. You are the referee: you decide what actually
happens, and nothing on the map changes without your say.

This fork adds it on top of Azgaar's Fantasy Map Generator and keeps itself current with the original.

## What you need

- An Anthropic API key from <https://console.anthropic.com/account/keys>. The API is billed by use, apart from any
  Claude subscription: add credit under Billing in the same console.
- A map with states. Generate one or load a `.map` file as usual.

The key is stored in your browser and sent only to Anthropic. It is the same key the built-in Assistant uses.

## Setting up a game

Open **Tools → AI Nations** (or search for "AI Nations").

1. **API key.** Paste the key and press *Save and check*. The models your key can use fill the model lists.
2. **Which states do AI models rule?** Tick them. Each gets its own model, so one state can run on
   `claude-opus-5-5` and another on `claude-fable-5-1`. In the box under each, describe the ruler: character, goals,
   grudges, what they would never do. States you leave unticked are yours to play or to leave idle.
3. **Rules of the game.** How long a turn is, how much of the world a nation sees, and house rules every nation
   reads, such as how far an army marches in a turn or what a regiment costs.

## Playing a turn

1. **Tell the world what happened.** Optional news every nation hears, and private letters from you or from a
   state you play yourself.
2. **Collect orders.** Every AI nation is asked at once. Each sends a public proclamation, orders (diplomacy,
   military, recruitment, trade, internal), letters to other states, and a private assessment only you can read.
3. **Rule on what they sent.** Approve or reject each order, and write what actually happened where it differs
   from what was asked. Untick *Deliver* to hold a letter back.
4. **Put the rulings on the map.** *Draft map changes* has a model turn your approved orders into one change:
   relations, regiments moved or raised, treasuries, land changing hands. You see every change before → after.
   **Apply** makes it, **Undo** takes it back. You can also ignore the draft and edit the map by hand.
5. **End the turn.** Next turn each nation is told what became of its orders, what others proclaimed, and which
   letters reached it.

## What a nation knows

Only its briefing: its government, population, treasury and taxes, provinces and largest burgs; every regiment
with its strength and where it stands; foreign forces on its soil; the other powers with their relation to it and
rough strength; the recent chronicle; and what happened since its last orders. With *neighbors and states they have
relations with*, states it has no relations with appear by name only.

A nation remembers nothing between turns except its own notes, which it rewrites each turn, and a short log of its
earlier orders.

## Good to know

- **Cost.** Each nation is one request per turn, usually a few thousand tokens in and under two thousand out.
  Drafting map changes is several requests. The panel shows the running token count; prices are on Anthropic's
  pricing page.
- **The game lives in this browser**, apart from the `.map` file, tied to the map it was started on. Use
  **Setup → Export game** to back it up or move it to another browser, and save the map itself as usual.
- **Time.** Ending a turn does not move the calendar. Change the year in **Tools → Lore** when your turns add up.
- **Trade.** Nations see their treasury, taxes and ports, not the goods and deals of the market model. A trade
  order is a request you settle by ruling, e.g. by moving money between treasuries.

## Keeping the fork current

`.github/workflows/sync-upstream.yml` merges Azgaar's `master` every day, checks that AI Nations still builds and
passes its tests on top of it, and publishes the result. When upstream touches the same lines, or the check fails,
nothing is published: the run fails and, if issues are enabled on the fork, an issue says what conflicted.

AI Nations lives in its own files so that this stays rare:

- `src/services/nations/` — the game, the briefing, the model call
- `src/controllers/nations/` — the panel
- one command in `src/components/map-commands.ts` and one button in
  `src/components/options/tabs/tools-tab.ts` to open it

It reuses the Assistant's key storage, provider calls and its Preview → Apply → Undo machinery.
