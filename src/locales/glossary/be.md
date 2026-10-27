# Belarusian glossary

Terms every `be.json` string uses the same way. Rules for all catalogs are in
[docs/architecture/translation.md](../../../docs/architecture/translation.md).

## Style

- Address the user with **вы**, lowercase mid-sentence: “Вы ўпэўнены, што хочаце выдаліць паселішча?”.
- Buttons and menu items take the infinitive: “Дадаць паселішча”, “Выдаліць усё”.
- Tooltips take the polite imperative: “Націсніце, каб змяніць маркер”, “Націсніце для сартавання па …”.
- Dialog titles and editor names: “Рэдагаванне …”, “Рэдактар …”; inline actions use “Змяніць …”.
- Quotes are “ ”. Always write **ў** and **і** where Belarusian needs them: “Азёры”, “ўзбярэжжа”, “вышыня”.
- The apostrophe in words like “аб’ект” is ’ (U+2019).
- Key hints use a dash: “Esc — адмена”, “Shift + клік — выбраць іншую дзяржаву”.
  Keys keep Latin names: Ctrl, Shift, Alt, Enter, Esc, Space.
- Abbreviate only where the label must fit a narrow button: “Захав.”, “Загр.”.
- Azgaar is **Азгаар**, declined: “Памочнік Азгаара”, “Напісаць Азгаару”.
  The product is “Генератар фэнтэзійных мап Азгаара”.
- Other brand and product names stay: Armoria, FMG, Dropbox, Discord, Google, Cartography Assets.

## Map

| English                       | Belarusian                         | Note                                                  |
| ----------------------------- | ---------------------------------- | ----------------------------------------------------- |
| map                           | мапа                               |                                                       |
| burg                          | паселішча                          | any settlement; “горад” only in flavour text          |
| capital                       | сталіца                            |                                                       |
| port                          | порт                               |                                                       |
| state                         | дзяржава                           |                                                       |
| province                      | правінцыя                          |                                                       |
| culture                       | культура                           |                                                       |
| religion                      | рэлігія                            |                                                       |
| namesbase                     | база імён                          | the tab and the culture field are “Імёны”             |
| heightmap                     | вышыні                | the layer and the editor are “Вышыні”                                 |
| template (heightmap)          | шаблон                             |                                                       |
| cell                          | клетка                             |                                                       |
| grid                          | сетка                              |                                                       |
| seed                          | зярно                              | the map seed; “сід” is retired                        |
| biome                         | біём                               |                                                       |
| feature (island, lake…)       | геаб’ект                           |                                                       |
| continent / island / isle     | кантынент / востраў / востраўчык   |                                                       |
| lake / sea / ocean / gulf     | возера / мора / акіян / заліў      |                                                       |
| freshwater / salt lake        | прэсная вада / салёнае возера      |                                                       |
| coastline / coast, shore      | узбярэжжа / бераг                  | “каля берага” for near-coast land                     |
| coastal                       | прыбярэжны                         |                                                       |
| river / source / mouth        | рака / выток / вусце               |                                                       |
| route / road / off-road       | шлях / гасцінец / бяздарожжа       | “маршрут” only a pathfinder result                    |
| elevation, height / depth     | вышыня / глыбіня                   |                                                       |
| sea level                     | узровень мора                      |                                                       |
| depression / range (template) | упадзіна / хрыбет                  |                                                       |
| precipitation                 | ападкі                             |                                                       |
| temperature                   | тэмпература                        |                                                       |
| population / rural / urban    | насельніцтва / сельскае / гарадское | |
| area                          | плошча                             |                                                       |
| relief                        | рэльеф                             |                                                       |
| relief pool / relief set      | пул рэльефу / набор рэльефу        |                                                       |
| relief rule                   | правіла рэльефу                    |                                                       |
| contours / hachures           | контуры / штрыхоўка                |                                                       |
| marker / marker type          | маркер / тып маркера               |                                                       |
| pin (marker shape)            | булавка                            |                                                       |
| label                         | надпіс                             | never “метка” or “подпіс”                             |
| label group                   | група надпісаў                     |                                                       |
| zone                          | зона                               |                                                       |
| emblem, COA                   | герб                               | “эмблема” only for a picture emblem                   |
| charge / tincture / field     | фігура / тынктура / поле           | heraldic terms                                        |
| shield                        | шчыт                               |                                                       |
| note / legend                 | нататка / легенда                  |                                                       |
| submap                        | падкарта                           |                                                       |
| neutral lands                 | нэўтральныя землі                  |                                                       |
| expansionism                  | экспансія                          |                                                       |
| full name / short name        | поўная назва / кароткая назва      | “назва” for places and things, “імя” for people       |
| state form / province form    | форма кіравання / форма правінцыі  |                                                       |
| origin (culture, religion)    | крыніца                            |                                                       |
| deity / believers             | боства / вернікі                   |                                                       |
| folk / organized religion     | народная / арганізаваная рэлігія   |                                                       |
| cult / heresy                 | культ / ерась                      |                                                       |

## Politics, military, economy

| English                      | Belarusian                         |
| ---------------------------- | ---------------------------------- |
| diplomacy / relations        | дыпламатыя / адносіны              |
| ally / friendly / neutral     | саюзнік / прыязны / нэўтральны     |
| suspicion / rival / enemy    | падазрэнне / супернік / вораг      |
| vassal / suzerain            | васал / сюзерэн                    |
| military (forces)            | войскі, ваенныя сілы               |
| regiment                     | полк                               |
| army / fleet                 | армія / флот                       |
| unit (military)              | род войскаў                        |
| unit (measure)               | адзінка (вымярэння)                |
| crew                         | экіпаж                             |
| battle / attacker / defender | бітва / атакуючыя / абаронцы       |
| journey / segment / stay     | падарожжа / адрэзак / прыпынак     |
| transport type / domain      | тып транспарту / асяродак          |
| market                       | рынак                              |
| good / goods                 | тавар / тавары                     |
| raw / manufactured good      | сыравіна / выраблены тавар         |
| recipe / ingredient          | рэцэпт / інгрэдыент                |
| production                   | вытворчасць                        |
| stock                        | запас                              |
| demand / demand coverage     | попыт / покрыццё попыту            |
| deal / trade                 | угода / гандаль                    |                                                       |
| price / base price           | цана / базавая цана                |
| wealth / gross product       | багацце / валавы прадукт           |
| treasury                     | казна                              |
| sales tax / poll tax         | падатак з продажаў / падушны падатак |
| prosperity / living standards | дабрабыт / узровень жыцця            |
| desolate / destitute / poor / modest / comfortable / thriving / affluent / opulent / splendid / peerless | разорэнне / галеча / беднасць / сціплы дастатак / дастатак / росквіт / заможнасць / раскоша / пышнасць / небывалае багацце |
| consumption / need / want    | спажыванне / патрэба / забаўка       |
| product (economy) / townspeople / rural people | прадукт / гараджане / сельскія жыхары |
| exports / imports / trade balance | вываз / увоз / гандлёвы баланс       |
| inequality / tax burden      | няроўнасць / падатковы цяжар         |
| sector: rural / manufacturing / trade | вёска / рамёствы / гандаль           |
| economy type: agrarian / artisan / mercantile | аграрная / рамесная / гандлёвая      |

## Interface

| English                        | Belarusian                              |
| ------------------------------ | --------------------------------------- |
| layer                          | слой                                    |
| style / style element          | стыль / элемент стылю                   |
| preset (style) / layers preset | прэсет / набор слаёў                  |
| options / settings             | налады                                  |
| tools / editor / overview      | інструменты / рэдактар / агляд          |
| chart / hierarchy              | графік / іерархія                       |
| generate                       | згенераваць (new map)                   |
| regenerate                     | перагенераваць; “нанава стварыць” for one name |
| lock / unlock                  | зафіксаваць / разфіксаваць              |
| locked / unlocked              | зафіксаваны / незафіксаваны             |
| undo / redo                    | адмяніць / паўтарыць                    |
| toggle                         | уключыць/выключыць                      |
| save / load                    | захаваць / загрузіць                    |
| download / upload              | спампаваць / запампаваць                |
| export / import                | экспарт / імпарт                        |
| icon / custom icon             | іконка / свая іконка               |                                                       |
| custom (font, name, scheme)    | свой                                    |
| brush / stroke (brush)         | пэндзаль                                |
| opacity / stroke / fill        | непразрыстасць / контур / запаўненне    |
| scale bar / compass rose       | шкала (layer) / ружа вятроў            |
| measurer, ruler                | лінейка                                 |
| preview                        | папярэдні прагляд                       |
| zoom / pan                     | маштаб, наблізіць / рухаць         |
| Azgaar Assistant               | Памочнік Азгаара                        |
| chat / provider / API key      | чат / правайдэр / ключ API              |
| view-only                      | толькі прагляд                          |

## Narrow labels

Column headers and layer names sit in fixed-width cells, so these short forms are used where the full word does not fit. Check them in the audit after a change.

| English                    | Belarusian | Where                          |
| -------------------------- | ---------- | ------------------------------ |
| burgs (column)             | Пас.       | province, market headers       |
| area (column)              | Пл.        | province, state headers        |
| population (column)        | Насельніцтва | headers, military, biomes      |
| habitability (column)      | Прыдатн.   | biomes header                  |
| total time (column)        | Час        | journeys header                |
| value (column)             | Кошт       | markets header                 |
| war alert (column)         | Трывога    | military header                |
| map size (emblem)          | Памер      | emblem editor                  |
| viewport size              | Памер акна | options                        |

