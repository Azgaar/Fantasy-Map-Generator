Fantasy Map Generator gives every map a working economy: rural cells produces raw resources, burgs turn them into manufactured goods, markets set prices, traders carry goods along roads and sea lanes, and states tax it all. This page explains how it works and how to shape it for your world.

The economy is a **snapshot of one typical day**, not a running simulation. Every amount is per day: what the land yields, what burgs make, what their people need, what changes hands, and the money burgs and states end the day with. Numbers change only when you regenerate the economy, never over time.

# Quick tour

1. Open the _Layers_ tab and turn on **Goods**, **Markets** and **Trade**.
2. **Markets** colors the map by trade region. Click a market to see what is has in stock and at what is the local price.
3. **Goods** shows resource icons on the cells that hold a bonus resource, and a plate on each burg with what it makes. Click a burg plate to open its **Production Overview**.
4. **Trade** animates trade: wagons on roads, ships at sea. Click a moving marker to see what the burg sells or buys there and how the price adds up.
5. Open _Tools_ → _States_ and look at the **Treasury** column to see which states got rich.

# Goods

Goods are everything that can be produced and traded: grain, wood, iron, cloth, jewelry and about 70 more. Open _Tools_ → _Goods_ (<kbd>Shift</kbd>+<kbd>G</kbd>) for the full list.

- **Raw goods** (grain, wool, iron, timber) come from the land. Rural people produce them depending on the biome they live in, and some cells hold a **bonus resource**, a rich deposit of one good shown with an icon on the Goods layer. With no good selected in the _Goods Editor_, the Goods layer shows an overview of all production valued at base prices: cells shade from pale yellow to dark brown as their output grows, and every producing burg is a circle sized by its output. Select goods to see them in detail: cells in the goods' colors, their bonus resources, and up to three products on every burg plate.
- **Manufactured goods** (tools, cloth, weapons, ships) are made in burgs from **recipes**: for example cloth from wool, or a ship from wood, ropes and sails. Long chains like ore → steel → weapons need several workshops' worth of workers.
- Some goods are both: they come from the land and can also be manufactured.

Click on a good in the editor to change it:

| Field                                 | What it does                                                                                                                                                                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Base Price**                        | The good's list value. Market prices move around it, but never below a tenth or above five times of it                                                                                                                           |
| **Carriage Price**                    | What it costs to carry one unit one _decima_ (a tenth of the map's diagonal). Bulky goods like wood or stone are expensive to carry, so they mostly stay local; gold, spices or jewelry pay little for their value to travel far |
| **Demand Coverage**                   | Which needs one unit covers: 🍖 food, 🛠️ utilities, 🧱 construction, 🛡️ military, or 💎 luxury                                                                                                                                   |
| **Recipes**                           | What it is made from. A good can have several alternative recipes                                                                                                                                                                |
| **Biome Baseline Production**         | How much rural people produce per population point (defaults to 1000 people) in each biome                                                                                                                                       |
| **Multipliers**                       | Production bonuses or penalties by culture type, culture, state, religion, biome or zone. Make one culture famous for its wine, or one zone a mining district                                                                    |
| **Bonus distribution** and **Chance** | Where bonus resources can appear and how often. See [Goods spread functions](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Goods-spread-functions)                                                                        |

When you apply changes to a good, the dialog can re-place it and recalculate the economy right away (the _regenerate economy on apply_ option); uncheck it to edit the good without disturbing the current numbers. You can also add your own goods, change icons, paint bonus resources onto cells with the brush, and open the **production chains** view to see how goods depend on each other.

# Markets

A **market** is a regional trade hub. Markets are placed on the larger towns, with capitals and ports favored, and each market's region spreads over the land around it. Most inhabited islands get a market of their own, and an island with no port always does, since no ship can reach it. Regions prefer to stay within one state and one landmass. Every burg belongs to exactly one market.

Each market keeps a stock and a price for every good. Prices depend on local supply and demand. The market buys a little below its price and sells a little above it (5% each way).

Open _Tools_ → _Markets_ for the overview. From there you can add a market on any burg, remove one, paint market regions by hand and **compare** a good's stock and price across all markets. Click a market to rename it, move its center to another burg or view its deals. Cells left without a market are counted in the overview: their rural and urban population (burgs) takes no part in the economy.

# How a day plays out

1. **The countryside delivers.** Every cell sends its rural production to its market: grain from the farmland, timber from the forests, fish from the coast, plus whatever its bonus resource yields.
2. **Prices are set.** Each market prices every good from how much it has against how much its burgs want.
3. **Burgs work.** Burgs take turns, the largest first, each putting up to 5 workers to work per turn. A burg's workers are its population (1 worker = 1 popilation point). Each worker goes to whatever pays best at that moment: the good's sale price minus the cost of its ingredients, divided by the workers the whole chain needs. Ingredients come from the burg's own market or, when the market has none, from wherever they arrive cheapest. Everything made is sold back to the market, so later burgs see the prices the earlier ones moved.
4. **Burgs fill their demand.** With the money they earned, burgs buy goods for their people: 🍖 food first, then 🛠️ utilities, 🧱 construction, 🛡️ military and 💎 luxury, cheapest coverage first. Goods a burg made itself are kept for its own people when that is cheaper than buying.
5. **States collect taxes** on every trade.

Small burgs far from markets, with nothing local to work with, may end up poor and with needs left uncovered. That is intended: geography and route connections matters.

# Trade and carriage

A burg always trades with **its own market** when the market has the good. When it does not, the burg buys it from the other market where it comes cheapest, counting the price there, the carriage to the burg and that market's sales tax. Buying from a market of another state is an **import**, and the burg's state may charge a tariff on it.

Goods travel along **routes**: roads, trails and sea lanes. The Trade layer draws exactly the path the goods take, and the carriage is paid for that path:

- Sea travel is five times cheaper than land travel.
- Loading between ship and wagon costs extra; it happens at port burgs.
- Every burg pays carriage to and from its market's center, so towns far from the center earn less and pay more. The center burg pays none.
- A market with no route to a burg cannot sell to it. A burg with no road to its own market pays the highest carriage possible, as if the goods crossed the whole map.

So roads and ports shape the economy: a new road can open a region to trade, and an island without ports lives on its own.

# Money and taxes

Prices are in 🟡, the map's money. Its unit is the **uncia**, a gold coin of one troy ounce: 31.1 g of gold. Default prices are set so that it works out like this:

|                                                                                     | Price | 🟡 1 is about                                         |
| ----------------------------------------------------------------------------------- | ----- | ----------------------------------------------------- |
| A bullion of **gold**, an ingot of 15 troy ounces (about 470 g)                     | 🟡 15 | one troy ounce of gold, 31 g                          |
| The same in **silver**, taking gold as worth 11 times silver, as in medieval Europe |       | 340 g of silver, close to a pound; 240 silver pennies |
| A wain of **grain**, a wagon-load of about a tonne                                  | 🟡 1  | a wagon-load of grain                                 |
| A laborer's wage, 1–2 pennies a day                                                 |       | four to eight months of a laborer's work              |

So 🟡 1 is a lot of money for one person and modest for a town: a thousand townspeople can add about 🟡 5 a day by making and trading goods, a penny or so per person.

The anchor is gold: if you change the base price of Gold in the Goods editor, this scale shifts with it.

To call the money something else, open _Tools_ → _Units_ and pick another name under **Money**.

## Treasuries

Burgs and states have a **treasury**. Markets hold no money, but the Markets overview shows how much passed through each of them:

- **Sales**: what burgs paid the market for its goods, carriage included, less the sales tax and tariffs it hands to the states.
- **Buys**: what the market paid burgs for their goods. A burg's own sales tax comes out of what it receives.
- **Value**: Sales minus Buys, plus what the market's unsold stock is worth at its prices.

The market keeps its margin and the carriage, as if its merchants did the carrying. A market's deals list the same income deal by deal; hover it to see the sum. Goods a burg kept for its people never pass through the market and are not counted.

- A burg earns money by selling what it makes and spends it on ingredients and on its people's needs. Its treasury is shown in the _Burg Editor_, and you can type any value there to make a burg rich or broke. Every time the economy is regenerated, it starts again from zero, so a value you type lasts until the next regeneration.
- A state's treasury is what it collected that day: its taxes plus a **poll tax** per population point. It is recalculated from scratch each time the economy runs.

Every state sets three things in its treasury dialog (_Tools_ → _States_, click a treasury value):

- **Sales tax**: charged on every sale made in the state. A burg selling its goods pays it out of the revenue; a market selling to a burg adds it to the price.
- **Poll tax**: a flat amount per person, collected outright.
- **Tariffs and embargoes**: extra charges on imports from other states, by state and by good. An embargo stops that trade completely, both ways. Tariffs start from diplomacy: allies and friends trade freely, suspicious states pay 20%, rivals 30%, and enemies are under embargo.

Starting tax rates depend on the state form: theocracies tax sales heavily, monarchies tax people more, republics and unions tax lightly, and anarchies collect nothing. Neutral lands never tax. A state with high taxes makes its markets expensive, so its neighbors' burgs buy elsewhere.

Example: a burg buys 10 units of a good priced 10 at its market, carried 0.5 per unit, in a state with 15% sales tax. It pays 10.5 (price with the market's 5%) + 1.5 (tax) + 0.5 (carriage) = 12.5 per unit, 125 in total, and its state collects 15.

# Reading a burg's Production Overview

Click a burg plate on the Goods layer, or the production button in the _Burg Editor_. The top shows the burg's population, its market, its initial demand and what stayed **uncovered**, its production, its gross product, wealth per person, the taxes it paid and its treasury. Below is the cycle in order:

- **LOCAL**: the free output of a bonus resource on the burg's cell.
- **BUY**: ingredients and goods for its people, bought from its own market or another one. The market column names where it came from; hover it to see whether it was an import from another state.
- **MFG**: what its workers made, with the recipe. Expand the row to see the inputs.
- **SELL**: its production sold to its market.
- **KEEP**: goods it made and kept for its own people.

Each trade shows the net price of the goods, the carriage, the tax and the tariff per unit, the units and the income: green when the burg earned money, red when it spent it. Hover a cell to see how it adds up.

# Shaping the economy for your world

- **Make a region famous for a product**: give the good a multiplier for that culture, state, religion or a zone you draw, or paint bonus resources there.
- **Make a good common or rare**: raise or lower its base price. A good whose price barely beats its ingredients is rarely worth making; a dear one gets made wherever its inputs are.
- **Make trade local or far-reaching**: raise a good's carriage to keep it near its source, lower it to let it travel.
- **Open or close a region**: build or remove roads and sea routes, or add a port. Then regenerate production.
- **Start a trade war**: set tariffs or an embargo in a state's treasury dialog.
- **Redraw trade regions**: add, move or remove markets, or paint market cells by hand in the Markets overview, then regenerate production.

Changes take effect when you regenerate. _Tools_ → _Regenerate_ has four buttons:

| Button         | What it does                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Goods**      | Re-places bonus resources on the map                                                                                    |
| **Markets**    | Rebuilds markets and their regions                                                                                      |
| **Production** | Recalculates production, trade and taxes from the current goods, markets and burgs                                      |
| **Economy**    | Redraws market regions, then recalculates production, trade and taxes. Market cells you painted by hand are redrawn too |

After Goods or Markets, run Production or Economy to see the effect on trade. Keep a saved copy if you want to compare before and after.

# Questions

**Why does a burg not make an expensive product even though the ingredients exist?** Workers go wherever they earn most per worker. A long chain takes many workers, and a cheaper good with a better margin may win. Ingredients that are expensive locally or far away also eat the profit.

**Why is a good never produced anywhere?** Its price is too close to the cost of its ingredients. Raise its base price a little and regenerate production.

**Why does a burg buy from another market a good its own market sells?** It does not: a burg turns to other markets only for what its own market has run out of. Then the cheapest other market wins, even across a border.

**Why do state treasuries change when I only edit a burg?** They do not until you regenerate production; then all deals and taxes are recalculated.

**Why did the treasury I set for a burg change?** Regenerating production recalculates the economy from scratch, burg treasuries included. Set the value again after regenerating.
