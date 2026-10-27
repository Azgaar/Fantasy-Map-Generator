# Hindi glossary

Terms every `hi.json` string uses the same way. Rules for all catalogs are in
[docs/architecture/translation.md](../../../docs/architecture/translation.md).

## Style

- Use the polite form with आप for sentences: “आप इसे बदल सकते हैं”, “क्या आप वाकई हटाना चाहते हैं?”.
- Buttons and menu items are short verb stems in the polite imperative (“सहेजें”, “रद्द करें”) or nouns (“हटाएँ”).
- Tooltips are a short imperative (“क्लिक करके बदलें”) or a noun phrase.
- Use the Devanagari script for all Hindi words; keep English words that Hindi users know in the UI (“ज़ूम”, “फ़ॉन्ट”, “प्रीसेट”).
- Quotes are “ ”. Keys keep their English names: Ctrl, Shift, Alt, Enter, Esc, Space.
- Sentences end with a full stop “.”, not “।”, to match the English punctuation in placeholders.
- Brand and product names stay: Azgaar, Armoria, Google Fonts, Discord, Dropbox.
- The product names are translated: “फ़ैंटेसी मानचित्र जनरेटर”, in full “Azgaar का फ़ैंटेसी मानचित्र जनरेटर”; the assistant is “Azgaar सहायक”.

## Map

| English                         | Hindi                        | Note                                   |
| ------------------------------- | ---------------------------- | -------------------------------------- |
| map                             | मानचित्र                     |                                        |
| burg                            | बस्ती (pl. बस्तियाँ)         | any settlement; never “बर्ग”           |
| capital                         | राजधानी                      |                                        |
| port                            | बंदरगाह                      |                                        |
| state                           | राज्य                        |                                        |
| province                        | प्रांत                       |                                        |
| culture                         | संस्कृति                     |                                        |
| religion                        | धर्म                         |                                        |
| namesbase                       | नाम-आधार                     |                                        |
| heightmap                       | ऊँचाई-मानचित्र               |                                        |
| template (heightmap)            | साँचा                        |                                        |
| cell                            | कोशिका                       |                                        |
| grid                            | ग्रिड                        |                                        |
| seed                            | बीज                          |                                        |
| biome                           | बायोम                        |                                        |
| feature (island, lake…)         | भौगोलिक विशेषता              |                                        |
| continent / island / isle       | महाद्वीप / द्वीप / छोटा द्वीप | |
| lake / sea / ocean / gulf       | झील / समुद्र / महासागर / खाड़ी | |
| freshwater / salt lake          | मीठा पानी / खारी झील         |                                        |
| coastline / coast / shore       | तटरेखा / तट / किनारा         |                                        |
| river / source / mouth          | नदी / स्रोत / मुहाना         |                                        |
| route / road / trail / sea lane | मार्ग / सड़क / पगडंडी / समुद्री मार्ग | |
| elevation, height / depth       | ऊँचाई / गहराई                |                                        |
| sea level                       | समुद्र तल                    |                                        |
| precipitation                   | वर्षा                        |                                        |
| temperature                     | तापमान                       |                                        |
| population / rural / urban      | जनसंख्या / ग्रामीण / शहरी    |                                        |
| area                            | क्षेत्रफल                    |                                        |
| relief                          | उभार                         |                                        |
| relief pool / relief rule       | उभार-पूल / उभार-नियम         |                                        |
| contours / hachures             | समोच्च रेखाएँ / छायांकन      |                                        |
| marker / pin                    | मार्कर / पिन                 |                                        |
| label / label group             | लेबल / लेबल समूह             |                                        |
| zone                            | क्षेत्र                      |                                        |
| emblem / coat of arms           | प्रतीक-चिह्न                 | “एम्ब्लम” only for a picture emblem   |
| charge / tincture / field       | चार्ज / रंग / क्षेत्र-पृष्ठभूमि | |
| layer                           | परत                          |                                        |
| journey                         | यात्रा                       |                                        |
| regiment / fleet                | रेजिमेंट / बेड़ा             |                                        |
| market                          | बाज़ार                       |                                        |
| good (trade)                    | वस्तु                        |                                        |
| treasury / taxes                | कोषागार / कर                 |                                        |
| prosperity / living standards   | समृद्धि / जीवन स्तर          |                                        |
| desolate / destitute / poor / modest / comfortable / thriving / affluent / opulent / splendid / peerless | उजड़ा / कंगाल / निर्धन / साधारण / सुखी / फलता-फूलता / संपन्न / ऐश्वर्यपूर्ण / वैभवशाली / अद्वितीय |  |
| consumption / need / want       | उपभोग / ज़रूरत / इच्छा       |                                        |
| product (economy) / townspeople / rural people | उत्पाद / नगरवासी / ग्रामीण लोग |                                        |
| exports / imports / trade balance | निर्यात / आयात / व्यापार संतुलन |                                        |
| inequality / tax burden         | असमानता / कर का बोझ          |                                        |
| sector: rural / manufacturing / trade | देहात / शिल्प / व्यापार      |                                        |
| economy type: agrarian / artisan / mercantile | कृषि-प्रधान / शिल्प-प्रधान / व्यापार-प्रधान |                                        |

## Interface

| English                | Hindi                  | Note                                    |
| ---------------------- | ---------------------- | --------------------------------------- |
| Save                   | सहेजें                 |                                         |
| Cancel                 | रद्द करें              |                                         |
| Apply                  | लागू करें              |                                         |
| Delete / Remove        | हटाएँ                  |                                         |
| Add                    | जोड़ें                 |                                         |
| Edit                   | संपादित करें           |                                         |
| Close (button)         | बंद करें               |                                         |
| Close (distance)       | निकटता                 | context: distance                       |
| Undo / Redo            | पूर्ववत करें / फिर से करें |                                     |
| Settings / Options     | सेटिंग्स / विकल्प      |                                         |
| Export / Import        | निर्यात / आयात         |                                         |
| Load                   | लोड करें               |                                         |
| Generate / Regenerate  | बनाएँ / फिर से बनाएँ   |                                         |
| Click                  | क्लिक करें             |                                         |
| Drag                   | खींचें                 |                                         |
| Zoom                   | ज़ूम                   |                                         |
| Hotkey / shortcut      | शॉर्टकट                |                                         |
| Dialog                 | संवाद                  |                                         |
| Default                | डिफ़ॉल्ट               |                                         |
| Color                  | रंग                    |                                         |
| Font                   | फ़ॉन्ट                 |                                         |
| Opacity                | अपारदर्शिता            |                                         |
| Name                   | नाम                    |                                         |
| Ally / Enemy           | सहयोगी / शत्रु         |                                         |
| Relations              | संबंध                  |                                         |
| Military               | सैन्य                  |                                         |
| Battle                 | युद्ध                  |                                         |
| Temperature (weather)  | तापमान                 |                                         |
| Autosave               | स्वतः सहेजना           |                                         |
| view-only              | केवल देखने के लिए          |                                         |
