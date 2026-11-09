Fantasy Map Generator gives every map a working economy. The countryside produces raw goods, burgs turn them into manufactured goods, markets set prices, traders carry goods along roads and sea lanes, and states tax it all. This page explains how it works and how to shape it for your world.

The economy is a **snapshot of one typical day**, not a running simulation. Every amount is per day: what the land yields, what burgs make, what their people buy, what changes hands, and the money burgs and states end the day with. Numbers change only when you regenerate the economy, never over time.

# The economy in brief

- **The countryside produces.** Each cell sends its raw goods and its deposit's yield to its regional market. Rural people feed themselves from their fields and earn money only as their produce sells.
- **Burgs work.** Burgs take turns, the most developed and populous first. Each worker does whatever earns the most: making a good from a recipe, or working a deposit under the burg.
- **Markets set prices.** A good is cheap where it is in surplus, dear where it is short, and at its list price where the two balance. A burg importing a good also counts as demand in the markets nearer to it.
- **Burgs and rural people buy.** Burgs cover their needs first, then spend what they can spare on wants and save the rest. Rural people buy wants with what their produce earned.
- **Distance and borders cost money.** A buyer pays the market's price and margin, carriage along the routes, the seller state's sales tax and, across a border, the importer's tariff.
- **States tax and spend.** They collect taxes as the day goes on and spend them on the court, administration, infrastructure and the army, while corrupt officials pocket a share. That spending keeps armies strong and raises prosperity.
- **Geography decides who gets rich.** Deposits, routes, development and borders make regions specialize.

# Quick tour

1. Open the _Layers_ tab and turn on **Goods**, **Markets** and **Trade**.
2. **Markets** colors the map by trade region. Click a market to see its stock and local prices.
3. **Goods** colors the cells by what they produce, marks deposits with icons, and shows each burg as a pie of what it makes. Click a burg pie's ring to open its **Economy Overview**; its center is the burg icon, which opens the _Burg Editor_.
4. **Trade** animates the day's trade: wagons on roads, ships at sea. Click a moving marker to see what the burg sells or buys there and how the price adds up.
5. Open _Tools_ → _States_ and click a state's **Prosperity** to open its **Economy** dialog.

# Goods

Goods are everything that can be produced and traded: grain, wood, iron, cloth, jewelry and about 70 more. Open _Tools_ → _Goods_ (<kbd>Shift</kbd>+<kbd>G</kbd>) for the full list.

- **Raw goods** (grain, wool, iron, timber) come from the land. Rural people produce them depending on the biome they live in. Some cells also hold a **deposit**: a rich source of one good, such as an iron mine or a fishing ground, shown with an icon on the Goods layer. Deposits come in loose clusters, and people tend to settle near them.
- **Manufactured goods** (tools, cloth, weapons, ships) are made in burgs from **recipes**: cloth from wool, a ship from wood, sails, ropes and tar. Some, like cloth, ropes or leather, are only ingredients: nobody buys them for themselves, only the trades that use them.
- Some goods are both: they come from the land and can also be made.

With no good selected in the _Goods Editor_, the Goods layer shows an overview: every producing cell in the color of its most valuable good, darker the more it makes, an icon on each deposit, and every producing burg as a pie of its five most valuable goods, sized by its output. Goods worth under 4% of a burg's output join a grey sector with the rest; hover a sector to see its goods and their shares. Select goods to see only them: cells shaded by how much of them they make, their deposits, and burg pies of those goods alone. Hover a cell or a sector to see how much it makes. In _Style_, each part of the layer (cells, icons, burgs) can be switched off from its section's checkbox.

Click a good in the editor to change it:

| Field                             | What it does                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Base Price**                    | The good's list value. Market prices move around it, from a fiftieth of it to five times it                                                                                                                                                                                                                                                                                                                                     |
| **Carriage Price**                | What it costs to carry one unit one _decima_, a tenth of the map's diagonal. Bulky goods like wood or stone are expensive to carry for their value and stay local; gold, spices or jewelry travel far. Goods bought from another state's market pay twice the carriage                                                                                                                                                          |
| **Development**                   | The least development a land needs to gather or make the good, 0 for none. See [Development](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Development)                                                                                                                                                                                                                                                                  |
| **Demand Coverage**               | Which needs one unit covers: 🍖 food, 🛠️ utilities, 🧱 construction, 🛡️ military or 💎 luxury, and how much. A good with no coverage is only an ingredient                                                                                                                                                                                                                                                                      |
| **Recipes**                       | What it is made from. A good can have several alternative recipes                                                                                                                                                                                                                                                                                                                                                               |
| **Biome Baseline Production**     | How much rural people produce per population point in each biome                                                                                                                                                                                                                                                                                                                                                                |
| **Multipliers**                   | Production bonuses or penalties by culture type, culture, state, religion, biome or zone. Make one culture famous for its wine, or one zone a mining district                                                                                                                                                                                                                                                                   |
| **Distribution** and **Deposits** | Where deposits can appear, and how many the map gets, whatever its size. The Goods Editor can show how many are placed in its Deposits column, hidden by default and turned on from the column menu. Click a good's Produced value to see which states and provinces make it in their cells, and which burgs make it. See [Goods spread functions](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Goods-spread-functions) |

Your goods are saved with the map and in the browser, and a new map starts from them. Only multipliers set for one map's cultures, states, religions or zones are left behind. Opening a `.map` replaces your goods with that map's, and _Restore default goods_ in the **Economy Regeneration** dialog starts over, also bringing in changes to the default goods from newer versions. Changed goods affect where people settle, so the same seed gives a different map than with the default goods.

When you apply changes to a good, its deposits are re-placed if their distribution or count changed, and the **Economy Regeneration** dialog offers to recalculate the day right away; cancel it to edit without disturbing the current numbers. You can also add your own goods, change icons, paint deposits onto cells with the brush, open the **production chains** view to see how goods depend on each other, and show a **legend box** of the selected goods, or of all goods.

# Markets

A **market** is a regional trade hub. Markets are placed on the larger towns, favoring capitals, ports, crossroads and states that charge little for a market license. Where burgs crowd, markets sit closer together; steppes, deserts and states with dear licenses get few, far apart. Each market's region spreads over the land around it, preferring to stay within one state and one landmass. Most inhabited islands get a market of their own, and an island with no port always does. Every burg belongs to exactly one market.

Each market keeps a stock and a price for every good. It buys below its price and sells above it by its **market margin**, which goes to the merchants of the burg at the market's center, so busy markets make their hub rich. The margin is a whole percent: 4% where the market pays little or no license, as under unions and most republics, rising with the state's license fee as merchants pass it on: 5% under a typical monarchy and up to 6% under a greedy theocracy. See it in the Market Overview. A greedy state's markets are dearer, so its trade and its people suffer.

Open _Tools_ → _Markets_ for the overview. There you can add a market on any burg, remove one, paint market regions by hand and **compare** a good's stock and price across all markets. Click a market to rename it, move its center to another burg or see its deals. These changes take effect when you regenerate production. Cells left without a market take no part in the economy.

# How a day plays out

1. **The countryside delivers.** Every cell sends its produce to its market: grain from the farmland, timber from the forests, fish from the coast, plus whatever its deposit yields. Rural people feed themselves from their fields; they are paid only as their produce sells, less the market margin, and they spend most of it on goods at their market.
2. **Prices open.** A market expects to sell a day's worth of each good: what its people buy, and what the trades using the good need. Goods people buy list at their base price; an ingredient that no trade nearby needs lists cheap, so nobody brings it there for nothing. A price follows the day's demand against the supply at that market: below its list price in a surplus, above it in a shortage, at it when they balance. What the countryside and burgs bring is supply. What is bought there, and buyers turned away, are demand, by how much compared with what the market expects to sell in a day. A burg buying from another market also counts as demand in the markets nearer to it, so a town short of a good pays more even with none on sale. A big lot moves the price as it goes, so it trades at the average along the way: a town dumping a cartload into a small market gets less for the last barrels than for the first. A pile nobody buys sinks until making more of it stops paying. A good buyers ask for and nobody has gets dearer, which draws makers to it.
3. **Burgs work.** Burgs take turns by development times the square root of population, the most first, each putting up to 5 workers to work per turn. **Development** is a land's technology, 0 to 100 (see [Development](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Development)): set by each people's culture (dwarves and elves above orcs and giants) and its land. Advanced goods need developed land: tools, glass and books cannot be made in backward regions, and gunpowder only in the most advanced. Past the High Middle Ages (30), development also raises the output of every good: half again at 45. About a third of a burg's people (32%) work in trades; the rest serve, build, farm, or are too young or too old. Each worker goes to whatever pays best at that moment: the good's sale price, less the burg's sales tax, minus its ingredients, divided by the workers the whole chain needs. A burg on a deposit can also set workers to gather it, with no ingredients to buy, for sale or for its own chains. The more of a burg's workers make a good, the more each of them makes, so burgs settle on a trade; and a good the market makes more of than the rest of the world pays better there, so regions become known for their products. Everything made is sold where it fetches the most after carriage: the burg's own market or any other it reaches. Later burgs see the prices the earlier ones moved.
4. **Burgs buy what they need and want.** After each turn, a burg buys the share of its people's daily needs that matches the work done so far: 🍖 food first, then 🛠️ utilities, 🧱 construction, 🛡️ military and 💎 luxury. Buyers spread their money over the goods that cover a need, at least a coin on each, so a village buys a few goods and a city many. A burg that cannot afford its needs buys only the cheapest goods that cover them. Everyone prefers the cheapest way to cover a need, but the richer a burg, the more it will pay for goods it has not had yet, so rich burgs enjoy a wider variety. A burg keeps its own goods for its people when that is cheaper than buying. Then it spends what it can spare, up to 68% of what it earned: up to a day's more of each staple, and luxury that grows with its wealth. Whatever the staples leave goes to luxury. The rest is saved.
5. **States collect taxes** on every trade.

Small burgs far from markets, with nothing local to work with, may stay poor and leave needs uncovered. That is intended: geography and roads matter. And not everything made finds a buyer: markets take whatever is brought, at falling prices, so some stock is left over at the end of the day.

# Development

Every cell where people live has a technological development from 1 to 100, from hunter-gatherers to a post-human civilization, set by the map's cultures. Goods need it to be made: grain from 6, tools from 15, iron from 18, paper from 21, gunpowder from 30. The more developed a burg, the earlier it picks its trade each day. See [Development](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Development).

# Trade and carriage

A burg buys from **its own market** while it stocks at least one unit of the good. Otherwise, the burg buys from the other market where the good comes cheapest, counting the price there, that market's sales tax and the carriage. Buying from a market of another state is an **import**, and the state of the burg's own market may charge a tariff on it. A border burg whose market is centered in another state pays that state's tariff. A burg sells to whichever market pays it best after carriage; selling to a market of another state is an import there, and that state may charge its tariff.

Goods travel along **routes**: roads, trails and sea lanes. The Trade layer draws exactly the path the goods take, and the carriage is paid for that path:

- Sea travel is five times cheaper than land travel.
- Loading between ship and wagon costs extra; it happens at ports.
- Every burg pays carriage to and from the market's center, so towns far from it earn less and pay more. The center burg pays none.
- A market with no route to a burg cannot trade with it. A burg with no road to its own market pays the highest carriage possible, as if the goods crossed the whole map.

So roads and ports shape the economy: a new road can open a region to trade, and an island without ports lives on its own.

# Money and taxes

Prices are in 🟡, the map's money. Its unit is the **uncia**, a gold coin of one troy ounce: 31.1 g of gold. Default prices work out like this:

|                                                                                | Price  | 🟡 1 is about                                         |
| ------------------------------------------------------------------------------ | ------ | ----------------------------------------------------- |
| A bullion of **gold**, an ingot of 15 troy ounces (about 470 g)                | 🟡 13  | one troy ounce of gold, 31 g                          |
| The same in **silver**, with gold worth 11 times silver, as in medieval Europe |        | 340 g of silver, close to a pound; 240 silver pennies |
| A wain of **grain**, a wagon-load of about a tonne                             | 🟡 1.5 | two-thirds of a wagon-load of grain                   |
| A laborer's wage, 1–2 pennies a day                                            |        | four to eight months of a laborer's work              |

So 🟡 1 is a lot of money for one person and modest for a town. The anchor is gold: if you change the base price of Gold, this scale shifts with it. To call the money something else, open _Tools_ → _Units_ and pick another name under **Money**.

## Treasuries

- A **burg's balance** (its treasury) is what it ends the day with: sales, minus ingredients, minus what its people bought, minus the poll tax, plus its **adjustments**. It can be below zero: a burg that sold too little to cover its poll tax ends the day in debt, and keeps working. A market's center also pays its state a **market license** every day, so a quiet market in a greedy state can end the day in debt. A market's center burg also earns the market margin on every trade at its market. See it in the burg's Economy Overview. The balance itself is not edited: open its **Adjustments** row there instead and add lines, each with a name and an amount a day besides trade, such as rents or a patron's gifts, or a negative amount for debts, tribute or upkeep. It arrives at dawn, so the burg's people spend it the same day and live better, or tighten their belts; it stays when the economy is regenerated and takes effect on the next regeneration.
- A **state's treasury balance** (**Balance** in the tables) is what it keeps of what it collected that day, below zero if it spent more: its sales taxes and tariffs, plus the **poll tax** its people paid and the **market licenses** of its markets, less what its **budget** spent and what **corruption** took. The poll tax collected can be less than the poll tax they owed; the state's Revenue card shows the share collected. What officials pocket never reaches the treasury.
- **Markets hold no money**, but the Markets overview shows what passed through them. **Sales** is what burgs paid the market for its goods, carriage included, less the taxes handed to the states and its center burg's margin. **Buys** is what the market paid burgs for theirs, plus that margin. **Value** is Sales minus Buys, plus the unsold stock at its prices. The market keeps the carriage, as if its merchants did the carrying. Rural people's purchases and goods a burg kept for itself are not counted.

## Taxes and tariffs

Every state sets these in its taxes dialog (_Tools_ → _States_, click a Prosperity value to open the state's Economy dialog, then the bank button on its Revenue or Expenses card):

- **Sales tax**: charged on every sale by a seller of the state. A burg pays it out of what it earns from selling; a market adds it to the price it charges a burg.
- **Poll tax**: a flat amount per person. A burg pays it first, out of its first sales of the day, so it never stops work; it only delays what its people buy. Rural people set it aside from what their produce earns and pay what they can, so a poor countryside pays less than the rate asks. The Revenue card and the taxes dialog show how much of what was owed the state collected, such as "96% of 🟡107 collected".
- **Market license**: a fixed fee a day from the center burg of each market in the state, whatever its trade. Unions and anarchies charge nothing, trade republics little, monarchies more and theocracies the most. States with dear licenses get fewer markets, farther apart, and a quiet market under a greedy state goes into debt.
- **Adjustments**: income or costs besides taxes, as many named lines as you like, such as tribute or crown estates, or a negative amount for debts and tribute the state pays. It adds to what the state collects, so it raises or lowers what its expenses can spend, and it stays when the economy is regenerated. The balance itself is not edited: it is what is left.
- **Expenses**: what the state spends of its taxes, in percent of what it collects: **court and clergy**, **administration**, **infrastructure** and **military**. They need not add up to 100%: the **Balance** shows what is left, or how far the state spends beyond its taxes into debt. The gray part of each slider is what corruption takes of it, and **Reset** restores the state's starting budget. See [State spending](#state-spending).
- **Corruption**: the share of each expense its officials would pocket, from 0 to 100%; what the state saves is safe from them. It starts from the form of government (monarchies 15%, theocracies 12%, republics 8%, unions 4%, twice that for despotates, hordes, juntas, satrapies and shogunates), grows with the state's size, up to 15% more for the largest state, and with the share of its people of other cultures and faiths, up to 10% more. Anarchies collect nothing, so nothing is stolen. A well-paid **administration** curbs up to half of it (see [State spending](#state-spending)): the States Editor and the state's Economy dialog show corruption as curbed.
- **Tariffs and embargoes**: charges on imports from other states, as rules by state and by good: pick the states and the goods, then a tariff rate or an embargo. An embargo always wins; otherwise the most specific tariff applies. An embargo stops that trade completely, both ways. Tariffs start from diplomacy: allies and friends trade freely, other states pay 5%, suspicious states 20%, rivals 30%, and enemies are under embargo. An anarchy starts with no tariffs at all. The neutral lands are no state: trade with them is never an import, so it pays no tariff and no embargo stops it.

Starting rates depend on the state form: monarchies take about a twelfth of every sale and a poll tax, theocracies a twentieth of sales and the same poll tax, unions a tenth of sales but no poll tax, republics tax lightly, and anarchies collect nothing. Neutral lands never tax. A state with high taxes makes its markets expensive, so neighbors buy elsewhere.

Example: a burg buys 10 units of a good priced 10 at its market, carried 0.5 per unit, in a state with 15% sales tax. It pays 10.5 (price with a 5% margin) + 1.5 (tax) + 0.5 (carriage) = 12.5 per unit, 125 in total, and its state collects 15.

## State spending

States spend their taxes the same day they collect them, buying goods at the markets like burgs do. Every purchase is a **state order**, shown in the Trade layer and in a market's deals as **State**:

- **Court and clergy** buy luxuries at the capital.
- **Administration** buys utilities at the capitals of its provinces, each as much as its share of the state's people.
- **Infrastructure** buys construction goods at the capitals of its provinces.
- **Military** buys military goods and food at the capital.

A state spends as its taxes come in, so its orders raise the prices of what it buys and burgs turn to making it: a warlike state keeps its smiths busy. What the markets cannot supply stays in the treasury. Orders pay the margin and carriage, and the sales tax and tariffs of other states, but no tax to their own state.

Starting budgets depend on the state. The military is the largest expense, from about 30% for the calmest states to 70% for the most warlike, growing with the **war alert** (_Tools_ → _Military_). Theocracies spend more on their clergy, monarchies on their court, republics and unions on administration and infrastructure. The court grows with how much bigger the capital is than the state's other towns, administration with the number of burgs and infrastructure with the share of people living in towns. Together they spend most of the taxes: the treasury typically keeps about a seventh. Anarchies spend nothing. The state's Economy dialog shows what each expense bought that day.

What each expense achieves depends on how much it actually spent against what a state of that size needs, so a large state must spend more for the same effect:

- **Military → upkeep**: how well its spending keeps its forces, from 0% to 100%, shown in the _Military overview_. In battles, each regiment's strength is multiplied by its state's upkeep, at least 5%, so ill-kept troops fight weaker. A state at high war alert raises a large army that its budget may not keep.
- **Infrastructure → prosperity**: 15% of every burg's and rural cell's prosperity is how fully infrastructure serves its province. Each province gets the state's spending by its people, less what its officials pocket, so far and foreign provinces are served worse.
- **Administration → corruption**: a paid administration curbs up to half of the corruption, in proportion to how fully it is paid for the state's people. Underfunding it is a false saving: officials then take more of every other expense. Corruption differs by province: it is higher in provinces far from the capital or overseas and in those of other cultures and faiths, lower near the capital, and averages to the state's.
- **Court and clergy → stability**.

**Stability** is how firmly a province holds together, from 0% to 100%. Its prosperity and the state's court and clergy and well-kept army support it; distance from the capital, peoples of other cultures and faiths, corruption and the state's tax burden undermine it, and an army the state cannot keep threatens it. A state's stability is its provinces' by their people. Rebel zones rise more often in unstable states, in their least stable provinces, and armies of stable states start battles with higher morale. The States and Provinces editors show it; click it to open the state's **Stability** dialog, which breaks it down part by part beside what each expense achieved, and lists its provinces with their corruption, infrastructure and stability.

# Reading a burg's Economy Overview

Click the ring of a burg pie on the Goods layer, or the chart button in the _Burg Editor_. The top shows:

- **Production**: what the burg made today. Most of it is sold, often to other markets.
- **Consumption**: what its people bought or kept for themselves.
- **Demand**: for each need, how much was covered of what its people need, and in green the wants they bought beyond it.
- **Prosperity**: how well its people live (see below), with its parts: needs met, comfort, the number of goods and its state's infrastructure.
- **Product**: the day's sales, less their sales tax and the ingredients bought. **Wealth** is product per person.
- **Revenue and expenses**: its sales, ingredients, consumption and poll tax, the market margin and license if it is a market's center, its **Adjustments**, and its **Day Balance**: its money at the end of the day. The taxes it paid are under the table.

Below is the day in order:

- **LOCAL**: what its workers gathered from a deposit on the burg's cell. It takes no ingredients and a worker gets 2 units a day before multipliers, but it competes with the burg's other trades and is worth only what the market pays. A deposit yields a burg at most 200 worth a day at the good's base price, so no burg can grind a rich deposit into absurd wealth.
- **BUY**: ingredients and goods for its people, from its own market or another one. Hover the market to see whether it was an import.
- **MFG**: what its workers made. Expand the row to see the inputs.
- **SELL**: what it sold, and to which market.
- **KEEP**: goods it made and kept for its own people.

Each trade shows the net price, the carriage, tax and tariff per unit, the units and the revenue: green when the burg earned money, red when it spent it. Hover a cell to see how it adds up. With Economy checked under _Debugging_ in the Advanced options, the overview shows every step instead, with the options each decision weighed and a **NEED** row for each need the burg came to cover.

# Prosperity

**Prosperity** is how well a burg's people live, from 0% to 100%. It comes mostly from what they consume, not what they make:

- **Needs met**: how much of their food, utilities, construction, military and luxury needs is covered. A people going short is never prosperous.
- **Comfort**: how much and how fine their goods are, compared with bare needs bought the cheapest way.
- **Variety**: how many different goods they enjoy.
- **Infrastructure**: 15% of it is how fully their state's infrastructure spending serves their province: far and foreign provinces are served worse.

Living on bare needs is about 17%, or 32% under full infrastructure. Ten levels of 10% each: **Desolate**, **Destitute**, **Poor**, **Modest**, **Comfortable**, **Thriving**, **Affluent**, **Opulent**, **Splendid** and **Peerless**. The typical burg is Modest, its people on average Thriving, and a few of the richest reach Peerless. Most rural cells are Poor or Modest. Rural people grow their own needs and buy their wants at their market with what their produce earns, and keep what of their produce goes unsold, so their prosperity counts too, and it varies from place to place: a valley on a rich deposit lives better than barren hills nearby, and fertile country whose harvest its market cannot absorb lives comfortably. Villages are measured by village standards, so a Comfortable village still consumes less than a Comfortable town.

Wealth and prosperity differ: an export town makes a lot and saves it, while a market center lives well on its merchants' margins. Prosperity is not happiness either: the generator knows nothing of health, safety or freedom.

Prosperity shows in the _Burgs overview_ (click it, or Wealth, to open the burg's Economy Overview), the _Burg Editor_ and the Economy Overview, and for states in the _States Editor_.

# A state's economy

A state's treasury only shows its cut. A trade republic with low taxes has a small treasury, while its people may be wealthy and prosperous. To see the whole picture, open _Tools_ → _States_ and click a **Prosperity** value; the column menu can also show **Balance**, **Product** and **Wealth**, and clicking them opens the same dialog. The state's **Economy** dialog shows:

- **Product**: what its people make in a day, by sector: **rural** (rural people's earnings), **manufacturing** (its burgs' product) and **trade** (the margins its market centers take).
- **Economy type**: the sector the state leans on more than the world does (**Agrarian**, **Artisan** or **Mercantile**), how far it leans, and the good it is **known for**: one of its main exports, the rarer in the world's trade the better.
- **Wealth** (product per person), **population**, **prosperity**, **day balance** with its **tax burden** (the taxes it collected as a share of the product), the **trade balance** with other states, and **inequality** (how unequal its burgs' wealth is), each with the state's rank or the world's figure.
- Its **revenue**, tax by tax, beside its **expenses**: each expense's share of the taxes as a bar, the part officials pocket grayed, with what it spent, then corruption and the day balance; its **foreign trade** with its five main partners, each a bar of exports and imports with the balance beside it, its main exports and imports and the most valuable goods it makes (the list button shows all of them as a table you can download as CSV, and so does the one by foreign trade), and its **prosperity**: how well its urban and rural population live, and how many of each live at each level. Inequality ranks the most equal state first.

Provinces have their own economy dialog: open _Tools_ → _Provinces_ and click a province's **Prosperity** or **Corruption**. It is laid out like the state's: cards for its population, product, wealth, prosperity, taxes collected, corruption, infrastructure and stability, each ranked among its state's provinces and set against the state's; its sectors and how its people live; one block of the **taxes collected** there for its state, in red as its people pay them, and the **state orders** placed at its burgs, in green as they benefit from them (its capital's, and at the state's capital the court's and the army's), with the corruption officials took of its share; and its most valuable goods. Provinces have no budgets or taxes of their own: the state sets them.

Open several states' dialogs to compare them side by side. The neutral lands have one too: click their Prosperity, Product or Wealth. The total line shows the average prosperity, and the average balance when the Balance column is shown. The bank button on the Revenue or Expenses card opens the state's taxes, budget and tariffs. In the States Editor's percent mode, product shows as a share of the world's, and wealth and prosperity against the world average.

# Shaping the economy for your world

- **Make a region famous for a product**: give the good a multiplier for that culture, state, religion or a zone you draw, or paint deposits there.
- **Gather more or less of a raw good**: change its Biome Baseline Production, or its Deposits if it mostly comes from deposits. Multipliers do the same in one region. Base Price and Demand Coverage change what it earns, not how much is gathered.
- **Make more or less of a manufactured good**: workers take whatever pays best, so a gain often comes at another good's expense. Multipliers are the strongest control: doubling one can triple or quadruple output. Lighter recipes and more Demand Coverage can each nearly double it, though coverage barely moves goods like tools or boats. Raising Base Price adds little, while cutting it or making recipes heavier can end a trade that only just pays. Combine them for a big change. An ingredient follows the trades that use it, so change their recipes too.
- **Make trade local or far-reaching**: raise a good's carriage to keep it near its source, lower it to let it travel.
- **Open or close a region**: build or remove roads and sea routes, or add a port.
- **Start a trade war**: set tariffs or an embargo in a state's taxes dialog.
- **Redraw trade regions**: add, move or remove markets, or paint market cells by hand in the Markets overview.

Changes take effect when you regenerate. _Tools_ → _Regenerate_ → **Economy**, the regenerate button in the **Goods Editor** and the one in the **Markets Overview** all open the **Economy Regeneration** dialog, with these ticked to start with:

| Part              | What it does                                                                                 | Economy | Goods Editor | Markets Overview |
| ----------------- | -------------------------------------------------------------------------------------------- | ------- | ------------ | ---------------- |
| **Restore goods** | Brings back the default goods and places all their deposits                                  |         |              |                  |
| **Deposits**      | Re-places deposits on the map, which new deposit counts need                                 |         | ✓            |                  |
| **Markets**       | Rebuilds markets and their regions                                                           |         |              | ✓                |
| **Market areas**  | Redraws market regions. Market cells you painted by hand are redrawn too                     |         |              |                  |
| **Production**    | Recalculates the day: production, trade and taxes, from the current goods, markets and burgs | ✓       | ✓            | ✓                |

Tick any combination; they always run in this order. Leaving production out keeps the numbers for new deposits or regions, while new markets or restored goods clear them until you regenerate production. Regenerating **Burgs** also rebuilds markets and recalculates production; regenerating **States** recalculates production. Removing a good, a burg or a market only removes its own deals, and painting deposits by hand only changes the cells. Keep a saved copy if you want to compare before and after.

**Locked states and burgs** keep their taxes, budget and adjustments, and locked states their tariffs too, but a day is one shared run, so their production, prices and balance are recalculated like everyone else's. Regenerating states drops a locked state's tariff rules on states that no longer exist, and rebuilds diplomacy for every state, so its tariffs may no longer match its relations.

# Questions

**Why does a burg not make an expensive product even though the ingredients exist?** Workers go where they earn most per worker. A long chain takes many workers, and a simpler good with a better margin may win. Ingredients that are dear locally or far away, or a high sales tax, also eat the profit.

**Why is a good never made anywhere?** Its price is too close to the cost of its ingredients, or its ingredients are missing. Raise its base price a little, or add deposits of its inputs, and regenerate production.

**Why is there unsold stock in the markets?** Markets take whatever burgs bring, at prices that fall as stock piles up. Some goods are made faster than people want them, and the last units of the day find no buyer.

**Why does a burg buy from another market a good its own market sells?** It does not: a burg buys elsewhere only what its own market has run out of. It may sell elsewhere, though, when another market pays better after carriage.

**Why do state treasuries change when I only edit a burg?** They do not until you regenerate production; then all deals and taxes are recalculated.

**Why did nothing change when I added an adjustment to a burg?** Adjustments, like most edits to routes and burgs, take effect when you regenerate Production or Economy. Apply in a state's taxes dialog or in the good editor offers to recalculate the day right away.
