import type { WrittenNameBase } from "@/types/names";

// Tai words that head a name: what stands at a place, then what a settlement is and the numerals
const PLACES =
  "kamphaeng|krathom|saphan|prasat|khlong|thanon|ruean|thung|talat|bueng|chedi|chong|pratu|khung|thang|suan|sala|dong|khao|khok|noen|khai|khua|huai|wang|fang|nong|phru|laem|that|pang|thap|plai|tham|rang|chom|kuti|yung|khan|rai|don|tha|pom|hup|kat|pak|sop|doi|phu|hat|sap|pha|san|dan|kio|wat|mae|nam|lam|hua|hin|tat|sai|lum|yot|tao|lan|ton|fai|na|ho|pa|ko|ao|bo|sa";
const HEADS = `${PLACES}|ban|bang|chiang|wiang|mueang|nakhon|krung|phra|khwaen|monthon|thap|khum|lan|song|sam|ha|chet|kao|sip|roi|phan`;

export const thai: WrittenNameBase = {
  id: "thai",
  description: "Places of Thailand and Laos",
  length: [4, 12],

  places: {
    names: [
      "Sukhothai",
      "Ayutthaya",
      "Lopburi",
      "Singburi",
      "Suphanburi",
      "Kanchanaburi",
      "Ratchaburi",
      "Phetchaburi",
      "Saraburi",
      "Chonburi",
      "Nonthaburi",
      "Thonburi",
      "Prachinburi",
      "Chanthaburi",
      "Phetchabun",
      "Inburi",
      "Phromburi",
      "Pathumthani",
      "Uthaithani",
      "Suratthani",
      "Udonthani",
      "Ubon",
      "Ratchathani",
      "Nakhon Sawan",
      "Nakhon Pathom",
      "Nakhon Nayok",
      "Nakhon Phanom",
      "Nakhon Chaisi",
      "Nakhon Thai",
      "Sakon Nakhon",
      "Nakhon Luang",
      "Phitsanulok",
      "Phichit",
      "Phichai",
      "Kamphaeng Phet",
      "Sawankhalok",
      "Satchanalai",
      "Uttaradit",
      "Thung Yang",
      "Chainat",
      "Ang Thong",
      "Samut Sakhon",
      "Samut Prakan",
      "Samut Songkhram",
      "Chachoengsao",
      "Rayong",
      "Trat",
      "Klaeng",
      "Bangkok",
      "Bang Pa In",
      "Bang Pakong",
      "Bang Saen",
      "Bang Sai",
      "Bang Ban",
      "Bang Rachan",
      "Bang Len",
      "Bang Phae",
      "Bang Khla",
      "Bang Bo",
      "Bang Bua Thong",
      "Bang Yai",
      "Bang Kruai",
      "Bang Lamung",
      "Chiang Mai",
      "Chiang Rai",
      "Chiang Saen",
      "Chiang Khong",
      "Chiang Kham",
      "Chiang Dao",
      "Chiang Khan",
      "Chiang Muan",
      "Chiang Klang",
      "Chiang Rung",
      "Chiang Tung",
      "Lamphun",
      "Lampang",
      "Phrae",
      "Nan",
      "Phayao",
      "Thoeng",
      "Fang",
      "Phrao",
      "Hot",
      "Wiang Sa",
      "Wiang Pa Pao",
      "Wiang Kum Kam",
      "Wiang Chai",
      "Wiang Haeng",
      "Mae Sai",
      "Mae Chan",
      "Mae Sariang",
      "Mae Hong Son",
      "Mae Sot",
      "Mae Rim",
      "Mae Taeng",
      "Mae Chaem",
      "Mae Ramat",
      "Mae Phrik",
      "Mae Wang",
      "Mae Tha",
      "Doi Saket",
      "Doi Tao",
      "Doi Lo",
      "San Kamphaeng",
      "San Sai",
      "San Pa Tong",
      "Saraphi",
      "Hang Dong",
      "Samoeng",
      "Pai",
      "Khun Yuam",
      "Pang Mapha",
      "Tak",
      "Ban Tak",
      "Sam Ngao",
      "Thoen",
      "Li",
      "Ko Kha",
      "Hang Chat",
      "Wang Nuea",
      "Wang Thong",
      "Wang Chin",
      "Long",
      "Song",
      "Pua",
      "Thung Chang",
      "Tha Wang Pha",
      "Na Noi",
      "Na Muen",
      "Nakhon Chum",
      "Nong Khai",
      "Nong Bua",
      "Nong Saeng",
      "Nong Han",
      "Nong Phai",
      "Nong Khae",
      "Nong Chang",
      "Nong Ki",
      "Nong Rua",
      "Nong Song Hong",
      "Khon Kaen",
      "Kalasin",
      "Mahasarakham",
      "Roi Et",
      "Yasothon",
      "Amnat Charoen",
      "Mukdahan",
      "Loei",
      "Chaiyaphum",
      "Buriram",
      "Surin",
      "Sisaket",
      "Ratchasima",
      "Phimai",
      "Pak Chong",
      "Pak Thong Chai",
      "Dan Sai",
      "Dan Khun Thot",
      "Chok Chai",
      "Sung Noen",
      "Sikhio",
      "Nang Rong",
      "Lam Plai Mat",
      "Phutthaisong",
      "Satuek",
      "Prasat",
      "Sangkha",
      "Rattanaburi",
      "Tha Tum",
      "Suwannaphum",
      "Phon Thong",
      "Selaphum",
      "Phanom Phrai",
      "Kamalasai",
      "Yang Talat",
      "Kumphawapi",
      "Ban Phue",
      "Ban Dung",
      "Sawang",
      "That Phanom",
      "Tha Uthen",
      "Renu Nakhon",
      "Na Kae",
      "Tha Bo",
      "Phon Phisai",
      "Bueng Kan",
      "Si Chiang Mai",
      "Sangkhom",
      "Khemarat",
      "Trakan",
      "Warin",
      "Det Udom",
      "Phibun",
      "Khong Chiam",
      "Si Racha",
      "Bang Saphan",
      "Pran Buri",
      "Hua Hin",
      "Tha Yang",
      "Ban Laem",
      "Khao Yoi",
      "Kui Buri",
      "Chumphon",
      "Lang Suan",
      "Chaiya",
      "Phunphin",
      "Tha Chana",
      "Sichon",
      "Tha Sala",
      "Pak Phanang",
      "Hua Sai",
      "Thung Song",
      "Thung Yai",
      "Ron Phibun",
      "Phatthalung",
      "Songkhla",
      "Sathing Phra",
      "Ranot",
      "Trang",
      "Huai Yot",
      "Krabi",
      "Phuket",
      "Thalang",
      "Takua Pa",
      "Ranong",
      "Phangnga",
      "Khlong Luang",
      "Khlong Thom",
      "Huai Thalaeng",
      "Huai Krachao",
      "Don Chedi",
      "Song Phi Nong",
      "U Thong",
      "Doem Bang",
      "Sam Chuk",
      "Phanom Thuan",
      "Tha Maka",
      "Tha Muang",
      "Sai Yok",
      "Thong Pha Phum",
      "Bo Phloi",
      "Photharam",
      "Ban Pong",
      "Damnoen",
      "Chom Bueng",
      "Suan Phueng",
      "Pak Tho",
      "Amphawa",
      "Krathum Baen",
      "Sam Phran",
      "Kamphaeng Saen",
      "Don Tum",
      "Lat Krabang",
      "Phra Pradaeng",
      "Phanat Nikhom",
      "Phan Thong",
      "Phanom Sarakham",
      "Kabin",
      "Sa Kaeo",
      "Aranya",
      "Watthana",
      "Phaniat",
      "Ban Mi",
      "Tha Wung",
      "Khok Samrong",
      "Chai Badan",
      "Phra Phutthabat",
      "Kaeng Khoi",
      "Muak Lek",
      "Nong Don",
      "Ban Mo",
      "Sao Hai",
      "Sena",
      "Phak Hai",
      "Uthai",
      "Wang Noi",
      "Maharat",
      "Banphot",
      "Phayuha",
      "Takhli",
      "Tha Tako",
      "Krok Phra",
      "Manorom",
      "Sankhaburi",
      "Wat Sing",
      "Thap Than",
      "Ban Rai",
      "Lan Sak",
      "Luang Phabang",
      "Wiang Chan",
      "Champasak",
      "Sawannakhet",
      "Chiang Khwang",
      "Mueang Phuan",
      "Pak Lai",
      "Pak Beng",
      "Mueang Sing",
      "Huai Sai"
    ]
  },

  waters: {
    mode: "pick",
    names: [
      "Ping",
      "Wang",
      "Yom",
      "Nan",
      "Pasak",
      "Thachin",
      "Maeklong",
      "Khwae",
      "Mun",
      "Chi",
      "Kok",
      "Ing",
      "Fang",
      "Pai",
      "Moei",
      "Salawin",
      "Khong",
      "Songkhram",
      "Loei",
      "Phong",
      "Takhong",
      "Bangpakong",
      "Rayong",
      "Chanthabun",
      "Welu",
      "Trat",
      "Pran",
      "Tapi",
      "Trang",
      "Saiburi",
      "Kolok",
      "Yuam",
      "Chaem",
      "Taeng",
      "Kuang",
      "Ngao",
      "Khan",
      "Ngum",
      "Kading",
      "Phao",
      "Phrom",
      "Choen",
      "Sakae",
      "Yang",
      "Phachi",
      "Kwan",
      "Phayao",
      "Nonghan",
      "Lamtakhong",
      "Sai",
      "Ruak",
      "Lai",
      "Soeng",
      "Khek"
    ]
  },

  people: {
    male: {
      mode: "pick",
      names: [
        "Ramkhamhaeng",
        "Naresuan",
        "Mangrai",
        "Tilokarat",
        "Narai",
        "Inthrathit",
        "Loethai",
        "Lithai",
        "Sailuethai",
        "Uthong",
        "Ramathibodi",
        "Ramesuan",
        "Borommaracha",
        "Trailok",
        "Chairacha",
        "Chakkraphat",
        "Mahin",
        "Thammaracha",
        "Ekathotsarot",
        "Songtham",
        "Phetracha",
        "Suea",
        "Ekkathat",
        "Taksin",
        "Ngammueang",
        "Saenphu",
        "Khamfu",
        "Phayu",
        "Kuena",
        "Yotchiangrai",
        "Kaeo",
        "Ketklao",
        "Kawila",
        "Chueang",
        "Lawachak",
        "Phrom",
        "Singhanawat",
        "Fangum",
        "Samsaenthai",
        "Wisun",
        "Photisarat",
        "Setthathirat",
        "Suriyawong",
        "Anuwong",
        "Phichai",
        "Khunphaen",
        "Saming",
        "Kraithong",
        "Sangthong",
        "Inao",
        "Surasi",
        "Wetsandon",
        "Ruang",
        "Bodin",
        "Phrommathat",
        "Thirat",
        "Sua",
        "Khamdaeng",
        "Thaisa",
        "Nakkha",
        "Sithat",
        "Phalat",
        "Chaiyot",
        "Kongkham",
        "Saenkham",
        "Tonkham",
        "Phanom",
        "Thepharak",
        "Inthara",
        "Yotfa"
      ]
    },
    female: {
      mode: "pick",
      names: [
        "Suriyothai",
        "Chamathewi",
        "Suphankanlaya",
        "Sisudachan",
        "Thepkasattri",
        "Wisutthithewi",
        "Chiraprapha",
        "Yothathep",
        "Yothathip",
        "Nopphamat",
        "Mukda",
        "Saikham",
        "Wanthong",
        "Phimphilalai",
        "Butsaba",
        "Rochana",
        "Bua",
        "Buakaeo",
        "Kinnari",
        "Manora",
        "Mali",
        "Chanthra",
        "Dara",
        "Ubon",
        "Sida",
        "Uthumphon",
        "Phikun",
        "Kesini",
        "Suchada",
        "Malini",
        "Nuan",
        "Suranari",
        "Thongkham",
        "Nangkaeo",
        "Kaeota",
        "Phaka",
        "Urai"
      ]
    }
  },

  rules: [
    { match: "(.)\\1+", replace: "$1" },
    { match: "\\bchian(?!g)", replace: "chiang" },
    { match: "chian(?!g)", replace: "chiang", at: "join" },
    // what stands at the place leads: an Indic word goes after it, Nong Pathum, and a town of it is its Mueang
    { match: `^(?!(?:${HEADS})\\+)([a-z]+)\\+(${PLACES})$`, replace: "$2+$1", at: "join" },
    { match: `^(${PLACES})\\+(?:buri|nakhon)$`, replace: "mueang+$1", at: "join" },
    { match: `^(${PLACES})\\+thani$`, replace: "wiang+$1", at: "join" },
    { match: `^(${PLACES})\\+(?:rat|rattha|phum|sima|prathet)$`, replace: "lan+$1", at: "join" },
    // an Indic word so moved gives way to the Tai one
    String.raw`
\+nawa$ => +mai | join
\+maha$ => +luang | join
\+ratcha$ => +luang | join
\+kala$ => +dam | join
\+sawet$ => +khao | join
\+(?:uttara|udon)$ => +nuea | join
\+thaksin$ => +tai | join
\+(?:prachin|burapha)$ => +tawanok | join
\+patchim$ => +tawantok | join
\+(?:suphan|suwanna|kanchana)$ => +thong | join
\+hiran$ => +ngoen | join
\+si$ => +ngam | join
\+(?:sukho|santi)$ => +suk | join
\+hongsa$ => +hong | join
\+nakha$ => +nak | join
\+chantha$ => +chan | join
\+wichai$ => +chai | join
\+phetcha$ => +phet | join
a\+(?=aram$) =>  | join
i\+(?=aram$) => iy | join`,
    { match: "^([a-z]+)\\+([a-z]+)\\+", replace: "$1 $2+", at: "join" }, // Ban Nongyai
    { match: "^(nakhon|mueang|krung|phra|khwaen|monthon)\\+", replace: "$1 ", at: "join" },
    { match: "\\+(?=nakhon$)", replace: " ", at: "join" },
    { match: "(?<=[aeiou])\\+(?=[aeiouy])", replace: " ", at: "join" },
    { match: "(ng|.)\\+(?=\\1)", replace: "$1 ", at: "join" },
    { match: `^(?=[^ ]{12,}$)(${HEADS})\\+`, replace: "$1 ", at: "join" },
    { match: `(?<=^| )(${HEADS})\\+`, replace: "$1 ", chance: 0.25 }, // Nong Khai, but Lampang
    { match: "^(hua|klang|nai|chai|rim) (?=[^aeiou][a-z]{1,5}$)", replace: "$1", chance: 0.4 },
    { match: "^([a-z]{7,})(buri|thani|khiri)$", replace: "$1 $2", when: "long" }
  ],

  // two layers: an Indic compound in one word, its describing word first (ratcha+, +buri), and a Tai noun with what
  // describes it after (nong, +yai), in one word or two: Ratchaburi, Nong Khai, Chiangmai
  lexicon: `
# settlements
city: +buri 8, +thani 5, nakhon+ 3, +nakhon 2, chiang+ 5, wiang+ 2, mueang+ 2, krung+
town: +buri 6, +thani 2, chiang+ 3, wiang+ 3, mueang+ 2, bang+ 4
village: ban+ 6, bang+ 6, +buri 2
hamlet: ban+ 5, bang+ 2, thap+ 3, khum+

# places
home: ban+ 3, ruean
farm: rai 3, suan 3, na 3
hall: ho 3, sala 2
field: na 6, thung 5, rai 2
wood: pa 5, dong 5, +wan
hill: khao 5, khok 5, noen 2, don 3, +khiri 4
ford: tha 4
fort: khai 3, pom 2, +prakan 3
bridge: saphan 5, khua 2
harbour: tha 6
valley: hup 3, huai 3
market: talat 5, kat 3
castle: wang 3, prasat 4, +wiman 2
mouth: pak 6, sop 2
mount: khao 5, doi 5, phu 5, +khiri 3, +banphot 2
shore: hat 5, fang 2, +samut
island: ko 6, don 2
lake: bueng 5, nong 4, +sakhon 2
haven: ao 3, tha 2
marsh: nong 3, bueng 3, phru 2
spring: sap 4, bo 3
meadow: thung 5, na 2
grove: suan 3, pa 2, dong 2
bank: fang 3, tha 2
bay: ao 5
cape: laem 6
cliff: pha 6
tower: ho 4, chedi 2, that
ridge: san 5
pass: chong 4, dan 3, kio 2
heath: thung 3, khok 3
pool: nong 6, sa 3, wang 3
well: bo 5
camp: pang 4, khai 3, thap 3
mine: bo 3
quarry: bo
temple: wat 5, +aram 2, +wihan
abbey: wat 5, +aram 3
river: mae 6, nam 4, lam 3, +nathi 2
brook: huai 6, khlong 4, lam 2
water: nam 5, +wari 3
keep: pom 2, wiang+, +prakan 2
hold: wiang+ 2, pom, dan
watch: dan 3, ho 2
rest: sala 3
end: plai 3, hua
landing: tha 4
gate: pratu 4, dan 2, +thawan
wall: kamphaeng 3, +prakan 2
rock: hin 5, pha 2, +sila
crag: pha 4, hin
fell: phu 3, doi 3, khao
run: huai 3, lam 2
falls: tat 4
garden: suan 5
den: tham 2
nest: rang 2
court: wang 4
head: hua 6
point: laem 3, hua
reef: hin 2
sands: hat 4, sai 2
dune: noen 2, don 2
fen: nong 2, bueng 2, phru 2
glade: thung 2, na 2
glen: huai 3, hup 2
hollow: lum 4, hup
gorge: chong 3
peak: yot 2, chom 4, +khiri
spire: chedi 2, yot
cave: tham 6
forge: tao 3
barrow: khok 3, noen 2
shrine: that 3, san 2, ho
hermitage: kuti 2
crossing: tha 3
ferry: tha 3
fork: sop 5, pak 2
bend: khung 5
beacon: ho
square: lan 2
inn: sala 2
barn: yung 2
vineyard: suan 2
pasture: thung 3
lodge: krathom 2, thap+ 2
tarn: nong 2, sa 2
tree: ton 4
way: thang 2, thanon 2
dike: khan 3, fai 3
guard: dan 5
eye: sa

# modifiers
new: +mai 7, nawa+ 2
old: +kao 5
great: +yai 5, +luang 4, maha+ 4
little: +noi 5, +lek 2
long: +yao 4
broad: +kwang 3
deep: +luek 3
high: +sung 4
low: +tam 2
upper: +nuea 4, +bon 2
lower: +tai 4, +lang 2
middle: +klang 4, +matcha
north: +nuea 3, udon+ 3, uttara+ 2
south: +tai 3, thaksin+ 2
east: prachin+ 3, burapha+ 2, +tawanok 2
west: patchim+ 3, +tawantok 2
black: +dam 5, kala+ 2
white: +khao 4, sawet+ 2
red: +daeng 5
green: +khiao 3
golden: +thong 4, suphan+ 3, kanchana+ 3, suwanna+ 2
yellow: +lueang 3
grey: +thao 2
blue: +khram 2, nila+ 2
dark: +muet 2
bright: +saeng 3, +rueang 2, prapha+
oak: +sak 4, +teng 2, +rang 2
pine: +son 4
ash: +yang 4
elm: +takhian 2
willow: +khrai 3
thorn: +phutsa 3
reed: +phai 4, +khaem 3, +o
rose: +kulap 2
apple: +mamuang 3
linden: +pho 4
beech: +takhian 2, +yang
poplar: +ngio 3
alder: +lamphu 3
cedar: +chan 2, chan+
rowan: +khun 2
maple: +sak 2
hazel: +makham 3
cherry: +wa 2
pear: +mamuang
berry: +mao 2
spruce: +son
flower: +bua 5, pathum+ 4, ubon+ 2, kamon+
leaf: +tong 2
grass: +ya 2, +kha 3
mushroom: +het 2
bear: +mi 3
lynx: +suea 3
cat: +suea 2, +maeo
lion: sing+ 5, +sing 3
eagle: khrut 2, insi+
hawk: +yiao 3
deer: +kwang 4
horse: +ma 4, atsawa+
ox: +wua 2, +khwai 4
bison: +krathing 3
sheep: +kae
goat: +phae 3
boar: +mu 4
raven: +ka 4
crow: +ka 4
swan: +hong 4, hongsa+ 2
crane: +krarian 2
stork: +krasa 2
heron: +yang 3
goose: +han 2
duck: +pet 4
dove: +phirap, +khao 2
gull: +nangnuan
otter: +nak 2
fish: +pla 5
eel: +lai 2
crab: +pu 4
whale: +wan
toad: +kop 3
lizard: +chorakhe 2
serpent: +ngu 4, nakha+ 2
dragon: +nak 4, nakha+ 3
hare: +kratai 3
rat: +nu 2
bat: +khangkhao
bee: +phueng 4
rooster: +kai 4
nightingale: +duwao 2
stone: +hin 4, sila+ 2
iron: +lek 4
copper: +thongdaeng 2
bronze: samrit 2
silver: +ngoen 4, hiran+ 2
gold: +thong 4, +kham 4, kanchana+ 3, suphan+ 3
salt: +kluea 4
sand: +sai 4
clay: +din 4
chalk: +pun 3
mud: +len 2, +tom 2
coal: +than 3
tin: +dibuk 2
steel: +kla 2
slate: +chanuan
pearl: muk 3, mukda+ 2
crystal: phetcha+ 5, +phet 3, +kaeo 4
glass: +kaeo 2
cold: +yen 4, +nao 2
warm: +un 2, +ron 2
dry: +laeng 4, +haeng 2
wind: +lom 3
mist: +mok 3
snow: hima+ 2
storm: +phayu 2
rain: +fon 3
quiet: +ngiap 2, santi+ 2
wild: +pa 2
fair: +ngam 4, si+ 4, +suai
holy: phra+ 4, +saksit
free: +thai 3
king: ratcha+ 6, +luang 2
queen: thewi+ 2, rachini+
lord: +khun 3, +chao 3
priest: +phram 3
monk: +phra 3
merchant: wanit+ 2
hunter: +phran 4
fisher: +pramong 2
smith: +chang 3
potter: +mo 3
winter: +nao 2
summer: +ron 2
dusk: sonthaya+, +kham
dawn: arun+ 3, +rung 3, uthai+ 3
night: ratri+ 2
sun: suriya+ 3, athit+
moon: chantha+ 4, +duean 2
star: dara+ 2, +dao 4
sky: +fa 3, sawan 2, nopha+
cloud: +mek 3
thunder: asani+
shadow: +ngao 3
fire: +fai 3
smoke: +khwan 2
blood: +lueat 2
dust: +fun
honey: +phueng 3
milk: +nom
wine: +lao 2
wheat: +khao 4
barley: +khao 2
hay: +fang 3
flax: +po 3
pea: +thua 3
far: +klai 2
lone: +diao 2
broken: +hak 3, +taek 2
drowned: +chom 2
bitter: +khom 3
sweet: +wan 4
hard: +khaeng 2
strong: +kla 2
merry: sukho+ 3, +suk 3
crooked: +khot 4
rich: sombun 3
blessed: mongkhon 3
lucky: chok 3
narrow: +khaep 2
steep: +chan 2
flat: +rap 3
round: +klom 3, +mon 2
swift: +chiao 3
clear: +sai 3, +kaeo
true: satcha+ 2
victory: chai 4, wichai+ 2
glory: yot+, kiat+
peace: santi+ 3, +suk 2
love: +rak 2
lady: +nang 4
maiden: +sao 3
god: thep 5, in+ 4, phrom+ 4, phitsanu+ 2
ghost: +phi 3
giant: +yak 3
knight: +khun 2
warrior: +han 2
elder: +thao 3
sword: +dap 3
axe: +khwan
bell: +rakhang 3
harp: +phin 2
wheel: chakkra+ 2
ring: +waen 2
boat: +ruea 4
ship: +samphao 4
anchor: +samo 3
candle: +thian 3
treasure: rattana+ 5, +sap 2
wing: +pik 2
thief: +chon 2
robber: +chon 2
friend: mit+ 2

# numerals
two: song+
three: sam+
five: ha+
seven: chet+
nine: kao+
ten: sip+
hundred: roi+
thousand: phan+

# lands
land: lan+ 5, +phum 6, +rat 6
country: khwaen+ 3, +prathet 2
realm: +rattha
domain: khwaen+ 2, monthon+
march: +sima 3
coast: fang+ 2
isles: +thawip
`,
  settled: 0.5,
  patterns: {
    feature: {
      weight: 15,
      templates: "hua {generic} 3, klang {generic} 2, nai {generic} 2, rim {generic}, chai {generic}"
    },
    "modifier-generic": { weight: 45, templates: "{modifier}{generic} 10, {generic}{modifier} 5" },
    "owner-generic": {
      weight: 18,
      female: 0.14,
      templates: "{root}{generic} 8, {generic}{root} 4, {root}, phra{root}"
    },
    "generic-of": { weight: 12, templates: "{generic}{root} 4, {root}{generic} 2, {root} 2, pak{root}, mueang {root}" },
    compound: {
      weight: 10,
      templates: "{settlement}{generic}{modifier} 2, {generic}{modifier} 3, {modifier}{generic}"
    },
    relative: { weight: 5, templates: "{root} {modifier}, {root}{modifier}, {modifier}{root}" },
    "root-land": { templates: "{root}{generic} 7, {generic}{root} 2" },
    "modifier-land": { templates: "{modifier}{generic} 5, {generic}{modifier} 4" }
  }
};
