# Ukrainian glossary

Terms every `uk.json` string uses the same way. Rules for all catalogs are in
[docs/architecture/translation.md](../../../docs/architecture/translation.md).

## Style

- Address the user with the formal **Ви** in questions and messages: “Ви впевнені, що хочете видалити поселення?”.
  Buttons, menu items and tooltips take the infinitive or the imperative: “Зберегти”, “Клацніть, щоб змінити”.
- Quotes are «…» in place of “ ” in running text.
- Labels start with a capital letter only: “Редактор культур”, “Огляд річок”.
- Dialog titles and editor names are noun phrases: “Редактор культур”, “Огляд міток”; inline actions use “Змінити”.
- Keys keep their keyboard names: Ctrl, Shift, Alt, Enter, Esc, Space.
- Brand and product names stay Latin: Fantasy Map Generator, Azgaar, Armoria, Dropbox, Discord, Google, FMG.
- Keep labels short for narrow menu tabs; drop a word before dropping a meaning.

## Map

| English                       | Ukrainian                 | Note                                              |
| ----------------------------- | ------------------------- | ------------------------------------------------- |
| map                           | карта                     |                                                   |
| burg                          | поселення                 | any settlement, from village to capital           |
| capital                       | столиця                   |                                                   |
| port                          | порт                      |                                                   |
| state                         | держава                   | “держава” for the polity; “стан” is never used    |
| province                      | провінція                 |                                                   |
| culture                       | культура                  |                                                   |
| religion                      | релігія                   |                                                   |
| namesbase                     | база назв                 | the tab and the culture field are “Назви”         |
| heightmap                     | карта висот               | the layer is “Висота”                             |
| template (heightmap)          | шаблон                    |                                                   |
| cell                          | клітинка                  |                                                   |
| grid                          | сітка                     |                                                   |
| seed                          | сід                       |                                                   |
| biome                         | біом                      |                                                   |
| feature (island, lake…)       | елемент                   |                                                   |
| continent / island / isle     | континент / острів / острівець |                                              |
| lake / sea / ocean / gulf     | озеро / море / океан / затока |                                           |
| coastline / coast, shore      | узбережжя / берег         |                                                   |
| river / source / mouth        | річка / витік / гирло     |                                                   |
| route / road / off-road       | маршрут / дорога / поза дорогами |                                            |
| elevation, height / depth     | висота / глибина          |                                                   |
| sea level                     | рівень моря               |                                                   |
| precipitation                 | опади                     |                                                   |
| temperature                   | температура               |                                                   |
| population / rural / urban    | населення / сільське / міське |                                             |
| relief                        | рельєф                    |                                                   |
| relief pool / relief rule     | пул рельєфу / правило рельєфу |                                           |
| contours / hachures           | горизонталі / штрихування |                                                   |
| marker / marker type          | маркер / тип маркера      |                                                   |
| label                         | мітка                     | “написи” for states and burgs on the map          |
| label group                   | група міток               |                                                   |
| zone                          | зона                      |                                                   |
| emblem, COA                   | герб                      | heraldic arms                                     |
| charge / tincture / field     | фігура / колір / поле     | heraldic terms                                    |
| note / legend                 | нотатка / легенда         |                                                   |
| submap                        | субкарта                  |                                                   |
| full name / short name        | повна назва / коротка назва | “назва” for places and things                   |
| origin (culture, religion)    | походження                |                                                   |
| deity / believers             | божество / вірні          |                                                   |
| folk / organized religion     | народна / організована релігія |                                          |
| cult / heresy                 | культ / єресь             |                                                   |

## Politics, military, economy

| English                      | Ukrainian                  |
| ---------------------------- | -------------------------- |
| diplomacy / relations        | дипломатія / відносини     |
| ally / friendly / neutral    | союзник / дружній / нейтральний |
| suspicion / rival / enemy    | підозра / суперник / ворог |
| vassal / suzerain            | васал / сюзерен            |
| military (forces)            | військові / військові сили |
| regiment                     | полк                       |
| army / fleet                 | армія / флот               |
| unit (military)              | підрозділ                  |
| crew                         | екіпаж                     |
| battle / attacker / defender | бій / атакуючі / захисники |
| journey / segment / stay     | подорож / ділянка / зупинка |
| transport type / domain      | тип транспорту / сфера     |
| market                       | ринок                      |
| good / goods                 | товар / товари             |
| raw / manufactured good      | сировина / виготовлений товар |
| recipe / ingredient          | рецепт / інгредієнт        |
| production                   | виробництво                |
| stock                        | запас                      |
| demand / demand coverage     | попит / покриття попиту    |
| deal / trade                 | угода / торгівля           |
| price / base price           | ціна / базова ціна         |
| wealth / gross product       | багатство / валовий продукт |
| treasury                     | скарбниця                  |
| sales tax / poll tax         | податок з продажів / подушний податок |

## Interface

| English                        | Ukrainian                          |
| ------------------------------ | ---------------------------------- |
| layer                          | шар                                |
| style / style element          | стиль / елемент стилю              |
| preset / layers preset         | пресет / пресет шарів              |
| options / settings             | параметри / налаштування           |
| tools / editor / overview      | інструменти / редактор / огляд     |
| generate                       | згенерувати                        |
| regenerate                     | перегенерувати                     |
| lock / unlock                  | заблокувати / розблокувати         |
| undo / redo                    | скасувати / повторити              |
| save / load                    | зберегти / завантажити             |
| download / upload              | завантажити / вивантажити          |
| export / import                | експортувати / імпортувати         |
| icon / custom icon             | іконка / власна іконка             |
| brush / stroke                 | пензель / штрих                    |
| opacity / stroke / fill        | непрозорість / контур / заливка    |
| scale bar / compass rose       | масштабна лінійка / компасна троянда |
| preview                        | попередній перегляд                |
| zoom / pan                     | масштаб / переміщення              |
| Azgaar Assistant               | Azgaar Assistant                   |
| chat / provider / API key      | чат / провайдер / ключ API         |
