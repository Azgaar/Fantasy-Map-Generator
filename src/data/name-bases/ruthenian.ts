import { lexiconOf, parseGrammar, parseRules, parseTemplates } from "@/utils/name-notation";
import type { NameBase } from ".";

export const ruthenian: NameBase = {
  id: "ruthenian",
  name: "Ruthenian",
  length: [5, 14],
  // biome-ignore format: a corpus reads as one line
  places: { length: [5, 10], names: ["Belgorod", "Beloberezhye", "Belyi", "Belz", "Berestiy", "Berezhets", "Berezovets", "Berezutsk", "Bobruisk", "Bolonets", "Borisov", "Borovsk", "Bozhesk", "Bratslav", "Bryansk", "Brynsk", "Buryn", "Byhov", "Chechersk", "Chemesov", "Cheremosh", "Cherlen", "Chern", "Chernigov", "Chernitsa", "Chernobyl", "Chernogorod", "Chertoryesk", "Chetvertnia", "Demyansk", "Derevesk", "Devyagoresk", "Dichin", "Dmitrov", "Dorogobuch", "Dorogobuzh", "Drestvin", "Drokov", "Drutsk", "Dubechin", "Dubichi", "Dubki", "Dubkov", "Dveren", "Galich", "Glebovo", "Glinsk", "Goloty", "Gomiy", "Gorodets", "Gorodische", "Gorodno", "Gorohovets", "Goroshin", "Gorval", "Goryshon", "Holm", "Horobor", "Hoten", "Hotin", "Hotmyzhsk", "Ilovech", "Ivan", "Izborsk", "Izheslavl", "Kamenets", "Kanev", "Karachev", "Karna", "Kavarna", "Klechesk", "Klyapech", "Kolomyya", "Kolyvan", "Kopyl", "Korec", "Kornik", "Korochunov", "Korshev", "Korsun", "Koshkin", "Kotelno", "Kovyla", "Kozelsk", "Kozelsk", "Kremenets", "Krichev", "Krylatsk", "Ksniatin", "Kulatsk", "Kursk", "Kursk", "Lebedev", "Lida", "Logosko", "Lomihvost", "Loshesk", "Loshichi", "Lubech", "Lubno", "Lubutsk", "Lutsk", "Luchin", "Luki", "Lukoml", "Luzha", "Lvov", "Mtsensk", "Mdin", "Medniki", "Melecha", "Merech", "Meretsk", "Mescherskoe", "Meshkovsk", "Metlitsk", "Mezetsk", "Mglin", "Mihailov", "Mikitin", "Mikulino", "Miloslavichi", "Mogilev", "Mologa", "Moreva", "Mosalsk", "Moschiny", "Mozyr", "Mstislav", "Mstislavets", "Muravin", "Nemech", "Nemiza", "Nerinsk", "Nichan", "Novgorod", "Novogorodok", "Obolichi", "Obolensk", "Obolensk", "Oleshsk", "Olgov", "Omelnik", "Opoka", "Opoki", "Oreshek", "Orlets", "Osechen", "Oster", "Ostrog", "Ostrov", "Perelai", "Peremil", "Peremyshl", "Pererov", "Peresechen", "Perevitsk", "Pereyaslav", "Pinsk", "Ples", "Polotsk", "Pronsk", "Proposhesk", "Punia", "Putivl", "Rechitsa", "Rodno", "Rogachev", "Romanov", "Romny", "Roslavl", "Rostislavl", "Rostovets", "Rsha", "Ruza", "Rybchesk", "Rylsk", "Rzhavesk", "Rzhev", "Rzhischev", "Sambor", "Serensk", "Serensk", "Serpeysk", "Shilov", "Shuya", "Sinech", "Sizhka", "Skala", "Slovensk", "Slutsk", "Smedin", "Sneporod", "Snitin", "Snovsk", "Sochevo", "Sokolec", "Starica", "Starodub", "Stepan", "Sterzh", "Streshin", "Sutesk", "Svinetsk", "Svisloch", "Terebovl", "Ternov", "Teshilov", "Teterin", "Tiversk", "Torchevsk", "Toropets", "Torzhok", "Tripolye", "Trubchevsk", "Tur", "Turov", "Usvyaty", "Uteshkov", "Vasilkov", "Velil", "Velye", "Venev", "Venicha", "Verderev", "Vereya", "Veveresk", "Viazma", "Vidbesk", "Vidychev", "Voino", "Volodimer", "Volok", "Volyn", "Vorobesk", "Voronich", "Voronok", "Vorotynsk", "Vrev", "Vruchiy", "Vselug", "Vyatichsk", "Vyatka", "Vyshegorod", "Vyshgorod", "Vysokoe", "Yagniatin", "Yaropolch", "Yasenets", "Yuryev", "Yuryevets", "Zaraysk", "Zhitomel", "Zholvazh", "Zizhech", "Zubkov", "Zudechev", "Zvenigorod"] },
  // biome-ignore format: a corpus reads as one line
  people: { male: { mode: "pick", names: ["Vladimir", "Yaroslav", "Svyatoslav", "Mstislav", "Izyaslav", "Vsevolod", "Rostislav", "Yaropolk", "Svyatopolk", "Bryachislav", "Vseslav", "Igor", "Oleg", "Rurik", "Gleb", "Boris", "Roman", "David", "Vasilko", "Volodar", "Rogvolod", "Davyd", "Vyacheslav", "Stanislav", "Ratibor", "Dobrynya", "Putyata", "Vyshata", "Miroslav", "Radim", "Zhiroslav", "Tverdislav", "Gostomysl", "Vadim", "Budimir", "Lyubomir", "Dragomir", "Kazimir", "Borislav", "Bogdan", "Bogumil", "Milosh", "Radovan", "Stoyan", "Zhdan", "Nezhdan", "Mal", "Tur", "Sveneld", "Askold", "Dir", "Ivan", "Vasiliy", "Dmitriy", "Mihail", "Fedor", "Andrey", "Yuriy", "Daniil", "Aleksandr", "Konstantin", "Semen", "Petr", "Pavel", "Nikita", "Ilya", "Luka", "Foma", "Matvey", "Kuzma", "Timofey", "Trofim", "Ostap", "Taras", "Nestor", "Kirill", "Mefodiy"] }, female: { mode: "pick", names: ["Olga", "Predslava", "Rogneda", "Malusha", "Dobroneg", "Verhuslava", "Zvenislava", "Gorislava", "Miroslava", "Yaroslava", "Svyatoslava", "Vseslava", "Lyubava", "Milava", "Zlata", "Vesna", "Lada", "Bogdana", "Radmila", "Lyudmila", "Dobrava", "Zabava", "Darina", "Bazhena", "Vlasta", "Snezhana", "Anna", "Mariya", "Elena", "Evdokiya", "Evpraksiya", "Efrosinya", "Anastasiya", "Agafya", "Marfa", "Irina", "Sofiya", "Feodosiya", "Ksenya", "Vasilisa", "Ulyana", "Varvara", "Nadezhda", "Vera", "Lyubov"] } },
  rules: [
    { match: "(.)\\1+", replace: "$1" },
    ...parseRules(String.raw`
(?<=[^aeiou])y?a\+ov => +in | join
(?<=[aeiou])y\+ov => yev | join
(?:iy|i)\+ov => +ev | join
(ov|ev|in|yn)\+(?:ov|ev) => $1+ | join
spas\+sk => spassk | join
ts\+sk => tsk | join
(?<=[^aeiou])ga\+sk => zhsk | join
(?<=[^aeiou])(?:y?a|o)\+sk => sk | join
sk\+sk => sk | join
(?<![aeiouy][nrlmyv]{0,2})\+sk => +ovsk | join
(?<=[^aeiouy+][^aeiouy+])\+k(?=[ai]\b) => +ovk | join
(?<=[^aeiou])[aoey]\+(?=k[ai]\b) => + | join
(?<=[^aeiouy])[aoe]\+(?=[aeiou]) => + | join
(?<=\+(?:ov|ev|in)|yev|(?:ov|ev|in|yn)\+)\+yi =>  | join
(?<=\+(?:ov|ev|in)|yev|(?:ov|ev|in|yn)\+)\+aya => +a | join
(?<=\+(?:ov|ev|in)|yev|(?:ov|ev|in|yn)\+)\+oye => +o | join
(?<=\+(?:ov|ev|in)|yev|(?:ov|ev|in|yn)\+)\+ye => +y | join
(?<=zh|ch|sh)\+yi => +iy | join
(?<=zh|ch|sh)\+aya => +ya | join
(?<=zh|ch|sh)\+oye => +ye | join
(?<=zh|ch|sh)\+ye => +i | join
(?<=[gkh])\+yi => +iy | join
(?<=[gkh])\+ye => +iye | join
(?<=[aeiouy][^aeiouy])o\+(?=[^aeiouy+][aeiouy]) => + | 25%
gorod$ => grad | long
ovka$ => ka | long
th => f | foreign
^h(?=[aeiou]) => g | foreign
qu => kv | foreign
c(?=[eiy]) => ts | foreign
c(?!h) => k | foreign
(?<=[ae])u(?=[^aeiou]) => v | foreign`)
  ],
  // a noun's gender or number shows in its ending; a describing word takes the ending that goes with it
  grammar: parseGrammar(`
f: a$ => aya
n: [oe]$ => oye
pl: (?<![aeiouy])[iy]$ => ye
m: => yi`),
  lexicon: lexiconOf({
    city: "-sk:6, -ovsk:2, grad@last:2, gorod@last, gorod@word, grad@word:0.5",
    town: "-ov:8, gorodok@word, gorod@word:0.5, posad@word:0.5, gorodok@last, _/m@word:0.5",
    village: "-ovo:6, -ovka:4, -ichi:2, -ovichi, selo@word:1.5, sloboda@word:0.5, derevnya@word:0.5, _/n@word",
    hamlet:
      "-ka:5, -ki:4, -ovka:2, -y:2, -tsy, hutor@word, vyselki@word:0.5, dvory@word:0.5, _/f@word:0.5, _/pl@word:0.5",

    home: "dvor@word:3, stan@word:2, dvor@stem",
    farm: "hutor@word:2, pochinok@word, zaimka@word, hutor@stem",
    hall: "terem@word:3, horomy@word, palaty@word, terem@stem",
    field: "polye@word:3, pole@word:2, niva@word, niv@stem",
    wood: "les@word:3, bor@word:3, les@stem:2, bor@stem:3",
    hill: "gora@word:4, holm@word:2, gorka@word:2, gory@word, gor@stem:3, holm@stem:2",
    ford: "brod@word:4, perevoz@word, brod@stem:3",
    fort: "ostrog@word:3, gorodok@word:2, gorodets@word, kreml@word, -ets:2, grad@last, ostrog@stem",
    bridge: "most@word:4, mosty@word, most@stem:3",
    harbour: "pristan/f@word:3, gavan/f@word:2, pristan@stem, gavan@stem",
    valley: "dol@word:3, log@word:2, yar@word:3, dolina@word, yar@stem:2, dolin@stem:2, log@stem",
    market: "torg@word:3, torzhok@word:2, posad@word:2, yarmarka@word, torg@stem:2, posad@stem",
    castle: "zamok@word:3, kreml@word:2, zamk@stem",
    mouth: "ust-@first:5, ustye@word:3, ust@stem",
    mount: "gora@word:3, kamen@word, verh@word, gor@stem:2",
    shore: "bereg@word:3, bereg@stem:2",
    island: "ostrov@word:4, ostrov@stem:2",
    lake: "ozero@word:4, ozer@stem:4",
    haven: "zaton@word:2, gavan/f@word:2, zaton@stem:2",
    marsh: "boloto@word:3, bolotye@last, bolot@stem:3",
    spring: "klyuch@word:3, klyuchi@word:2, rodnik@word:2, krinitsa@word, klyuch@stem:2, rodnik@stem:2",
    meadow: "lug@word:3, luki@word:2, polyana@word:2, lug@stem:2, polyan@stem:2",
    grove: "roscha@word:3, dubrava@word:2, gai@word, dubrav@stem:2",
    bank: "bereg@word:2, yar@word:2, kosa@word, krucha@word, bereg@stem, yar@stem",
    mill: "mlyn@word:3, melnitsa@word, melnik@stem:3, mlyn@stem:2",
    bay: "guba@word:2, zaliv@word:2, zatoka@word, zaliv@stem:2, gub@stem",
    cape: "mys@word:3, nos@word:2, mys@stem:2",
    cliff: "skala@word:3, utes@word:2, skal@stem:2",
    tower: "vezha@word:3, bashnya@word, stolp@word, vezh@stem, stolp@stem",
    ridge: "gryada@word:2, kryazh@word:2, hrebet@word, gryad@stem, kryazh@stem",
    pass: "volok@word:3, pereval@word:2, vorota/pl@word, volok@stem:3",
    heath: "step/f@word:2, pustosh/f@word:2, pustosh@stem:2, step@stem",
    pool: "prud@word:3, prudy@word:2, stav@word:2, omut@word, prud@stem:3",
    well: "kolodez@word:3, krinitsa@word:2, kolodez@stem:2",
    camp: "stan@word:3, yam@word:2, dvor@word:2, tabor@word, stan@stem:2, yam@stem:2",
    mine: "rudnik@word:2, kopi@word:2, ruda@word, rud@stem:3, rudnik@stem:2",
    quarry: "lom@word:2, lom@stem:2",
    temple: "hram@word:2, sobor@word:2, pogost@word:2, tserkov/f@word:2, pogost@stem:2, hram@stem",
    abbey: "monastyr@word:3, pustyn/f@word:2, skit@word:2, obitel/f@word, lavra@word, monastyr@stem, skit@stem",
    river: "reka@word:3, rechka@word:2",
    brook: "ruchey@word:3, potok@word:2",
    water: "voda@word:3, vody@word:2",

    new: "novo@first, nov*",
    old: "staro@first, star*",
    great: "veliko@first, velik*",
    little: "malo@first, mal*",
    long: "dolgo@first, dolg*",
    broad: "shiroko@first, shirok*",
    deep: "gluboko@first, glubok*",
    high: "vysoko@first:2, vyshe~vysh@first, vysok*",
    low: "nizko@first:2, nizo@first, nizk*",
    upper: "verhne@first:3, verh@first, verhniy/m@word, verhnyaya/f@word, verhneye/n@word, verhniye/pl@word",
    lower: "nizhne@first, nizhniy/m@word, nizhnyaya/f@word, nizhneye/n@word, nizhniye/pl@word",
    middle: "sredne@first:3, mezh@first, sredniy/m@word, srednyaya/f@word, sredneye/n@word, sredniye/pl@word",
    north: "severo@first, severn*",
    south: "yuzhno@first, yuzhn*",
    east: "vostochno~vosto@first, vostochn*",
    west: "zapadno~zapad@first, zapadn*",
    black: "cherno@first, chern*:2, chern@stem",
    white: "belo@first:2, bel*:2, bel@stem",
    red: "krasno@first:2, chervono@first, krasn*:3, krasn@stem",
    green: "zeleno@first, zelen*:2",
    golden: "zlato@first, zolot*:2",
    grey: "sero@first, sedo@first, ser*:2, ser@stem",
    blue: "sine@first, siniy/m@word, sinyaya/f@word, sineye/n@word, siniye/pl@word",
    dark: "temno@first, temn*",
    bright: "svetlo@first:2, yasno@first, svetl*:2, yasn*",
    oak: "dubo@first, dub@stem:5, dubov*",
    pine: "sosno@first, sosnov@stem:3, bor@stem:3, sosnov*, borov*",
    birch: "berezo@first, berez@stem:5, berezov*",
    ash: "yaseno@first, yasen@stem:4, yasenev*",
    elm: "vyazo@first, vyaz@stem:4, vyazov*",
    willow: "ivo@first, verb@stem:3, rakit@stem:3, ivov*, verbn*",
    thorn: "terno@first, tern@stem:4, ternov*",
    reed: "kamysho@first, kamysh@stem:4, kamyshov*",
    rose: "rozo@first, roz@stem:3, rozov*",
    apple: "yablono@first, yablon@stem:4, yablonev*",
    wolf: "volko@first, volk@stem:5, volch*",
    bear: "medvezhe~medve@first, medved@stem:5, medvezh*",
    eagle: "orlo@first, orl@stem:5, orlin*",
    deer: "oleno@first, olen@stem:3, los@stem:3, losin*, olen*",
    horse: "kone@first, kon@stem:4, konsk*",
    ox: "turo@first, byko@first, tur@stem:3, byk@stem:3, vol@stem, bych*",
    sheep: "barano@first, ovche@first, baran@stem:4, ovech*",
    goat: "kozlo@first, kozl@stem:3, kozel@stem:2, koz*",
    fox: "liso@first, lis@stem:5, lisiy/m@word, lisya/f@word, lisye/n@word, lisyi/pl@word",
    boar: "vepre@first, kabano@first, vepr@stem:2, kaban@stem:4, kaban*",
    raven: "vorono@first, voron@stem:5, voron*",
    hawk: "sokolo@first, yastrebo@first, sokol@stem:4, yastreb@stem:2, sokolin*",
    swan: "lebede@first, lebed@stem:4, lebedin*, lebyazh*",
    crane: "zhuravle~zhurav@first, zhuravl@stem:4, zhuravlin*",
    gull: "chaiko@first, chaik@stem:4, chaich*",
    seal: "nerpo@first, tyuleno@first, tyulen@stem:3, nerp@stem:2, tyulen*",
    fish: "rybo@first, ryb@stem:3, rybn*:2",
    otter: "vydro@first, vydr@stem:4, vydrin*",
    stone: "kameno@first, kamen@stem:5, kamenn*:2",
    iron: "zhelezno~zhelez@first, zhelez@stem:2, zhelezn*:2",
    copper: "medno@first, med@stem:2, medn*:2",
    silver: "srebro@first, serebr@stem:2, serebryan*:2",
    gold: "zoloto@first:2, zlato@first, zolot@stem:3, zolot*:2",
    salt: "soli@first:3, sol@stem:3, solyan*, solen*",
    sand: "pesko@first, pesk@stem:3, peschan*:2",
    clay: "glino@first, glin@stem:4, glinyan*",
    chalk: "melo@first, mel@stem:3, melov*",
    cold: "holodno@first, studeno@first, studen@stem:2, holodn*:2, studen*",
    warm: "teplo@first, tepl*",
    dry: "suho@first, suh*",
    wet: "mokro@first, mokr*",
    wind: "vetro@first, vetr@stem:3, vetren*:2",
    mist: "tumano@first, mglo@first, tuman@stem:3, tumann*:2",
    snow: "snezhno@first:2, snego@first, sneg@stem:2, snezhn*:3",
    storm: "burno@first, grozo@first, groz@stem:2, grozn*:2, burn*",
    quiet: "tiho@first, tih@stem, tih*:3",
    wild: "diko@first, dik*",
    fair: "dobro@first:2, ladno@first, dobr@stem, dobr*:3",
    holy: "svyato@first:3, spaso@first, spas@stem:3, svyat*:3",
    free: "volno@first, slobodo@first, slobod@stem:2, voln*:3",
    king: "knyazhe~knyazh@first:2, tsare@first, knyazh@stem:2, tsar@stem:3, knyazh*:2, tsarsk*:2",
    queen: "knyagin@first, knyagin@stem:3, tsaritsyn@stem:3, tsaritsyn@word, knyagin@word",
    lord: "boyaro@first, boyar@stem:4, pan@stem:2, boyarsk*, pansk*",
    priest: "popo@first, pop@stem:5, vladychn*",
    merchant: "gosti@first:2, kuptse@first, kupts@stem:3, gost@stem:2, gostin*",
    hunter: "ohotno@first, lovche@first, ohotnik@stem:3, lovch*, ohotnich*",
    fisher: "rybatsko@first, rybak@stem:4, rybach*:2, rybatsk*",
    smith: "koval@first, koval@stem:3, kuznets@stem:4, kuznechn*",
    shepherd: "pastushe@first, pastuh@stem:4, chaban@stem:2, pastush*",

    land: "ia@last:5, schina@last:2, zemye@last"
  }),
  patterns: {
    "modifier-generic": { templates: parseTemplates("{modifier}{generic}:4, {modifier} {generic}:5") },
    "owner-generic": { templates: parseTemplates("{root}{generic}:5, {root}ov* {generic}:3") },
    "generic-of": { templates: parseTemplates("{root}{generic}:5, {root}sk* {generic}:4, {generic}{root}:3") },
    relative: { templates: parseTemplates("{modifier} {root}:5, {modifier}{root}") }
  }
};
