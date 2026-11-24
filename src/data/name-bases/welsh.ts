import type { WrittenNameBase } from "@/types/names";

// what softens the word after it: feminine nouns, an adjective before its noun, "two", "on"
const SOFT = String.raw`^(?:llan|tre|hendre|caer|ynys|bod|eglwys|hen|gwyn|du|hir|glas|cam|llwyd|coch|garw|uchel|dau|dwy)\+|^\p{L}+\+ar\+`;

export const welsh: WrittenNameBase = {
  id: "welsh",
  length: [4, 13],

  places: {
    names: [
      "Aberaeron",
      "Aberarth",
      "Abercych",
      "Aberdaron",
      "Aberdulais",
      "Aberdyfi",
      "Aberedw",
      "Abererch",
      "Aberffraw",
      "Abergele",
      "Abergwaun",
      "Abergwili",
      "Aberhonddu",
      "Abermaw",
      "Abernant",
      "Abersoch",
      "Abertawe",
      "Aberteifi",
      "Aberystwyth",
      "Aberafan",
      "Aberporth",
      "Abergynolwyn",
      "Llanbadarn",
      "Llanberis",
      "Llanbedr",
      "Llandaf",
      "Llandeilo",
      "Llandrindod",
      "Llandudno",
      "Llanelli",
      "Llanelwy",
      "Llanfair",
      "Llanfihangel",
      "Llanfyllin",
      "Llangefni",
      "Llangollen",
      "Llangors",
      "Llanidloes",
      "Llanilltud",
      "Llanllyfni",
      "Llanrwst",
      "Llansteffan",
      "Llantrisant",
      "Llanymddyfri",
      "Llanwrtyd",
      "Llangurig",
      "Llandysul",
      "Llangoed",
      "Llanrhystud",
      "Llanfaes",
      "Bala",
      "Bangor",
      "Barri",
      "Beddgelert",
      "Betws",
      "Bleddfa",
      "Bodedern",
      "Bodelwyddan",
      "Bodfari",
      "Bodffordd",
      "Bodorgan",
      "Botwnnog",
      "Brechfa",
      "Bryncoch",
      "Bryneglwys",
      "Bryngwran",
      "Brynmawr",
      "Brynsiencyn",
      "Brynteg",
      "Bwlchgwyn",
      "Bwlchtocyn",
      "Bylchau",
      "Cadnant",
      "Caerau",
      "Caerdydd",
      "Caerffili",
      "Caerfyrddin",
      "Caergybi",
      "Caerhun",
      "Caerleon",
      "Caernarfon",
      "Caersws",
      "Caerwent",
      "Caerwys",
      "Carno",
      "Castellnewydd",
      "Cefncoed",
      "Cefnddwysarn",
      "Cemaes",
      "Cenarth",
      "Ceri",
      "Cerrigydrudion",
      "Chwilog",
      "Cilcain",
      "Cilgerran",
      "Cilmeri",
      "Cilycwm",
      "Clynnog",
      "Coedana",
      "Coedpoeth",
      "Conwy",
      "Corris",
      "Corwen",
      "Cricieth",
      "Crucywel",
      "Crymych",
      "Cwmbran",
      "Cwmdu",
      "Cwmllynfell",
      "Cydweli",
      "Cynwyd",
      "Darowen",
      "Defynnog",
      "Deganwy",
      "Derwen",
      "Dihewyd",
      "Dinas",
      "Dinbych",
      "Dinmael",
      "Dinorwig",
      "Dolanog",
      "Dolbenmaen",
      "Dolgarrog",
      "Dolgellau",
      "Dolwyddelan",
      "Dyserth",
      "Edern",
      "Eglwysbach",
      "Eglwyswrw",
      "Felindre",
      "Ffestiniog",
      "Ffynnongroyw",
      "Gaerwen",
      "Garndolbenmaen",
      "Garthmyl",
      "Gelligaer",
      "Glanaman",
      "Glandyfi",
      "Glasbwll",
      "Glyndyfrdwy",
      "Gorseinon",
      "Gresffordd",
      "Gwalchmai",
      "Gwytherin",
      "Gwernyfed",
      "Harlech",
      "Hendy",
      "Henfynyw",
      "Henllan",
      "Hirwaun",
      "Iscoed",
      "Maentwrog",
      "Maesteg",
      "Mallwyd",
      "Manafon",
      "Marchwiel",
      "Margam",
      "Meidrim",
      "Meifod",
      "Merthyr",
      "Moelfre",
      "Mostyn",
      "Mwnt",
      "Mynytho",
      "Myddfai",
      "Nanhyfer",
      "Nantgarw",
      "Nantglyn",
      "Nantmel",
      "Nefyn",
      "Ogwr",
      "Pantglas",
      "Pantyffynnon",
      "Pencader",
      "Pencaer",
      "Pencarreg",
      "Pencoed",
      "Pendeulwyn",
      "Penfro",
      "Penmachno",
      "Penmaenmawr",
      "Penmon",
      "Penmorfa",
      "Pennal",
      "Pennant",
      "Penrhos",
      "Penrhyn",
      "Pentraeth",
      "Pentrefoelas",
      "Penybont",
      "Penygroes",
      "Pistyll",
      "Ponterwyd",
      "Pontfaen",
      "Pontardawe",
      "Pontypridd",
      "Porthaethwy",
      "Porthcawl",
      "Porthgain",
      "Porthmadog",
      "Prestatyn",
      "Pumsaint",
      "Pwllheli",
      "Rhaeadr",
      "Rhosneigr",
      "Rhosgoch",
      "Rhostryfan",
      "Rhuddlan",
      "Rhuthun",
      "Rhydaman",
      "Rhydlewis",
      "Rhydowen",
      "Rhymni",
      "Senghennydd",
      "Silian",
      "Solfach",
      "Swyddffynnon",
      "Talgarth",
      "Talsarnau",
      "Talybont",
      "Talyllyn",
      "Tanybwlch",
      "Tregaron",
      "Tregarth",
      "Treffynnon",
      "Trefdraeth",
      "Trefeglwys",
      "Trefor",
      "Trefriw",
      "Trefynwy",
      "Tremadog",
      "Tremeirchion",
      "Trelech",
      "Trallwng",
      "Trawsfynydd",
      "Troedyraur",
      "Tudweiliog",
      "Tycroes",
      "Tywyn",
      "Waunfawr",
      "Wrecsam",
      "Wdig",
      "Ynysddu",
      "Ynyslas",
      "Ynysybwl",
      "Ysbyty",
      "Ystradfellte",
      "Ystradgynlais",
      "Ystradmeurig",
      "Ystumtuen",
      "Ysceifiog"
    ]
  },
  waters: {
    mode: "pick",
    names: [
      "Taf",
      "Tawe",
      "Teifi",
      "Tywi",
      "Wysg",
      "Gwy",
      "Dyfrdwy",
      "Dyfi",
      "Conwy",
      "Clwyd",
      "Hafren",
      "Afan",
      "Nedd",
      "Rhondda",
      "Cynon",
      "Ogwen",
      "Glaslyn",
      "Aeron",
      "Alun",
      "Alwen",
      "Banwy",
      "Cain",
      "Cegin",
      "Ceiriog",
      "Cleddau",
      "Colwyn",
      "Cothi",
      "Cych",
      "Daron",
      "Dwyfor",
      "Dysynni",
      "Ebwy",
      "Efyrnwy",
      "Ewenni",
      "Elan",
      "Elwy",
      "Erch",
      "Ffraw",
      "Gwili",
      "Gwaun",
      "Honddu",
      "Irfon",
      "Ithon",
      "Lliedi",
      "Llugwy",
      "Llwchwr",
      "Lledr",
      "Mawddach",
      "Mynwy",
      "Nyfer",
      "Ogwr",
      "Prysor",
      "Rheidol",
      "Rhymni",
      "Seiont",
      "Sirhywi",
      "Soch",
      "Taren",
      "Trannon",
      "Tryweryn",
      "Wnion",
      "Ystwyth",
      "Tegid",
      "Padarn"
    ]
  },
  people: {
    male: {
      mode: "pick",
      names: [
        "Arthur",
        "Owain",
        "Llywelyn",
        "Gruffydd",
        "Rhys",
        "Hywel",
        "Dafydd",
        "Madog",
        "Cadwaladr",
        "Maelgwn",
        "Rhodri",
        "Bleddyn",
        "Cynan",
        "Iorwerth",
        "Maredudd",
        "Urien",
        "Taliesin",
        "Aneirin",
        "Gwydion",
        "Pwyll",
        "Pryderi",
        "Bran",
        "Math",
        "Lleu",
        "Geraint",
        "Peredur",
        "Culhwch",
        "Cadfael",
        "Emrys",
        "Idris",
        "Anarawd",
        "Beli",
        "Brochfael",
        "Brychan",
        "Cadell",
        "Cadfan",
        "Cadog",
        "Cadwallon",
        "Caradog",
        "Ceredig",
        "Cunedda",
        "Cybi",
        "Cynddylan",
        "Cynfarch",
        "Deiniol",
        "Dewi",
        "Dyfrig",
        "Einion",
        "Elidir",
        "Elisedd",
        "Garmon",
        "Goronwy",
        "Gwrtheyrn",
        "Gwyn",
        "Gwynfor",
        "Illtud",
        "Ithel",
        "Llywarch",
        "Meilyr",
        "Meirion",
        "Merfyn",
        "Meurig",
        "Morgan",
        "Myrddin",
        "Padarn",
        "Rhun",
        "Seisyll",
        "Selyf",
        "Teilo",
        "Tewdrig",
        "Trahaearn",
        "Tudno",
        "Tudur",
        "Tysilio",
        "Ynyr"
      ]
    },
    female: {
      mode: "pick",
      names: [
        "Gwenllian",
        "Nest",
        "Angharad",
        "Branwen",
        "Rhiannon",
        "Arianrhod",
        "Blodeuwedd",
        "Olwen",
        "Enid",
        "Elen",
        "Morfudd",
        "Tegwen",
        "Ceridwen",
        "Gwenhwyfar",
        "Dwynwen",
        "Melangell",
        "Gwenfrewi",
        "Ffraid",
        "Non",
        "Marared",
        "Generys",
        "Tangwystl",
        "Lleucu",
        "Hunydd",
        "Efa",
        "Gwladus",
        "Eluned",
        "Luned",
        "Essyllt",
        "Creirwy",
        "Goewin",
        "Heledd",
        "Meleri",
        "Sanan",
        "Tegau",
        "Dwywe",
        "Tudful",
        "Ceinwen",
        "Mererid",
        "Nia"
      ]
    }
  },

  rules: [
    { match: "([^nldfr])\\1+", replace: "$1" },
    { match: "^l(?=an|yn|wyn|ech|ys)", replace: "ll" },
    // y' is the article, ' ends the letter a mutation changes
    String.raw`
(?<=[aeiouwy])\+y' => + | join
\+y'(?=[aeiouh]|w[^aeiouy]|yw|yn) => +yr | join
\+y' => +y | join
(?<!^(?:pont|rhyd|caer|castell|llan|melin))\+ar\+ => + | join
(?<=${SOFT})([mb])(?!\p{L}*') => f | join
(?<=${SOFT})gw(?=[aeiy]) => w | join
(?<=${SOFT})g(?=[lrn]) =>  | join
(?<=${SOFT})d(?!d|\p{L}*') => dd | join
(?<=${SOFT})ll => l | join
(?<=${SOFT})rh => r | join
(?<=${SOFT})p(?!h|\p{L}*') => b | join
(?<=${SOFT})t(?!h|\p{L}*') => d | join
(?<=${SOFT})c(?!h|\p{L}*') => g | join
(?<=^tri\+)([cpt])(?!h) => $1h | join
' =>  | join
(?<=^|t|d|y)tre\+(?=[aeiouwy]|l(?!l)|r(?!h)) => tref+ | join
^tref\+(?=wen|w[ae]) => tre+ | join
^tref\+(?=[lr]) => tre+ | join
^saith\+ => seith+ | join
an\+iog$ => einiog | join
(?<=[aeiouwy])n\+(?=(?:wg|ydd|edd)$) => nn+ | join
(?:w|wy|y)\+(?=wg$) =>  | join
(?:i|y|io)\+(?=io[ng]$) =>  | join
[aeo]\+(?=(?:ion|iog|ydd|edd|wg)$) => + | join
y\+(?=[ye]dd$) =>  | join
^(celli|ffau|cei|ty|cae)\+([aeiouy]) => $1 $2 | join
^pen\+is => pen is | join
([nrm])\+(?=\1) => $1 | join
(?<!d)d\+d(?!d) => d-d | join
ff\+f => ff | join
(dd|ll|ff)\+\1 => $1 | join
dd\+d => dd | join
ll\+l => ll | join
(.)\+\1 => $1 | join
\+ =>  | join`
  ],
  grammar: `
f: ^(?:tref?(?!n)|hendre|llan|caer|dinas|ynys|ffynnon|melin|craig|carreg|cors|dol|rhos|pont|glan|torlan|rhyd|moel|ban|hafod|allt|gallt|bron|rhiw|esgair|trum|sarn|croes|eglwys|efail|ogof|rhaeadr|carn|ysgubor|gwern|gwaun|waun|ffridd|porfa|perth|perllan|gardd|afon|ffrwd|bro|gwlad|neuadd|fforest|celli|mign|hafan|cloddfa|chwarel|mynachlog|[a-z]*gwylfa|gorffwysfa|eisteddfa|cadair|magwyr|aelwyd|tafarn|gwinllan|ffordd|heol|tomen|gorsedd|hafn|marchnad|maerdre)|(?:dref|gaer|bont|graig|groes|ddol|waun|felin|goeden)$
m:

*m: m m, f f
*b: m b, f f
*d: m d, f dd
*g: m g, f
*c: m c, f g
*t: m t, f d
*ll: m ll, f l
*gwyn: m gwyn, f wen
*melyn: m melyn, f felen
*gwyrdd: m gwyrdd, f werdd
*dwfn: m dwfn, f ddofn
*crwn: m crwn, f gron
*brith: m brith, f fraith
*tlws: m tlws, f dlos
*dau: m dau, f dwy
*tri: m tri, f tair`,
  lexicon: `
# settlements
city: caer+ 5, din+ 3, tre+ 2, dinas+, llys+
town: tre+ 5, llan+ 2, caer+ 2, din+, pentre+, +dref
village: tre+ 4, llan+ 3, pentre+ 2, bod+ 2, betws+, +llan
hamlet: bod+ 3, tre+ 2, pentre+ 2, hafod+ 2, hendre+ 2, ty+ 2, cil+ 2

# places
home: bod+ 3, ty+ 2, Hendre 3, Hendy
farm: tyddyn 3, hafod 3, maerdy 2, Hendre 2
hall: llys 3, plas 3, neuadd 2
field: maes 5, cae 3, Penmaes 2
wood: coed 5, fforest, Pencoed 2, Glasgoed, Hengoed
hill: bryn 6, bron 2, rhiw 2, allt 2, Penbryn 2, Gwynfryn
ford: rhyd 5, Penrhyd 2, Rhydau
fort: caer 4, din+ 4, dinas 2, Pencaer, Pendinas, Hengaer
bridge: pont 5, Penybont 3, Talybont 3
harbour: porth 5, Penporth
valley: cwm 5, ystrad 4, dyffryn 2, glyn 2, Blaencwm 2
market: marchnad 2, maerdre 2, Faerdre
castle: castell 5, Hengastell
mouth: aber 6, cymer 2
mount: mynydd 4, moel 3, ban 2, Penmynydd 2
shore: traeth 3, glan 3, morfa 2, Pentraeth
island: ynys 6
lake: Llyn 12, Penllyn, Talyllyn
haven: porth 4, hafan 2
marsh: cors 4, morfa 3, gwern 3, Pengors, Morfa
spring: ffynnon 4, pistyll 2, blaen 2
meadow: dol 5, gwaun 4, Dolau, Penyddol
grove: llwyn 5, celli 3, Penllwyn 2, Pencelli 2
bank: glan 5, torlan
mill: melin 5, pandy 2, Felindre 2, Pandy
bay: porth 3, traeth 2
cape: penrhyn 4, trwyn 3, pen 3
cliff: clogwyn 3, craig 3, allt 2, dibyn
tower: twr 3
ridge: cefn 5, esgair 4, trum 2, Pencefn
pass: bwlch 5, drws, Penybwlch, Tanybwlch
heath: rhos 5, gwaun 2, Penrhos 3, Hirwaun, Rhosydd
pool: Pwll 5, +bwll, Glasbwll
well: ffynnon 4, pydew
camp: lluest 4, llety 2, gwersyll 2
mine: mwynglawdd 2, cloddfa 2
quarry: chwarel 3, cloddfa 2
temple: eglwys 4, llan 3, Henllan
abbey: mynachlog 2, mynachdy 2, clas+ 2, llan+ 3, Mynachlog
river: Afon
brook: Nant 4, Ffrwd 2
water: Dwr 3, +ddwr 2
keep: castell 3, twr 2
hold: caer 3, din+ 2
watch: gwylfa 3, disgwylfa 2
rest: gorffwysfa 2, llety 2
end: pen 3, tal+ 4
landing: glanfa 2, cei 2, porth 2
gate: porth 3, llidiart 2, drws 2
wall: magwyr 3, mur 3
rock: carreg 5, craig 4, maen 3, Penygraig 2, Pencraig
crag: craig 5, clegyr 3, Tanygraig, Creigiau
fell: moel 4, mynydd 3, Moelfre
run: Nant 3, Ffrwd 3, +nant
falls: rhaeadr 4, pistyll 3, sgwd 2
garden: garth 3, perllan 2, gardd 2
hedge: perth 3, gwrych 2
den: ffau 2
nest: nyth 2
hearth: aelwyd
court: llys 5, cwrt 2, Henllys
seat: eisteddfa 3, cadair 3
horn: corn 2
head: pen 6, Pentir 2
point: trwyn 4, pen 2
reef: sarn 2
sands: tywyn 4, traeth 3
dune: tywyn 4
waste: diffwys 2, rhos
fen: cors 3, gwern 3, mign 2, Pengors
glade: llannerch 4
glen: glyn 5, cwm 3
hollow: pant 5, cwm 2, Blaenpant
gorge: ceunant 4, hafn 2
peak: ban 3, pen 3, crib 2, moel 2
spire: pigyn
cave: ogof 4
forge: efail 4
barrow: crug 4, carn 3, tomen 2, gorsedd 2
grave: bedd 3
shrine: capel 4, betws 3, merthyr+ 3
hermitage: dyserth 2, cil+ 2
crossing: rhyd 3, sarn 3, croes 2
ferry: porth 2
fork: cymer 4, aber 2
bend: ystum 3, tro 2
beacon: ban 2, gwylfa
square: maes 2
inn: tafarn 3, llety 3
barn: ysgubor 3, beudy 2
vineyard: gwinllan 3
pasture: ffridd 4, hafod 3, porfa 2
lodge: lluest 3, llety 2, bwthyn 2
table: bwrdd
tarn: Llyn
tree: pren 3
way: sarn 4, heol 2, ffordd 2
dike: clawdd 4
guard: gwylfa 3

# modifiers
new: +newydd 5, Newydd 2
old: hen+
great: +*m'awr 5, *m'awr 3
little: +*b'ach 5, *b'ach 3, +*b'ychan 2
long: +hir 4, Hir 2, hir+
broad: +*ll'ydan 3, *ll'ydan 2
deep: +*dwfn 2, *dwfn
high: +uchel 3, Uchel 2, uchel+
low: +isel 3, Isel 2
upper: +uchaf 2, Uchaf 4
lower: +isaf 2, Isaf 4
middle: +*c'anol 3, *c'anol 2
north: +*g'ogledd, *g'ogledd 2
south: +*d'eheu, *d'eheu 2
east: +*d'wyrain, *d'wyrain 2
west: +*g'orllewin, *g'orllewin 2
black: +*d'u 5, *d'u 3, du+
white: +*gwyn 5, *gwyn 2, gwyn+
red: +*c'och 5, *c'och 2, coch+
green: +*g'las 4, *g'las 2, glas+, +*gwyrdd
golden: +aur 2, Euraid
grey: +*ll'wyd 4, *ll'wyd 2, llwyd+
blue: +*g'las 2, *g'las
dark: +*t'ywyll 2, *t'ywyll
bright: +*g'loyw 2, *g'loyw
yellow: +*melyn 2, *melyn
cold: +oer 3, Oer 2
warm: +cynnes, Cynnes
dry: +sych 3, Sych 2
wet: +gwlyb, Gwlyb
quiet: +*t'awel 2, *t'awel
wild: +*g'arw 3, *g'arw 2, garw+, +*g'wyllt 2
fair: +*t'eg 4, *t'eg 2, +hardd
free: +rhydd, Rhydd
far: +pell 2, Pell
lone: +unig 2, Unig
burnt: +llosg 3, Llosg
broken: +hollt, Hollt
sweet: +melys 2, Melys
bitter: +chwerw, Chwerw
hard: +*c'aled 2, *c'aled
strong: +*c'adarn 2, *c'adarn
merry: +*ll'awen 2, *ll'awen
crooked: +*c'am 3, *c'am, cam+
narrow: +*c'ul 3, *c'ul 2
steep: +serth 2, Serth
flat: +*g'wastad 2, *g'wastad
round: +*crwn 3, *crwn 2
swift: +*b'uan 2, *b'uan
clear: +*g'loyw 3, *g'loyw
barren: +noeth 2, Noeth
bleak: +*ll'wm 2, *ll'wm
poor: +tlawd, Tlawd
rich: +bras 2, Bras
blessed: +*b'endigaid, *b'endigaid 2, +*gwyn 2
dead: +marw, Marw
dun: +*ll'wyd
oak: +derw 4, Derw, +derwen 2, Derwen, +y'dderwen
pine: +pin 2, Pin, +y'pin
birch: +bedw 5, Bedw, +y'bedw 2
ash: +onnen 4, Onnen, +y'onnen 2, +y'ynn
elm: +llwyf 3, Llwyf
willow: +helyg 4, Helyg, +y'helyg 2
thorn: +drain 4, Drain, +y'drain 2, +y'ddraenen
reed: +brwyn 3, Brwyn, +y'brwyn 2, +y'cawn
rose: +rhosyn, Rhosyn, +y'rhosyn
apple: +afallen 2, Afallen, +y'afallen, +afal 2, Afal
wolf: +blaidd 4, Blaidd, +y'blaidd 2
bear: +arth 3, Arth, +y'arth 2
eagle: +eryr 4, Eryr, +y'eryr 2
deer: +carw 3, Carw, +y'carw 2, +hydd 2, Hydd, +y'hydd
horse: +march 4, March, +y'march 2, +meirch 2, Meirch, +y'meirch
ox: +ychen 3, Ychen, +y'ych 2
sheep: +defaid 2, Defaid, +y'defaid, +y'wyn
goat: +geifr 3, Geifr, +y'afr 2
fox: +llwynog 3, Llwynog, +y'llwynog 2, +cadno 2, Cadno, +y'cadno
boar: +moch 2, Moch, +y'moch, +twrch 3, Twrch, +y'twrch 2
raven: +bran 4, Bran, +y'fran 2
hawk: +hebog 3, Hebog, +y'hebog 2, +gwalch 2, Gwalch, +y'gwalch
swan: +alarch 3, Alarch, +y'alarch 2
crane: +garan 3, Garan, +y'garan 2
gull: +gwylan 3, Gwylan, +y'wylan 2
seal: +morlo 2, Morlo, +y'morlo
fish: +pysgod 2, Pysgod, +y'pysgod
otter: +dyfrgi 2, Dyfrgi, +y'dyfrgi
stone: +maen 4, Maen, +y'maen 2, +cerrig 2, Cerrig, +y'cerrig
iron: +haearn 3, Haearn
copper: +copr, Copr
silver: +arian 3, Arian
gold: +aur 3, Aur
salt: +halen 3, Halen, +y'halen 2, +y'heli
sand: +tywod 3, Tywod, +y'tywod 2
clay: +clai 2, Clai, +y'clai, +y'pridd
chalk: +calch 2, Calch, +y'calch
wind: +gwynt 3, Gwynt, +y'gwynt 2, +awel 2, Awel
mist: +niwl 3, Niwl, +y'niwl 2
snow: +eira 3, Eira, +y'eira 2
storm: +storm, Storm, +y'storm
holy: +sant, Sant, +y'saint
king: +brenin 3, Brenin, +y'brenin 2
queen: +brenhines, Brenhines, +y'frenhines
lord: +arglwydd 2, Arglwydd, +y'arglwydd
priest: +offeiriad, Offeiriad, +y'offeiriad, +esgob 3, Esgob, +y'esgob 2
merchant: +masnachwr, Masnachwr
hunter: +helwyr 2, Helwyr, +y'helwyr
fisher: +pysgotwr, Pysgotwr, +y'pysgotwr
smith: +gof 4, Gof, +y'gof 2
shepherd: +bugail 3, Bugail, +y'bugail 2
winter: +gaeaf 3, Gaeaf, +y'gaeaf 2
summer: +haf 4, Haf, +y'haf 2
autumn: +hydref 2, Hydref
dawn: +gwawr 2, Gwawr, +y'wawr
night: +nos 2, Nos, +y'nos
sun: +haul 3, Haul, +y'haul 2
moon: +lloer 3, Lloer, +y'lloer 2
star: +ser 3, Ser, +y'ser 2, +y'seren
sky: +nef 2, Nef, +y'nef
cloud: +cwmwl, Cwmwl, +y'cwmwl
rain: +glaw 2, Glaw, +y'glaw
frost: +rhew 3, Rhew, +y'rhew 2
ice: +ia, Ia
thunder: +taran 2, Taran, +y'daran
shadow: +cysgod 3, Cysgod, +y'cysgod 2
fire: +tan 3, Tan, +y'tan 2
smoke: +mwg 2, Mwg, +y'mwg
blood: +gwaed 2, Gwaed, +y'gwaed
bone: +esgyrn 2, Esgyrn, +y'esgyrn
mud: +llaid 2, Llaid, +y'llaid
moss: +mwsogl 2, Mwsogl, +y'mwsogl
pearl: +perl, Perl
tin: +alcan, Alcan
bronze: +efydd, Efydd
steel: +dur 2, Dur
coal: +glo 3, Glo, +y'glo 2
flint: +callestr 2, Callestr
marble: +marmor, Marmor
slate: +llech 3, Llech, +y'lechen 2
honey: +mel 3, Mel, +y'mel 2
milk: +llaeth 2, Llaeth
wine: +gwin 3, Gwin, +y'gwin 2
wheat: +gwenith 3, Gwenith, +y'gwenith 2
barley: +haidd 3, Haidd, +y'haidd 2
rye: +rhyg 3, Rhyg, +y'rhyg 2
hay: +gwair 3, Gwair, +y'gwair 2
flax: +llin 2, Llin, +y'llin
wool: +gwlan 2, Gwlan, +y'gwlan
hop: +hopys, Hopys
dragon: +draig 2, Draig, +y'ddraig
serpent: +neidr 2, Neidr, +y'neidr
lion: +llew 2, Llew, +y'llew
ram: +hwrdd 2, Hwrdd, +y'hwrdd
hound: +cwn 2, Cwn, +y'cwn
cat: +cath, Cath, +y'gath, +y'cathod
hare: +ceinach 2, Ceinach, +ysgyfarnog, Ysgyfarnog
badger: +broch 3, Broch, +y'broch 2
beaver: +afanc 3, Afanc, +y'afanc 2
bat: +ystlum, Ystlum, +y'ystlum
owl: +tylluan 2, Tylluan, +y'dylluan
crow: +brain 3, Brain, +y'brain 2
heron: +crychydd 2, Crychydd, +y'crychydd
goose: +gwyddau 2, Gwyddau, +y'gwyddau
duck: +hwyaid 2, Hwyaid, +y'hwyaid
dove: +colomen 2, Colomen, +y'golomen
lark: +ehedydd 2, Ehedydd, +y'ehedydd
nightingale: +eos 3, Eos, +y'eos 2
pike: +penhwyad, Penhwyad
salmon: +eog 3, Eog, +y'eog 2
eel: +llysywen, Llysywen
toad: +llyffant 2, Llyffant, +y'llyffant
bee: +gwenyn 3, Gwenyn, +y'gwenyn 2
rooster: +ceiliog 2, Ceiliog, +y'ceiliog
holly: +celyn 4, Celyn, +y'celyn 2
ivy: +iorwg 2, Iorwg, +eiddew 2, Eiddew
yew: +yw 2, Yw, +y'yw, +ywen 3, Ywen, +y'ywen 2
alder: +gwern 4, Gwern, +y'wern 2
hazel: +cyll 3, Cyll, +y'cyll 2, +y'gollen
rowan: +criafol 2, Criafol, +y'griafolen
linden: +pisgwydd, Pisgwydd
beech: +ffawydd 2, Ffawydd, +y'ffawydd
maple: +masarn 2, Masarn, +y'masarn
aspen: +aethnen 2, Aethnen, +y'aethnen
poplar: +poplys, Poplys, +y'poplys
heather: +grug 4, Grug, +y'grug 2
nettle: +danadl 2, Danadl, +y'danadl
cherry: +ceirios 2, Ceirios, +y'ceirios
pear: +gellyg 2, Gellyg, +y'gellyg
berry: +mwyar 3, Mwyar, +y'mwyar 2
flower: +blodau 2, Blodau, +y'blodau
leaf: +dail 2, Dail, +y'dail
acorn: +mes 2, Mes, +y'mes
grass: +gwellt 2, Gwellt, +y'gwellt, +meillion 2, Meillion
lady: +rhiain, Rhiain, +y'rhiain
maiden: +morwyn 2, Morwyn, +y'forwyn, +y'forynion
widow: +gweddw, Gweddw, +y'weddw
knight: +marchog 3, Marchog, +y'marchog 2
monk: +mynach 4, Mynach, +y'mynach 2, +y'mynaich
hermit: +meudwy 2, Meudwy, +y'meudwy
witch: +gwrach 2, Gwrach, +y'wrach
giant: +cawr 3, Cawr, +y'cawr 2, +y'cewri
ghost: +bwgan, Bwgan, +y'bwgan, +ellyll 2, Ellyll, +y'ellyll
god: +duw 2, Duw
devil: +diafol, Diafol, +y'diafol
thief: +lladron 2, Lladron, +y'lladron
robber: +lladron 2, Lladron, +y'lladron
pilgrim: +pererin 2, Pererin, +y'pererinion
sailor: +llongwr, Llongwr
miller: +melinydd 2, Melinydd, +y'melinydd
weaver: +gwehydd, Gwehydd, +y'gwehydd
carpenter: +saer 2, Saer, +y'saer
warrior: +milwr 2, Milwr, +y'milwyr
elder: +henwr, Henwr, +y'henwr
crone: +gwrach 2, Gwrach, +y'wrach
sword: +cleddyf, Cleddyf, +y'cleddyf
axe: +bwyell, Bwyell, +y'fwyell
bell: +cloch, Cloch, +y'gloch
harp: +telyn, Telyn, +y'delyn
wheel: +rhod, Rhod, +y'rhod
ship: +llong, Llong, +y'llong, +y'llongau
boat: +cwch, Cwch, +y'cwch
cross: +croes, Croes, +y'groes
feather: +plu, Plu
gallows: +crogbren, Crogbren, +y'grocbren
peace: +hedd 2, Hedd
wonder: +gwyrth, Gwyrth

# numerals
two: *dau+
three: *tri+
five: pum+
seven: saith+
nine: naw+
ten: deg+
hundred: can+
thousand: mil+

# lands
land: +ion 4, +iog 3, +wg 4, +ydd 2, +edd 2, bro+ 3, Bro 2, tir+ 2, Tir
country: gwlad+, Gwlad 3, tir+, Tir
domain: cantref+, Cantref 2, bro+ 2
`,
  settled: 0.5,
  patterns: {
    feature: { weight: 14 },
    "modifier-generic": {
      weight: 40,
      templates: "{generic}{modifier} 14, {generic} {modifier} 3, {modifier}{generic} 4"
    },
    "owner-generic": { weight: 26, female: 0.13, templates: "{generic}{root} 12, {generic} {root}" },
    "generic-of": {
      weight: 22,
      templates: "{generic}{root} 5, {generic}ar{root}, aber{root} 4, glan{root}, ystrad{root}"
    },
    compound: {
      weight: 10,
      templates:
        "{generic}{modifier} 6, {generic} {modifier} 2, {modifier}{generic} 3, pen{generic}{modifier} 2, blaen{generic}{modifier}"
    },
    relative: { weight: 6, templates: "{root} {modifier}" },
    "root-land": { templates: "{root}{generic} 6, {generic}{root}, {generic} {root}" },
    "modifier-land": { templates: "{generic}{modifier} 2, {generic} {modifier} 2" }
  }
};
