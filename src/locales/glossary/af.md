# Afrikaans glossary

Terms every `af.json` string uses the same way. Rules for all catalogs are in
[docs/architecture/translation.md](../../../docs/architecture/translation.md).

## Style

- Address the user with **jy**: “Klik om die nedersetting te wysig”, “Is jy seker jy wil … verwyder?”.
- Buttons and menu items take the imperative, which is the verb stem: “Stoor kaart”, “Verwyder alles”.
  Separable verbs split around the object: “Voeg nedersetting by”, “Laai kaart af”.
- Tooltips are a short imperative or a noun phrase: “Klik om volgens … te sorteer”.
- Capitalize only the first word of a label: “Kultuurredigeerder”, “Wys alle lae”.
- Compounds are written as one word (“reliëfreël”, “hoogtekaart”); use a hyphen after an
  abbreviation, a number or a brand: “API-sleutel”, “3D-voorskou”, “Azgaar-assistent”.
- Quotes are “…”; the apostrophe is ’ (“’n kaart”, “Azgaar’s”). Keys keep their English names:
  Ctrl, Shift, Alt, Enter, Esc, Space.
- Brand and product names stay: Azgaar, Armoria, Dropbox, Discord.
- The product names are translated: “Fantasiekaartgenerator”, in full “Azgaar se Fantasiekaartgenerator”; the assistant is “Azgaar-assistent”.

## Map

| English                       | Afrikaans                          | Note                                  |
| ----------------------------- | ---------------------------------- | ------------------------------------- |
| map                           | kaart                              |                                       |
| burg                          | nedersetting (pl. nedersettings)   | any settlement; never “burg”          |
| capital                       | hoofstad                           |                                       |
| port                          | hawe                               |                                       |
| state                         | staat (pl. state)                  |                                       |
| province                      | provinsie                          |                                       |
| culture                       | kultuur (pl. kulture)              |                                       |
| religion                      | godsdiens (pl. godsdienste)        |                                       |
| namesbase                     | naambasis (pl. naambasisse)        |                                       |
| heightmap                     | hoogtekaart                        |                                       |
| template (heightmap)          | sjabloon                           |                                       |
| cell                          | sel (pl. selle)                    |                                       |
| grid                          | rooster                            |                                       |
| seed                          | saadwaarde                         |                                       |
| biome                         | bioom (pl. biome)                  |                                       |
| feature (island, lake…)       | geo-objek                          | “objek” where the context is clear    |
| continent / island / isle     | kontinent / eiland / eilandjie     |                                       |
| lake / sea / ocean / gulf     | meer / see / oseaan / golf         |                                       |
| freshwater / salt lake        | varswater / soutmeer               |                                       |
| coastline / coast / shore     | kuslyn / kus / oewer               |                                       |
| river / source / mouth        | rivier / bron / monding            |                                       |
| route / road / trail / sea lane | roete / pad / voetpad / seeroete |                                       |
| elevation, height / depth     | hoogte / diepte                    |                                       |
| sea level                     | seevlak                            |                                       |
| precipitation                 | neerslag                           |                                       |
| temperature                   | temperatuur                        |                                       |
| population / rural / urban    | bevolking / landelik / stedelik    |                                       |
| area                          | oppervlakte                        |                                       |
| relief                        | reliëf                             |                                       |
| relief pool / relief rule     | reliëfpoel / reliëfreël            |                                       |
| contours / hachures           | kontoerlyne / arsering             |                                       |
| marker / pin                  | merker / speld                     |                                       |
| label / label group           | etiket / etiketgroep               |                                       |
| zone                          | sone                               |                                       |
| emblem / coat of arms         | wapen                              | “embleem” only for a picture emblem   |
| charge / tincture / field     | wapenfiguur / tinktuur / veld      |                                       |
| division / ordinary / shield  | verdeling / ereteken / skild       |                                       |
| note / legend                 | nota / legende                     |                                       |
| submap                        | subkaart                           |                                       |
| expansionism                  | ekspansionisme                     |                                       |
| state form / province form    | staatsvorm / provinsievorm         |                                       |
| origin (culture, religion)    | oorsprong                          |                                       |
| deity / believers             | godheid / gelowiges                |                                       |
| folk / organized religion     | volksgodsdiens / georganiseerde godsdiens |                                |
| cult / heresy                 | kultus / kettery                   |                                       |
| neutrals / wildlands          | not translated                     | map content                           |

## Politics, military, economy

| English                          | Afrikaans                              |
| -------------------------------- | -------------------------------------- |
| diplomacy / relations            | diplomasie / betrekkinge               |
| ally / friendly / neutral        | bondgenoot / vriendelik / neutraal     |
| suspicion / rival / enemy        | agterdog / mededinger / vyand          |
| vassal / suzerain                | vasal / leenheer                       |
| military / regiment              | weermag / regiment                     |
| army / fleet / navy              | leër / vloot / vloot                   |
| unit (military) / crew           | eenheid / bemanning                    |
| battle / attacker / defender     | geveg / aanvaller / verdediger         |
| journey / segment / stay         | reis / segment / verblyf               |
| transport type                   | vervoersoort                           |
| market                           | mark                                   |
| good / goods                     | produk / produkte                      |
| raw / manufactured good          | grondstof / vervaardigde produk        |
| recipe / ingredient              | resep / bestanddeel                    |
| production / stock               | produksie / voorraad                   |
| demand / supply / demand coverage | vraag / aanbod / vraagdekking         |
| price / base price               | prys / basisprys                       |
| wealth / gross product           | rykdom / bruto produk                  |
| deal / trade                     | transaksie / handel                    |
| treasury                         | skatkis                                |
| sales tax / poll tax             | verkoopbelasting / hoofbelasting       |

## Interface

| English                        | Afrikaans                         |
| ------------------------------ | --------------------------------- |
| layer                          | laag (pl. lae)                    |
| style / style element          | styl / stylelement                |
| preset                         | voorinstelling                    |
| options / settings             | opsies / instellings              |
| tools / editor / overview      | gereedskap / redigeerder / oorsig |
| chart / hierarchy              | grafiek / hiërargie               |
| generate / regenerate          | genereer / hergenereer            |
| lock / unlock / locked         | sluit / ontsluit / gesluit        |
| undo / redo                    | ontdoen / herdoen                 |
| toggle (a layer)               | wys/versteek                      |
| save / load                    | stoor / laai                      |
| download / upload              | aflaai / oplaai                   |
| export / import                | uitvoer / invoer                  |
| edit / remove / add            | wysig / verwyder / voeg by        |
| icon / icon set                | ikoon / ikoonstel                 |
| custom icon / icon library     | eie ikoon / ikoonbiblioteek       |
| custom (font, name, scheme)    | eie                               |
| glyph / brush                  | glief / kwas                      |
| opacity / stroke / fill        | ondeursigtigheid (label: opasiteit) / lyn / vulling |
| scale bar / compass rose       | skaalbalk / kompasroos            |
| measurer, ruler                | meter, liniaal                    |
| preview / zoom / pan           | voorskou / zoem / skuif           |
| Azgaar Assistant               | Azgaar-assistent                  |
| chat / proposal / tier         | klets / voorstel / vlak           |
| guest / member / API key       | gas / lid / API-sleutel           |
| provider                       | verskaffer                        |
