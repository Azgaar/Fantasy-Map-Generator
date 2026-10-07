# Polish glossary

Terms every `pl.json` string uses the same way. Rules for all catalogs are in
[docs/architecture/translation.md](../../../docs/architecture/translation.md).

## Style

- Address the user with **ty**: “Czy na pewno chcesz usunąć osadę?”, “Kliknij, aby edytować osadę”.
- Buttons and menu items take the imperative, as Polish software does: “Zapisz mapę”, “Usuń wszystko”.
- Tooltips take the imperative: “Kliknij, aby …”, “Kliknij, aby posortować według …”.
- Dialog titles and editor names are noun phrases: “Edytor kultur”, “Przegląd rzek”.
- Quotes are „…”. Capitalize only the first word of a label: “Edytor kultur”, not “Edytor Kultur”.
- Keys keep their keyboard names: Ctrl, Shift, Alt, Delete, Enter, Esc; Space is “Spacja”.
  Key hints use a dash: “Esc — anuluj”, “Shift + klik — …”.
- Abbreviate or shorten only where the label must fit: “Śr. cena”, “Rozm. podpowiedzi”, “Nazwy państw”.
- Link text inserted into a sentence takes the case the sentence needs (“serwera Discord”); prefer
  wording that keeps a brand link in the nominative (“w serwisie {{- patreon}}”).
- Azgaar is declined: “Asystent Azgaara”, “Napisz do Azgaara”.
- Brand and product names stay: Fantasy Map Generator, FMG, Armoria, Dropbox, Discord, Google.

## Map

| English                         | Polish                                  | Note                                              |
| ------------------------------- | --------------------------------------- | ------------------------------------------------- |
| map                             | mapa                                    |                                                   |
| burg                            | osada (f.)                              | any settlement; “miasto” only in flavour text     |
| capital                         | stolica                                 |                                                   |
| port                            | port                                    |                                                   |
| state                           | państwo (n.)                            |                                                   |
| province                        | prowincja                               |                                                   |
| culture                         | kultura                                 |                                                   |
| religion                        | religia                                 |                                                   |
| namesbase                       | baza nazw (pl. bazy nazw)               |                                                   |
| heightmap                       | mapa wysokości                          | the layer is “Wysokości”                          |
| template (heightmap)            | szablon                                 |                                                   |
| cell                            | komórka                                 |                                                   |
| grid                            | siatka                                  |                                                   |
| seed                            | ziarno                                  |                                                   |
| biome                           | biom                                    |                                                   |
| feature (island, lake…)         | obiekt                                  |                                                   |
| continent / island / isle       | kontynent / wyspa / wysepka             |                                                   |
| lake / sea / ocean / gulf       | jezioro / morze / ocean / zatoka        |                                                   |
| freshwater / salt lake          | jezioro słodkowodne / słone             |                                                   |
| coastline / coast, shore        | linia brzegowa / wybrzeże, brzeg        |                                                   |
| coastal                         | przybrzeżny                             |                                                   |
| river / source / mouth          | rzeka / źródło / ujście                 |                                                   |
| route / road / trail / sea lane | szlak / droga / ścieżka / szlak morski  | “trasa” only for a pathfinder result              |
| off-road                        | bezdroża                                |                                                   |
| elevation, height / depth       | wysokość / głębokość                    |                                                   |
| sea level                       | poziom morza                            |                                                   |
| depression / range (template)   | depresja / pasmo                        |                                                   |
| precipitation                   | opady                                   |                                                   |
| temperature                     | temperatura                             |                                                   |
| population / rural / urban      | ludność / wiejska / miejska             |                                                   |
| area                            | powierzchnia                            |                                                   |
| relief, relief icon             | ikony terenu, ikona terenu              | pictures, not landform; a bare “Relief” label (layer, column) is “Teren” |
| relief pool / relief set        | pula ikon terenu / zestaw ikon terenu   |                                                   |
| relief rule                     | reguła ikon terenu                      |                                                   |
| contours / hachures             | poziomice / kreskowanie                 |                                                   |
| marker / marker type            | znacznik / typ znacznika                |                                                   |
| pin (marker shape)              | pinezka                                 |                                                   |
| label / label group             | etykieta / grupa etykiet                |                                                   |
| zone                            | strefa                                  |                                                   |
| emblem, COA                     | herb                                    |                                                   |
| charge / tincture / field       | godło / barwa / pole                    | heraldic terms                                    |
| division / ordinary             | podział / figura zaszczytna             |                                                   |
| shield                          | tarcza                                  |                                                   |
| note / legend                   | notatka / legenda                       |                                                   |
| submap                          | podmapa                                 |                                                   |
| neutral lands                   | ziemie neutralne                        |                                                   |
| neutrals / wildlands (names)    | not translated                          | map content                                       |
| expansionism                    | ekspansjonizm                           |                                                   |
| full name / short name          | pełna nazwa / krótka nazwa              | “nazwa” for places and things, “imię” for people  |
| state form / province form      | ustrój / forma prowincji                |                                                   |
| origin (culture, religion)      | pochodzenie                             |                                                   |
| deity / believers               | bóstwo / wyznawcy                       |                                                   |
| folk / organized religion       | religia ludowa / zorganizowana          |                                                   |
| cult / heresy                   | kult / herezja                          |                                                   |

## Politics, military, economy

| English                          | Polish                                   |
| -------------------------------- | ---------------------------------------- |
| diplomacy / relations            | dyplomacja / stosunki                    |
| ally / friendly / neutral        | sojusznik / przyjazne / neutralne        |
| suspicion / rival / enemy        | podejrzliwość / rywal / wróg             |
| vassal / suzerain                | wasal / suzeren                          |
| military (forces)                | wojsko, siły zbrojne                     |
| regiment                         | pułk                                     |
| army / fleet / navy              | armia / flota / marynarka                |
| unit (military)                  | jednostka                                |
| unit (measure)                   | jednostka (miary)                        |
| crew                             | załoga                                   |
| battle / attacker / defender     | bitwa / atakujący / obrońcy              |
| journey / segment / stay         | podróż / odcinek / postój                |
| transport type / domain          | środek transportu / środowisko           |
| market                           | rynek                                    |
| good / goods                     | towar / towary                           |
| raw / manufactured good          | surowiec / wyrób                         |
| recipe / ingredient              | receptura / składnik                     |
| production                       | produkcja                                |
| stock                            | zapas                                    |
| demand / demand coverage         | popyt / pokrycie popytu                  |
| supply                           | podaż                                    |
| deal / trade                     | transakcja / handel                      |
| price / base price               | cena / cena bazowa                       |
| wealth / gross product           | bogactwo / produkt brutto                |
| treasury                         | skarbiec                                 |
| sales tax / poll tax             | podatek od sprzedaży / pogłówne          |

## Interface

| English                          | Polish                                   |
| -------------------------------- | ---------------------------------------- |
| layer                            | warstwa                                  |
| style / style element            | styl / element stylu                     |
| preset (style) / layers preset   | preset / zestaw warstw                   |
| options / settings               | opcje / ustawienia                       |
| tools / editor / overview        | narzędzia / edytor / przegląd            |
| chart / hierarchy                | wykres / hierarchia                      |
| generate / regenerate            | generuj / wygeneruj ponownie             |
| lock / unlock                    | zablokuj / odblokuj                      |
| locked / unlocked                | zablokowany / odblokowany                |
| undo / redo                      | cofnij / ponów                           |
| toggle                           | pokaż/ukryj, włącz/wyłącz                |
| save / load                      | zapisz / wczytaj                         |
| Load / New Map / Export (menu buttons) | Otwórz / Generuj / Eksport — short to fit the menu's bottom row |
| UI tour                          | przewodnik                               |
| download / upload                | pobierz / prześlij                       |
| export / import                  | eksportuj / importuj                     |
| icon / icon set                  | ikona / zestaw ikon                      |
| custom icon / icon library       | własna ikona / biblioteka ikon           |
| custom (font, name, scheme)      | własny                                   |
| glyph                            | glif                                     |
| brush                            | pędzel                                   |
| opacity / stroke / fill          | krycie / obrys / wypełnienie             |
| scale bar / compass rose         | podziałka / róża wiatrów                 |
| measurer, ruler                  | linijka                                  |
| preview                          | podgląd                                  |
| zoom / pan                       | powiększenie, przybliż / przesuń         |
| Azgaar Assistant                 | Asystent Azgaara                         |
| chat / proposal / tier           | czat / propozycja / poziom               |
| guest / member / key             | gość / członek / klucz                   |
| provider / API key               | dostawca / klucz API                     |
