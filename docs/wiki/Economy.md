Fantasy Map Generator gives every map a working economy. The countryside produces raw goods, burgs turn them into manufactured goods, markets set prices, traders carry goods along roads and sea lanes, and states tax it all. This page explains how it works and how to shape it for your world.

The economy is a **snapshot of one typical day**, not a running simulation. Every amount is per day: what the land yields, what burgs make, what their people buy, what changes hands, and the money burgs and states end the day with. Numbers change only when you regenerate the economy, never over time.

# Quick tour

1. Open the _Layers_ tab and turn on **Goods**, **Markets** and **Trade**.
2. **Markets** colors the map by trade region. Click a market to see its stock and local prices.
3. **Goods** shows deposits on the cells that hold them, and a plate on each burg with what it makes. Click a burg plate to open its **Economy Overview**.
4. **Trade** animates the day's trade: wagons on roads, ships at sea. Click a moving marker to see what the burg sells or buys there and how the price adds up.
5. Open _Tools_ → _States_ and look at the **Treasury** column to see which states got rich.

# Goods

Goods are everything that can be produced and traded: grain, wood, iron, cloth, jewelry and about 70 more. Open _Tools_ → _Goods_ (<kbd>Shift</kbd>+<kbd>G</kbd>) for the full list.

- **Raw goods** (grain, wool, iron, timber) come from the land. Rural people produce them depending on the biome they live in. Some cells also hold a **deposit**: a rich source of one good, such as an iron mine or a fishing ground, shown with an icon on the Goods layer. Deposits come in loose clusters, and people tend to settle near them.
- **Manufactured goods** (tools, cloth, weapons, ships) are made in burgs from **recipes**: cloth from wool, a ship from wood, sails, ropes and tar. Some, like cloth, ropes or leather, are only ingredients: nobody buys them for themselves, only the trades that use them.
- Some goods are both: they come from the land and can also be made.

With no good selected in the _Goods Editor_, the Goods layer shows an overview: deposit cells in their good's color, and every producing burg as a pie of its five most valuable goods, sized by its output. Hover a cell or a sector to see how much it makes. Select goods to see them in detail.

Click a good in the editor to change it:

| Field                             | What it does                                                                                                                                                                                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Base Price**                    | The good's list value. Market prices move around it, from a fiftieth of it to five times it                                                                                                                                                                            |
| **Carriage Price**                | What it costs to carry one unit one _decima_, a tenth of the map's diagonal. Bulky goods like wood or stone are expensive to carry for their value and stay local; gold, spices or jewelry travel far. Goods bought from another state's market pay twice the carriage |
| **Demand Coverage**               | Which needs one unit covers: 🍖 food, 🛠️ utilities, 🧱 construction, 🛡️ military or 💎 luxury, and how much. A good with no coverage is only an ingredient                                                                                                             |
| **Recipes**                       | What it is made from. A good can have several alternative recipes                                                                                                                                                                                                      |
| **Biome Baseline Production**     | How much rural people produce per population point in each biome                                                                                                                                                                                                       |
| **Multipliers**                   | Production bonuses or penalties by culture type, culture, state, religion, biome or zone. Make one culture famous for its wine, or one zone a mining district                                                                                                          |
| **Distribution** and **Deposits** | Where deposits can appear, and how many the map gets, whatever its size. The Goods Editor shows how many are placed, with the range in small type. See [Goods spread functions](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Goods-spread-functions)           |
| **Deposit output**                | What the good's deposits yield a day on this map. Type a new total and click _Place_ to re-place them until they yield it. This is the direct way to make a good scarce or plentiful                                                                                   |

When you apply changes to a good, the dialog can re-place its deposits and recalculate the economy right away (_regenerate economy on apply_); uncheck it to edit without disturbing the current numbers. You can also add your own goods, change icons, paint deposits onto cells with the brush, and open the **production chains** view to see how goods depend on each other.

# Markets

A **market** is a regional trade hub. Markets are placed on the larger towns, favoring capitals, ports, crossroads and states that charge little for a market license. Where burgs crowd, markets sit closer together; steppes, deserts and states with dear licenses get few, far apart. Each market's region spreads over the land around it, preferring to stay within one state and one landmass. Most inhabited islands get a market of their own, and an island with no port always does. Every burg belongs to exactly one market.

Each market keeps a stock and a price for every good. It buys below its price and sells above it by its **market margin**, which goes to the merchants of the burg at the market's center, so busy markets make their hub rich. The margin is a whole percent: 4% where the market pays little or no license, rising with the state's license fee as merchants pass it on, 5% under a typical monarchy and up to 8% under a greedy theocracy. See it in the Market Overview. A greedy state's markets are dearer, so its trade and its people suffer.

Open _Tools_ → _Markets_ for the overview. There you can add a market on any burg, remove one, paint market regions by hand and **compare** a good's stock and price across all markets. Click a market to rename it, move its center to another burg or see its deals. Cells left without a market take no part in the economy.

# How a day plays out

1. **The countryside delivers.** Every cell sends its produce to its market: grain from the farmland, timber from the forests, fish from the coast, plus whatever its deposit yields. Rural people feed themselves from their fields; they are paid only as their produce sells. A share of that, 44%, goes to their state's capital as rent and dues, and they spend most of the rest on goods at their market.
2. **Prices open.** A market expects to sell a day's worth of each good: what its people buy, and what the trades using the good need. Goods people buy open at their base price. An ingredient that no trade nearby needs opens cheap, so nobody brings it there for nothing. From then on every trade moves prices: selling lowers them, buying raises them, by how much compared with what the market expects to sell in a day. A pile nobody buys sinks until making more of it stops paying. A good buyers ask for and nobody has gets dearer, which draws makers to it.
3. **Burgs work.** Burgs take turns, the largest first, each putting up to 5 workers to work per turn. About two in five of a burg's people (39%) work in trades; the rest serve, build, farm, or are too young or too old. Each worker goes to whatever pays best at that moment: the good's sale price, less the burg's sales tax, minus its ingredients, divided by the workers the whole chain needs. The more of a burg's workers make a good, the more each of them makes, so burgs settle on a trade; and a good the market makes more of than the rest of the world pays better there, so regions become known for their products. Everything made is sold where it fetches the most after carriage: the burg's own market or any other it reaches. Later burgs see the prices the earlier ones moved.
4. **Burgs buy what they need and want.** After each turn, a burg buys the share of its people's daily needs that matches the work done so far: 🍖 food first, then 🛠️ utilities, 🧱 construction, 🛡️ military and 💎 luxury. Buyers spread their money over every good that covers a need, so every good finds some buyers. Everyone prefers the cheapest way to cover a need, but the richer a burg, the more it will pay for goods it has not had yet, so rich burgs enjoy a wider variety. A burg keeps its own goods for its people when that is cheaper than buying. Then it spends what it can spare, up to 72% of what it earned: up to a day's more of each staple, and luxury that grows with its wealth. Whatever the staples leave goes to luxury. The rest is saved.
5. **States collect taxes** on every trade.

Small burgs far from markets, with nothing local to work with, may stay poor and leave needs uncovered. That is intended: geography and roads matter. And not everything made finds a buyer: markets take whatever is brought, at falling prices, so some stock is left over at the end of the day.

# Trade and carriage

A burg buys from **its own market** whenever it has the good. When it does not, the burg buys from the other market where the good comes cheapest, counting the price there, that market's sales tax and the carriage. Buying from a market of another state is an **import**, and the burg's state may charge a tariff on it. Selling is different: a burg sells to whichever market pays it best after carriage.

Goods travel along **routes**: roads, trails and sea lanes. The Trade layer draws exactly the path the goods take, and the carriage is paid for that path:

- Sea travel is five times cheaper than land travel.
- Loading between ship and wagon costs extra; it happens at ports.
- Every burg pays carriage to and from the market's center, so towns far from it earn less and pay more. The center burg pays none.
- A market with no route to a burg cannot trade with it. A burg with no road to its own market pays the highest carriage possible, as if the goods crossed the whole map.

So roads and ports shape the economy: a new road can open a region to trade, and an island without ports lives on its own.

# Money and taxes

Prices are in 🟡, the map's money. Its unit is the **uncia**, a gold coin of one troy ounce: 31.1 g of gold. Default prices work out like this:

|                                                                                | Price | 🟡 1 is about                                         |
| ------------------------------------------------------------------------------ | ----- | ----------------------------------------------------- |
| A bullion of **gold**, an ingot of 15 troy ounces (about 470 g)                | 🟡 15 | one troy ounce of gold, 31 g                          |
| The same in **silver**, with gold worth 11 times silver, as in medieval Europe |       | 340 g of silver, close to a pound; 240 silver pennies |
| A wain of **grain**, a wagon-load of about a tonne                             | 🟡 1  | a wagon-load of grain                                 |
| A laborer's wage, 1–2 pennies a day                                            |       | four to eight months of a laborer's work              |

So 🟡 1 is a lot of money for one person and modest for a town. The anchor is gold: if you change the base price of Gold, this scale shifts with it. To call the money something else, open _Tools_ → _Units_ and pick another name under **Money**.

## Treasuries

- A **burg's treasury** is what it ends the day with: sales, minus ingredients, minus what its people bought, minus the poll tax. It can be below zero: a burg that sold too little to cover its poll tax ends the day in debt, and keeps working. A market's center also pays its state a **market license** every day, so a quiet market in a greedy state can end the day in debt. A market's center burg also earns the market margin on every trade at its market, and a state's capital earns the rural rent. See it in the burg's Economy Overview, where you can also type any value to make a burg rich or broke; it lasts until the next regeneration, which starts every treasury from zero.
- A **state's treasury** is what it collected that day: its sales taxes and tariffs, plus the **poll tax** its people paid and the **market licenses** of its markets. The poll tax collected can be less than the poll tax they owed; the state's Taxes card shows the share collected. Then **corruption** takes its share: what officials pocket never reaches the treasury.
- **Markets hold no money**, but the Markets overview shows what passed through them. **Sales** is what burgs paid the market for its goods, carriage included, less the taxes handed to the states. **Buys** is what the market paid burgs for theirs. **Value** is Sales minus Buys, plus the unsold stock at its prices. The market keeps the carriage, as if its merchants did the carrying. Rural people's purchases and goods a burg kept for itself are not counted.

## Taxes and tariffs

Every state sets five things in its taxes dialog (_Tools_ → _States_, click a treasury value to open the state's Economy dialog, then the bank button on its Taxes card):

- **Sales tax**: charged on every sale by a seller of the state. A burg pays it out of what it earns from selling; a market adds it to the price it charges a burg.
- **Poll tax**: a flat amount per person. A burg pays it first, out of its first sales of the day, so it never stops work; it only delays what its people buy. Rural people set it aside from what their produce earns and pay what they can, so a poor countryside pays less than the rate asks. The Taxes card and the taxes dialog show how much of what was owed the state collected, such as "96% of 🟡107 collected".
- **Market license**: a fixed fee a day from the center burg of each market in the state, whatever its trade. Unions and anarchies charge nothing, trade republics little, monarchies more and theocracies the most. States with dear licenses get fewer markets, farther apart, and a quiet market under a greedy state goes into debt.
- **Corruption**: the share of collected taxes its officials pocket, from 0 to 100%. It starts from the form of government (monarchies 10%, theocracies 7.5%, republics 5%, unions 2.5%, twice that for despotates, hordes, juntas, satrapies and shogunates), grows with the state's size, up to 15% more for the largest state, and with the share of its people of other cultures and faiths, up to 10% more. Anarchies collect nothing, so nothing is stolen. A large, diverse despotate keeps little of what it taxes.
- **Tariffs and embargoes**: charges on imports from other states, by state and by good. An embargo stops that trade completely, both ways. Tariffs start from diplomacy: allies and friends trade freely, other states pay 5%, suspicious states 20%, rivals 30%, and enemies are under embargo. An anarchy starts with no tariffs at all. The neutral lands are no state: trade with them is never an import, so it pays no tariff and no embargo stops it.

Starting rates depend on the state form: monarchies take a tenth of every sale and a poll tax, theocracies a twentieth of sales and the same poll tax, unions a tenth of sales but no poll tax, republics tax lightly, and anarchies collect nothing. Neutral lands never tax. A state with high taxes makes its markets expensive, so neighbors buy elsewhere.

Example: a burg buys 10 units of a good priced 10 at its market, carried 0.5 per unit, in a state with 15% sales tax. It pays 10.5 (price with a 5% margin) + 1.5 (tax) + 0.5 (carriage) = 12.5 per unit, 125 in total, and its state collects 15.

# Reading a burg's Economy Overview

Click a burg plate on the Goods layer, or the production button in the _Burg Editor_. The top shows:

- **Production**: what the burg made today. Most of it is sold, often to other markets.
- **Consumption**: what its people bought or kept for themselves.
- **Demand**: for each need, how much was covered of what its people need, and in green the wants they bought beyond it.
- **Prosperity**: how well its people live (see below), with its parts: needs met, comfort and the number of goods.
- **Product**: the day's sales, less their sales tax and the ingredients bought. **Wealth** is product per person.
- The market margin and the market license it pays if it is a market's center, and its **treasury**: its money at the end of the day. Type a value to change it; the taxes it paid are under the table.

Below is the day in order:

- **LOCAL**: the free output of a deposit on the burg's cell. It grows with the burg's population, but is capped by value: at most 200 worth at the good's base price. So a big burg on cheap clay (base price 2) gets about 15 units, while a burg on gemstones (base price 25) gets at most 8, and a rich deposit cannot make a burg absurdly wealthy.
- **BUY**: ingredients and goods for its people, from its own market or another one. Hover the market to see whether it was an import.
- **MFG**: what its workers made. Expand the row to see the inputs.
- **SELL**: what it sold, and to which market.
- **KEEP**: goods it made and kept for its own people.

Each trade shows the net price, the carriage, tax and tariff per unit, the units and the income: green when the burg earned money, red when it spent it. Hover a cell to see how it adds up. With Economy checked under _Debugging_ in the Advanced options, the overview shows every step instead, with the options each decision weighed and a **NEED** row for each need the burg came to cover.

# Prosperity

**Prosperity** is how well a burg's people live, from 0% to 100%. It comes from what they consume, not what they make:

- **Needs met**: how much of their food, utilities, construction, military and luxury needs is covered. A people going short is never prosperous.
- **Comfort**: how much and how fine their goods are, compared with bare needs bought the cheapest way.
- **Variety**: how many different goods they enjoy.

Living on bare needs is about 20%. Ten levels of 10% each: **Desolate**, **Destitute**, **Poor**, **Modest**, **Comfortable**, **Thriving**, **Affluent**, **Opulent**, **Splendid** and **Peerless**. Most townspeople are Thriving, the richest Splendid or Peerless; rural people, living mostly off their fields, are Poor. Rural people grow their own needs and buy their wants at their market with what their produce earns, so their prosperity counts too, and it varies from place to place: a valley on a rich deposit lives better than barren hills nearby.

Wealth and prosperity differ: an export town makes a lot and saves it, while a market center lives well on its merchants' margins. Prosperity is not happiness either: the generator knows nothing of health, safety or freedom.

Prosperity shows in the _Burgs overview_ (click it, or Wealth, to open the burg's Economy Overview), the _Burg Editor_ and the Economy Overview, and for states in the _States Editor_.

# A state's economy

A state's treasury only shows its cut. A trade republic with low taxes has a small treasury, while its people may be wealthy and prosperous. To see the whole picture, open _Tools_ → _States_ and click a **Treasury** or **Prosperity** value; the column menu can also show **Product** and **Wealth**. The state's **Economy** dialog shows:

- **Product**: what its people make in a day, by sector: **rural** (rural people's earnings), **manufacturing** (its burgs' product) and **trade** (the margins its market centers take).
- **Economy type**: the sector the state leans on more than the world does (**Agrarian**, **Artisan** or **Mercantile**), how far it leans, and the good it is **known for**: the one it makes most of compared with the rest of the world.
- **Wealth** (product per person), **population**, **prosperity**, **treasury** with its **tax burden** (treasury as a share of the product), the **trade balance** with other states, and **inequality** (how unequal its burgs' wealth is), each with the state's rank or the world's figure.
- Its taxes, its **foreign trade** with its five main partners, its main exports and imports and the most valuable goods it makes (the list button shows all of them as a table you can download as CSV, and so does the one by foreign trade), and its **prosperity**: how well its urban and rural population live, and how many of each live at each level. Inequality ranks the most equal state first.

Open several states' dialogs to compare them side by side. The neutral lands have one too: click their Prosperity, Product or Wealth. The total line shows the average treasury and prosperity. The percent button at the bottom opens the state's taxes and tariffs. In the States Editor's percent mode, product shows as a share of the world's, and wealth and prosperity against the world average.

# Shaping the economy for your world

- **Make a region famous for a product**: give the good a multiplier for that culture, state, religion or a zone you draw, or paint deposits there.
- **Make a good scarce or plentiful**: set its deposit output, or its deposits range for new placements.
- **Make a good more or less worth making**: raise or lower its base price against its ingredients.
- **Make trade local or far-reaching**: raise a good's carriage to keep it near its source, lower it to let it travel.
- **Open or close a region**: build or remove roads and sea routes, or add a port.
- **Start a trade war**: set tariffs or an embargo in a state's taxes dialog.
- **Redraw trade regions**: add, move or remove markets, or paint market cells by hand in the Markets overview.

Changes take effect when you regenerate. _Tools_ → _Regenerate_ has four buttons:

| Button         | What it does                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------- |
| **Goods**      | Re-places deposits on the map                                                                       |
| **Markets**    | Rebuilds markets and their regions                                                                  |
| **Production** | Recalculates the day: production, trade and taxes, from the current goods, markets and burgs        |
| **Economy**    | Redraws market regions, then recalculates the day. Market cells you painted by hand are redrawn too |

After Goods or Markets, run Production or Economy to see the effect on trade. Keep a saved copy if you want to compare before and after.

# Questions

**Why does a burg not make an expensive product even though the ingredients exist?** Workers go where they earn most per worker. A long chain takes many workers, and a simpler good with a better margin may win. Ingredients that are dear locally or far away, or a high sales tax, also eat the profit.

**Why is a good never made anywhere?** Its price is too close to the cost of its ingredients, or its ingredients are missing. Raise its base price a little, or add deposits of its inputs, and regenerate production.

**Why is there unsold stock in the markets?** Markets take whatever burgs bring, at prices that fall as stock piles up. Some goods are made faster than people want them, and the last units of the day find no buyer.

**Why does a burg buy from another market a good its own market sells?** It does not: a burg buys elsewhere only what its own market has run out of. It may sell elsewhere, though, when another market pays better after carriage.

**Why do state treasuries change when I only edit a burg?** They do not until you regenerate production; then all deals and taxes are recalculated.

**Why did the treasury I set for a burg change?** Regenerating recalculates the economy from scratch, treasuries included. Set the value again after regenerating.
