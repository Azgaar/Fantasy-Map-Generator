# Bengali glossary

Terms every `bn.json` string uses the same way. Rules for all catalogs are in
[docs/architecture/translation.md](../../../docs/architecture/translation.md).

## Style

- Address the user formally with **আপনি**: “আপনি কি নিশ্চিত যে আপনি জনপদটি মুছতে চান?”.
- Buttons and menu items are a short verb noun or the bare verb: “সংরক্ষণ”, “বাতিল”, “সব মুছুন”.
- Tooltips are a short imperative with **করুন**: “ক্লিক করুন জনপদ পরিবর্তন করতে”.
- Dialog titles and editor names: “... সম্পাদক”; inline actions use “সম্পাদনা করুন”.
- Quotes are “ ”. Numbers stay in Western digits (1, 2, 3), as in the English.
- Keys keep their English names: Ctrl, Shift, Alt, Enter, Esc, Space.
- Brand and product names stay: Azgaar, Armoria, Dropbox, Discord, Google Fonts.
- The product names are translated: “ফ্যান্টাসি মানচিত্র জেনারেটর”, in full “আজগারের ফ্যান্টাসি মানচিত্র জেনারেটর”; the assistant is “আজগার সহকারী”.

## Map

| English                         | Bengali                          | Note                                  |
| ------------------------------- | -------------------------------- | ------------------------------------- |
| map                             | মানচিত্র                         |                                       |
| burg                            | জনপদ                             | any settlement; never “burg”          |
| capital                         | রাজধানী                          |                                       |
| port                            | বন্দর                            |                                       |
| state                           | রাষ্ট্র                          |                                       |
| province                        | প্রদেশ                           |                                       |
| culture                         | সংস্কৃতি                         |                                       |
| religion                        | ধর্ম                             |                                       |
| namesbase                       | নামের ভিত্তি                     |                                       |
| heightmap                       | উচ্চতা মানচিত্র                  |                                       |
| template (heightmap)            | টেমপ্লেট                         |                                       |
| cell                            | কোষ                              |                                       |
| grid                            | গ্রিড                            |                                       |
| seed                            | বীজ                              |                                       |
| biome                           | বায়োম                           |                                       |
| feature (island, lake…)         | ভূ-বৈশিষ্ট্য                     |                                       |
| continent / island / isle       | মহাদেশ / দ্বীপ / ছোট দ্বীপ       |                                       |
| lake / sea / ocean / gulf       | হ্রদ / সাগর / মহাসাগর / উপসাগর   |                                       |
| freshwater / salt lake          | মিঠা পানির হ্রদ / লোনা হ্রদ      |                                       |
| coastline / coast / shore       | উপকূলরেখা / উপকূল / সৈকত         |                                       |
| river / source / mouth          | নদী / উৎস / মোহনা                |                                       |
| route / road / trail / sea lane | রুট / সড়ক / পায়েচলা পথ / জলপথ   |                                       |
| elevation, height / depth       | উচ্চতা / গভীরতা                  |                                       |
| sea level                       | সমুদ্রপৃষ্ঠ                      |                                       |
| precipitation                   | বৃষ্টিপাত                        |                                       |
| temperature                     | তাপমাত্রা                        |                                       |
| population / rural / urban      | জনসংখ্যা / গ্রামীণ / শহুরে       |                                       |
| area                            | এলাকা                            |                                       |
| relief                          | ভূপ্রকৃতি                        |                                       |
| relief pool / relief rule       | ভূপ্রকৃতি পুল / ভূপ্রকৃতি নিয়ম  |                                       |
| contours / hachures             | সমোন্নতি রেখা / হ্যাচার          |                                       |
| marker / pin                    | মার্কার / পিন                    |                                       |
| label / label group             | লেবেল / লেবেল গোষ্ঠী             |                                       |
| zone                            | অঞ্চল                            |                                       |
| emblem / coat of arms           | প্রতীক / রাজচিহ্ন                | “এমব্লেম” only for a picture emblem   |
| charge / tincture / field       | চার্জ / রং / ক্ষেত্র             |                                       |
| layer                           | স্তর                             |                                       |
| journey                         | ভ্রমণ                            |                                       |
| regiment / fleet                | রেজিমেন্ট / নৌবহর                |                                       |
| market                          | বাজার                            |                                       |
| good (trade)                    | পণ্য                             |                                       |
| prosperity / living standards   | সমৃদ্ধি / জীবনযাত্রার মান        |                                       |
| desolate / destitute / poor / modest / comfortable / thriving / affluent / opulent / splendid / peerless | বিধ্বস্ত / নিঃস্ব / দরিদ্র / সাধারণ / স্বাচ্ছন্দ্যপূর্ণ / সমৃদ্ধিশালী / সচ্ছল / ঐশ্বর্যময় / জাঁকজমকপূর্ণ / অতুলনীয় |  |
| consumption / need / want       | ভোগ / প্রয়োজন / শখ              |                                       |
| product (economy) / townspeople / rural people | উৎপাদ / নগরবাসী / গ্রামের মানুষ  |                                       |
| exports / imports / trade balance | রপ্তানি / আমদানি / বাণিজ্য ভারসাম্য |                                       |
| inequality / tax burden         | বৈষম্য / করের বোঝা               |                                       |
| sector: rural / manufacturing / trade | গ্রামাঞ্চল / কারুশিল্প / বাণিজ্য |                                       |
| economy type: agrarian / artisan / mercantile | কৃষিপ্রধান / কারিগরিপ্রধান / বণিকপ্রধান |                                       |

## Interface

| English                        | Bengali                              |
| ------------------------------ | ------------------------------------ |
| layer                          | স্তর                                 |
| style / style element          | শৈলী / শৈলীর উপাদান                  |
| preset (style) / layers preset | প্রিসেট / স্তরের প্রিসেট             |
| options / settings             | সেটিংস                               |
| tools / editor / overview      | সরঞ্জাম / সম্পাদক / সারসংক্ষেপ       |
| generate                       | তৈরি করুন                            |
| regenerate                     | পুনরায় তৈরি করুন                    |
| lock / unlock                  | লক করুন / আনলক করুন                  |
| locked / unlocked              | লক করা / আনলক করা                    |
| undo / redo                    | পূর্বাবস্থায় ফেরান / পুনরায় করুন    |
| save / load                    | সংরক্ষণ / লোড                        |
| download / upload              | ডাউনলোড / আপলোড                      |
| export / import                | রপ্তানি / আমদানি                     |
| icon / custom icon             | আইকন / কাস্টম আইকন                   |
| custom (font, name, scheme)    | কাস্টম                               |
| brush / stroke / fill          | ব্রাশ / স্ট্রোক / ফিল                |
| opacity                        | স্বচ্ছতা                             |
| scale bar / compass rose       | স্কেল বার / কম্পাস                   |
| ruler / measurer               | রুলার / পরিমাপক                      |
| preview                        | পূর্বরূপ                             |
| zoom / pan                     | জুম / সরানো                          |
| cancel / close                 | বাতিল / বন্ধ করুন                    |
| delete / remove                | মুছুন / সরান                         |
| add / edit                     | যোগ করুন / সম্পাদনা করুন             |
| search                         | অনুসন্ধান                            |
| Azgaar Assistant               | আজগার সহকারী                         |
| chat / provider / API key      | চ্যাট / প্রদানকারী / API কী          |
| view-only                      | শুধু দেখার জন্য                         |
