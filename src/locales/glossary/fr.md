# French glossary

Terms every `fr.json` string uses the same way. Rules for all catalogs are in
[docs/architecture/translation.md](../../../docs/architecture/translation.md).

## Style

- Address the user with **vous**: “Voulez-vous vraiment supprimer la localité ?”.
- Buttons, menu items and tooltips take the infinitive: “Enregistrer la carte”, “Cliquer pour modifier la localité”.
- Typography: a no-break space (U+00A0) before `; ! ?` and an inner colon, and inside « … » quotes.
  A trailing colon is added in code, so it has none.
- Capitalize only the first word of a label: “Éditeur de cultures”, not “Éditeur de Cultures”.
- **État** (the polity) is always capitalized, so it is never read as “state, condition”.
- Keys are named as on French keyboards: Ctrl, Maj, Alt, Suppr, Entrée, Échap.
- Brand and product names stay: Fantasy Map Generator, Azgaar, Armoria, Dropbox, Discord.

## Map

| English                         | French                                | Note                                   |
| ------------------------------- | ------------------------------------- | -------------------------------------- |
| map                             | carte                                 |                                        |
| burg                            | localité (f.)                         | any settlement, from hamlet to capital |
| capital                         | capitale                              |                                        |
| port                            | port                                  |                                        |
| state                           | État                                  | capitalized                            |
| province                        | province                              |                                        |
| culture                         | culture                               |                                        |
| religion                        | religion                              |                                        |
| namesbase                       | base de noms (pl. bases de noms)      |                                        |
| heightmap                       | carte des hauteurs                    | the layer is “Hauteurs”                |
| template (heightmap)            | modèle                                |                                        |
| cell                            | cellule                               |                                        |
| grid                            | grille                                |                                        |
| seed                            | graine                                |                                        |
| biome                           | biome                                 |                                        |
| feature (island, lake…)         | élément géographique                  | “élément” where the context is clear   |
| continent / island / isle       | continent / île / îlot                |                                        |
| lake / sea / ocean / gulf       | lac / mer / océan / golfe             |                                        |
| coastline / coast / shore       | trait de côte / côte / rivage         |                                        |
| river / source / mouth          | rivière / source / embouchure         |                                        |
| route / road / trail / sea lane | route / route / sentier / voie maritime | “road” is “route”; “route” the generic |
| elevation, height / depth       | altitude, hauteur / profondeur        |                                        |
| precipitation                   | précipitations                        |                                        |
| temperature                     | température                           |                                        |
| population / rural / urban      | population / rurale / urbaine         |                                        |
| relief                          | relief                                |                                        |
| relief pool / relief rule       | jeu de reliefs / règle de relief      |                                        |
| marker                          | marqueur                              |                                        |
| label / added label             | étiquette / étiquette ajoutée         |                                        |
| label group                     | groupe d'étiquettes                   |                                        |
| zone                            | zone                                  |                                        |
| emblem / coat of arms           | emblème / armoiries                   |                                        |
| heraldic / picture emblem       | emblème héraldique / emblème illustré |                                        |
| charge / tincture / field       | meuble / émail (pl. émaux) / champ    | heraldic terms                         |
| division / ordinary             | partition / pièce honorable           |                                        |
| note / legend                   | note / légende                        |                                        |
| submap                          | sous-carte                            |                                        |
| neutrals / wildlands            | not translated                        | map content                            |

## Politics, military, economy

| English                          | French                                  |
| -------------------------------- | --------------------------------------- |
| diplomacy                        | diplomatie                              |
| ally / enemy / vassal / suzerain | allié / ennemi / vassal / suzerain      |
| state form                       | forme d'État                            |
| military / regiment              | armée / régiment                        |
| army / fleet / navy              | armée / flotte / marine                 |
| unit (military)                  | unité                                   |
| battle / attacker / defender     | bataille / attaquant / défenseur        |
| journey / segment / stay         | voyage / étape / séjour                 |
| transport type                   | mode de transport                       |
| market                           | marché                                  |
| good / goods                     | marchandise / marchandises              |
| raw / manufactured good          | matière première / produit manufacturé  |
| recipe                           | recette                                 |
| production                       | production                              |
| stock                            | stock                                   |
| demand / supply                  | demande / offre                         |
| deal / trade                     | transaction / commerce                  |
| treasury                         | trésor                                  |
| sales tax / poll tax             | taxe sur les ventes / capitation        |

## Interface

| English                          | French                                  |
| -------------------------------- | --------------------------------------- |
| layer                            | calque                                  |
| style / style element            | style / élément de style                |
| preset                           | préréglage                              |
| options / settings               | options / paramètres                    |
| tools / editor / overview        | outils / éditeur / aperçu               |
| generate / regenerate            | générer / régénérer                     |
| lock / unlock                    | verrouiller / déverrouiller             |
| undo / redo                      | Annuler / Rétablir                      |
| toggle (a layer)                 | afficher/masquer                        |
| save / load                      | enregistrer / charger                   |
| download / upload                | télécharger / téléverser                |
| export / import                  | exporter / importer                     |
| icon / icon set                  | icône / jeu d'icônes                    |
| custom icon / icon library       | icône personnalisée / bibliothèque d'icônes |
| glyph                            | glyphe                                  |
| brush                            | pinceau                                 |
| opacity / stroke / fill          | opacité / contour / remplissage         |
| scale bar / compass rose         | barre d'échelle / rose des vents        |
| Azgaar Assistant                 | Assistant Azgaar                        |
| chat / proposal / tier           | discussion / proposition / niveau       |
| guest / member / key             | invité / membre / clé                   |
| provider                         | fournisseur                             |
