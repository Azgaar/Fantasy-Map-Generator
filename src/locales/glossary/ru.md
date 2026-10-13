# Russian glossary

Terms every `ru.json` string uses the same way. Rules for all catalogs are in
[docs/architecture/translation.md](../../../docs/architecture/translation.md).

## Style

- Address the user with **вы**, lowercase mid-sentence: “Вы уверены, что хотите удалить поселение?”.
- Buttons and menu items take the infinitive: “Добавить поселение”, “Удалить всё”.
- Tooltips take the polite imperative: “Нажмите, чтобы изменить маркер”, “Нажмите для сортировки по …”.
- Dialog titles and editor names: “Редактировать …”, “Редактор …”; inline actions use “Изменить …”.
- Quotes are «…». Always write **ё**: “Озёра”, “Лёд”, “незакреплённые”.
- Key hints use a dash: “Esc — отмена”, “Shift + клик — выбрать другую страну”.
  Keys keep Latin names: Ctrl, Shift, Alt, Enter, Esc, Space.
- Abbreviate only where the label must fit a narrow button: “Сохр.”, “Загруз.”, “Ср. цена”.
- Azgaar is **Азгаар**, declined: “Ассистент Азгаара”, “Написать Азгаару”.
  The product is “Генератор Фэнтезийных Карт от Азгаара”.
- Other brand and product names stay: Armoria, FMG, Dropbox, Discord, Google, Cartography Assets.

## Map

| English                       | Russian                            | Note                                                      |
| ----------------------------- | ---------------------------------- | --------------------------------------------------------- |
| map                           | карта                              |                                                           |
| burg                          | поселение                          | any settlement; “город” only in flavour text              |
| capital                       | столица                            |                                                           |
| port                          | порт                               |                                                           |
| state                         | страна                             | never “государство”                                       |
| province                      | провинция                          |                                                           |
| culture                       | культура                           |                                                           |
| religion                      | религия                            |                                                           |
| namesbase                     | база имён (pl. базы имён)          | the tab and the culture field are “Имена”                 |
| heightmap                     | карта высот                        | the layer is “Высоты”                                     |
| template (heightmap)          | шаблон                             |                                                           |
| cell                          | ячейка                             |                                                           |
| grid                          | сетка                              |                                                           |
| seed                          | сид                                |                                                           |
| biome                         | биом                               |                                                           |
| feature (island, lake…)       | объект                             |                                                           |
| continent / island / isle     | континент / остров / островок      |                                                           |
| lake / sea / ocean / gulf     | озеро / море / океан / залив       |                                                           |
| freshwater / salt lake        | пресное / солёное озеро            |                                                           |
| coastline / coast, shore      | береговая линия / берег            | “у побережья” for near-coast land                         |
| coastal                       | прибрежный                         |                                                           |
| river / source / mouth        | река / исток / устье               |                                                           |
| route / road / off-road       | путь / дорога / бездорожье         | “путь” is the generic; “маршрут” only a pathfinder result |
| elevation, height / depth     | высота / глубина                   |                                                           |
| sea level                     | уровень моря                       |                                                           |
| depression / range (template) | впадина / хребет                   |                                                           |
| precipitation                 | осадки                             |                                                           |
| temperature                   | температура                        |                                                           |
| population / rural / urban    | население / сельское / городское   |                                                           |
| area                          | площадь                            |                                                           |
| relief                        | рельеф                             |                                                           |
| relief pool / relief set      | пул рельефа / набор рельефа        |                                                           |
| relief rule                   | правило рельефа                    |                                                           |
| contours / hachures           | горизонтали / штриховка            |                                                           |
| marker / marker type          | маркер / тип маркера               |                                                           |
| pin (marker shape)            | булавка                            |                                                           |
| label                         | надпись                            | never “метка” or “подпись”                                |
| label group                   | группа надписей                    |                                                           |
| zone                          | зона                               |                                                           |
| emblem, COA                   | эмблема                            | “герб” only for Armoria's description                     |
| charge / tincture / field     | фигура / тинктура / поле           | heraldic terms                                            |
| shield                        | щит                                |                                                           |
| note / legend                 | заметка / легенда                  |                                                           |
| submap                        | подкарта                           |                                                           |
| neutral lands                 | нейтральные земли                  |                                                           |
| expansionism                  | экспансия                          |                                                           |
| full name / short name        | полное название / краткое название | “название” for places and things, “имя” for people        |
| state form / province form    | форма правления / форма провинции  |                                                           |
| origin (culture, religion)    | источник                           |                                                           |
| deity / believers             | божество / верующие                |                                                           |
| folk / organized religion     | народная / организованная религия  |                                                           |
| cult / heresy                 | культ / ересь                      |                                                           |

## Politics, military, economy

| English                      | Russian                               |
| ---------------------------- | ------------------------------------- |
| diplomacy / relations        | дипломатия / отношения                |
| ally / friendly / neutral    | союзник / дружба / нейтралитет        |
| suspicion / rival / enemy    | подозрение / соперник / враг          |
| vassal / suzerain            | вассал / сюзерен                      |
| military (forces)            | войска, военные силы                  |
| regiment                     | полк                                  |
| army / fleet                 | армия / флот                          |
| unit (military)              | род войск                             |
| unit (measure)               | единица (измерения)                   |
| crew                         | экипаж                                |
| battle / attacker / defender | битва / атакующие / обороняющиеся     |
| journey / segment / stay     | путешествие / отрезок / стоянка       |
| transport type / domain      | тип транспорта / среда                |
| market                       | рынок                                 |
| good / goods                 | товар / товары                        |
| raw / manufactured good      | сырьё / изделие (произведённый товар) |
| recipe / ingredient          | рецепт / ингредиент                   |
| production                   | производство                          |
| stock                        | запас                                 |
| demand / demand coverage     | спрос / покрытие спроса               |
| deal / trade                 | сделка / торговля                     |
| price / base price           | цена / базовая цена                   |
| wealth / gross product       | богатство / валовой продукт           |
| treasury                     | казна                                 |
| sales tax / poll tax         | налог с продаж / подушный налог       |

## Interface

| English                        | Russian                                    |
| ------------------------------ | ------------------------------------------ |
| layer                          | слой                                       |
| style / style element          | стиль / элемент стиля                      |
| preset (style) / layers preset | пресет / набор слоёв                       |
| options / settings             | настройки                                  |
| tools / editor / overview      | инструменты / редактор / обзор             |
| chart / hierarchy              | график / иерархия                          |
| generate                       | сгенерировать (a new map)                  |
| regenerate                     | пересоздать; “заново создать” for one name |
| lock / unlock                  | закрепить / открепить                      |
| locked / unlocked              | закреплённый / незакреплённый              |
| undo / redo                    | отменить / повторить                       |
| toggle                         | включить/выключить                         |
| save / load                    | сохранить / загрузить                      |
| download / upload              | скачать / загрузить                        |
| export / import                | экспорт / импорт                           |
| icon / custom icon             | иконка / своя иконка                       |
| custom (font, name, scheme)    | свой                                       |
| brush / stroke (brush)         | кисть                                      |
| opacity / stroke / fill        | непрозрачность / обводка / заливка         |
| scale bar / compass rose       | масштабная линейка / роза ветров           |
| measurer, ruler                | линейка                                    |
| preview                        | предпросмотр                               |
| zoom / pan                     | масштаб, приблизить / сдвиг                |
| Azgaar Assistant               | Ассистент Азгаара                          |
| chat / provider / API key      | чат / провайдер / API-ключ                 |
