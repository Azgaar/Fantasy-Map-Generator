# Hungarian glossary

Terms every `hu.json` string uses the same way. Rules for all catalogs are in
[docs/architecture/translation.md](../../../docs/architecture/translation.md).

## Style

- Address the user formally and impersonally, with no pronoun: “Biztosan törli a települést?”, “Kattintson a szerkesztéshez”.
- Buttons and menu items are the bare verb or noun: “Térkép mentése”, “Összes törlése”.
- Tooltips use the “Kattintson a … ” form or a noun phrase: “Kattintson a rendezéshez”.
- Dialog titles and editor names are noun phrases: “Kultúraszerkesztő”, “Folyók áttekintése”.
- Quotes are „…”. Capitalize only the first word of a label: “Kultúraszerkesztő”, not “Kultúra Szerkesztő”.
- Keys keep their keyboard names: Ctrl, Shift, Alt, Delete, Enter, Esc; Space is “Szóköz”.
  Key hints use a dash: “Esc — mégse”, “Shift + kattintás — …”.
- Numbers and values stay as placeholders; a unit or suffix attaches with a hyphen where Hungarian needs it only if the placeholder is a word, otherwise rephrase (“Cellák száma: {{cells}}”).
- Shorten only where the label must fit: “Átl. ár”, “Súgó mérete”, “Államnevek”.
- Link text inserted into a sentence stays in the nominative; prefer wording that needs no suffix (“a {{- patreon}} oldalán”).
- Azgaar is **Azgaar** (suffixes with a hyphen: “Azgaar-nak”); the assistant is “Azgaar asszisztens”.
- Brand and product names stay: FMG, Armoria, Dropbox, Discord, Google.
- The product names are translated: “Fantasy Térképgenerátor”, in full “Azgaar Fantasy Térképgenerátora”.

## Map

| English                         | Hungarian                               | Note                                              |
| ------------------------------- | --------------------------------------- | ------------------------------------------------- |
| map                             | térkép                                  |                                                   |
| burg                            | település                               | any settlement; “város” only in flavour text      |
| capital                         | főváros                                 |                                                   |
| port                            | kikötő                                  |                                                   |
| state                           | állam                                   |                                                   |
| province                        | tartomány                               |                                                   |
| culture                         | kultúra                                 |                                                   |
| religion                        | vallás                                  |                                                   |
| namesbase                       | névbázis                                |                                                   |
| heightmap                       | magassági térkép                        | the layer is “Magasság”                           |
| template (heightmap)            | sablon                                  |                                                   |
| cell                            | cella                                   |                                                   |
| grid                            | rács                                    |                                                   |
| seed                            | kezdőérték                              |                                                   |
| biome                           | bióm                                    |                                                   |
| feature (island, lake…)         | földrajzi objektum                      | “objektum” where the context is clear             |
| continent / island / isle       | kontinens / sziget / szigetecske        |                                                   |
| lake / sea / ocean / gulf       | tó / tenger / óceán / öböl              |                                                   |
| freshwater / salt lake          | édesvízi tó / sós tó                    |                                                   |
| coastline / coast, shore        | partvonal / part                        |                                                   |
| coastal                         | tengerparti                             |                                                   |
| river / source / mouth          | folyó / forrás / torkolat               |                                                   |
| route / road / trail / sea lane | útvonal / út / ösvény / tengeri útvonal | “útvonal” also for a pathfinder result            |
| off-road                        | terepen                                 |                                                   |
| elevation, height / depth       | magasság / mélység                      |                                                   |
| sea level                       | tengerszint                             |                                                   |
| depression / range (template)   | mélyedés / hegylánc                     |                                                   |
| precipitation                   | csapadék                                |                                                   |
| temperature                     | hőmérséklet                             |                                                   |
| population / rural / urban      | népesség / vidéki / városi              |                                                   |
| area                            | terület                                 |                                                   |
| relief, relief icon             | domborzati ikonok, domborzati ikon      | pictures, not landform; a bare “Relief” label is “Domborzat” |
| relief pool / relief set        | domborzatikon-készlet / domborzati ikonkészlet |                                            |
| relief rule                     | domborzati szabály                      |                                                   |
| contours / hachures             | szintvonalak / vonalkázás               |                                                   |
| marker / marker type            | jelölő / jelölőtípus                    |                                                   |
| pin (marker shape)              | tű                                      |                                                   |
| label / label group             | felirat / feliratcsoport                |                                                   |
| zone                            | zóna                                    |                                                   |
| emblem, COA                     | címer                                   |                                                   |
| charge / tincture / field       | címerkép / zománc / mező                | heraldic terms                                    |
| division / ordinary             | pajzsosztás / ékítmény                  |                                                   |
| shield                          | pajzs                                   |                                                   |
| note / legend                   | jegyzet / legenda                       |                                                   |
| submap                          | részletérkép                            |                                                   |
| neutral lands                   | semleges területek                      |                                                   |
| neutrals / wildlands (names)    | not translated                          | map content                                       |
| expansionism                    | terjeszkedés                            |                                                   |
| full name / short name          | teljes név / rövid név                  |                                                   |
| state form / province form      | államforma / tartományforma             |                                                   |
| origin (culture, religion)      | eredet                                  |                                                   |
| deity / believers               | istenség / hívők                        |                                                   |
| folk / organized religion       | népi vallás / szervezett vallás         |                                                   |
| cult / heresy                   | kultusz / eretnekség                    |                                                   |

## Politics, military, economy

| English                          | Hungarian                                |
| -------------------------------- | ---------------------------------------- |
| diplomacy / relations            | diplomácia / kapcsolatok                 |
| ally / friendly / neutral        | szövetséges / barátságos / semleges      |
| suspicion / rival / enemy        | gyanakvás / riválisa / ellenség          |
| vassal / suzerain                | vazallus / hűbérúr                       |
| military (forces)                | haderő                                   |
| regiment                         | ezred                                    |
| army / fleet / navy              | hadsereg / flotta / haditengerészet      |
| unit (military)                  | egység                                   |
| unit (measure)                   | mértékegység                             |
| crew                             | legénység                                |
| battle / attacker / defender     | csata / támadó / védő                    |
| journey / segment / stay         | utazás / szakasz / tartózkodás           |
| transport type / domain          | közlekedési mód / közeg                  |
| market                           | piac                                     |
| good / goods                     | áru / áruk                               |
| raw / manufactured good          | nyersanyag / késztermék                  |
| recipe / ingredient              | recept / összetevő                       |
| production                       | termelés                                 |
| stock                            | készlet                                  |
| demand / demand coverage         | kereslet / keresletfedezet               |
| supply                           | kínálat                                  |
| deal / trade                     | üzlet / kereskedelem                     |
| price / base price               | ár / alapár                              |
| wealth / gross product           | gazdagság / bruttó termék                |
| treasury                         | kincstár                                 |
| sales tax / poll tax             | forgalmi adó / fejadó                    |

## Interface

| English                          | Hungarian                                |
| -------------------------------- | ---------------------------------------- |
| layer                            | réteg                                    |
| style / style element            | stílus / stíluselem                      |
| preset (style) / layers preset   | előbeállítás / rétegkészlet              |
| options / settings               | beállítások                              |
| tools / editor / overview        | eszközök / szerkesztő / áttekintés       |
| chart / hierarchy                | diagram / hierarchia                     |
| generate / regenerate            | generálás / újragenerálás                |
| lock / unlock                    | zárolás / feloldás                       |
| locked / unlocked                | zárolt / feloldott                       |
| undo / redo                      | visszavonás / ismétlés                   |
| toggle                           | megjelenítés/elrejtés, be/ki             |
| save / load                      | mentés / betöltés                        |
| Load / New Map / Export (menu buttons) | Megnyitás / Új / Export — short to fit the menu's bottom row |
| UI tour                          | bemutató                                 |
| download / upload                | letöltés / feltöltés                     |
| export / import                  | exportálás / importálás                  |
| icon / icon set                  | ikon / ikonkészlet                       |
| custom icon / icon library       | egyéni ikon / ikonkönyvtár               |
| custom (font, name, scheme)      | egyéni                                   |
| glyph                            | glifa                                    |
| brush                            | ecset                                    |
| opacity / stroke / fill          | átlátszatlanság (label: opacitás) / körvonal / kitöltés |
| scale bar / compass rose         | méretarány-vonalzó (layer: méretarány) / szélrózsa |
| measurer, ruler                  | mérő                                     |
| preview                          | előnézet                                 |
| zoom / pan                       | nagyítás / eltolás                       |
| Azgaar Assistant                 | Azgaar asszisztens                       |
| chat / proposal / tier           | csevegés / javaslat / szint              |
| guest / member / key             | vendég / tag / kulcs                     |
| provider / API key               | szolgáltató / API-kulcs                  |
