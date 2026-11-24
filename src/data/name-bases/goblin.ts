import type { WrittenNameBase } from "@/types/names";

export const goblin: WrittenNameBase = {
  id: "goblin",
  name: "Goblin",
  length: [4, 9],

  places: {
    names: [
      "Asinx",
      "Bhiagielt",
      "Biokvish",
      "Blix",
      "Blus",
      "Bratliaq",
      "Breshass",
      "Bridvelb",
      "Brybsil",
      "Bugbig",
      "Buyagh",
      "Cel",
      "Chalk",
      "Chiafzia",
      "Chox",
      "Cielb",
      "Cosvil",
      "Crekork",
      "Crild",
      "Croibieq",
      "Diervaq",
      "Dobruing",
      "Driord",
      "Eebligz",
      "Een",
      "Enissee",
      "Esz",
      "Far",
      "Felhob",
      "Froihiofz",
      "Fruict",
      "Fygsee",
      "Gagablin",
      "Gigganqi",
      "Givzieqee",
      "Glamzofs",
      "Glernaahx",
      "Gneabs",
      "Gnoklig",
      "Gobbledak",
      "gobbok",
      "Gobbrin",
      "Heszai",
      "Hiszils",
      "Hobgar",
      "Honk",
      "Iahzaarm",
      "Ialsirt",
      "Ilm",
      "Ish",
      "Jasheafta",
      "Joimtoilm",
      "Kass",
      "Katmelt",
      "Kleabtong",
      "Kleardeek",
      "Klilm",
      "Kluirm",
      "Kuipuinx",
      "Moft",
      "Mogg",
      "Nilbog",
      "Oimzoishai",
      "Onq",
      "Ozbiard",
      "Paas",
      "Phax",
      "Phigheldai",
      "Preang",
      "Prolkeh",
      "Pyreazzi",
      "Qeerags",
      "Qosx",
      "Rekx",
      "Shaxi",
      "Sios",
      "Slehzit",
      "Slofboif",
      "Slukex",
      "Srefs",
      "Srurd",
      "Stiaggaltia",
      "Stiolx",
      "Stioskurt",
      "Stroir",
      "Strytzakt",
      "Stuikvact",
      "Styrzangai",
      "Suirx",
      "Swaxi",
      "Taxai",
      "Thelt",
      "Thresxea",
      "Thult",
      "Traglila",
      "Treaq",
      "Ulb",
      "Ulm",
      "Utha",
      "Utiarm",
      "Veekz",
      "Vohniots",
      "Vreagaald",
      "Watvielx",
      "Wrogdilk",
      "Wruilt",
      "Xurx",
      "Ziggek",
      "Zriokots"
    ]
  },

  people: {
    male: {
      names: [
        "Grik",
        "Snik",
        "Zog",
        "Blix",
        "Krit",
        "Mog",
        "Nix",
        "Rikt",
        "Skab",
        "Vrek",
        "Gribble",
        "Snot",
        "Bokk",
        "Drizz",
        "Fizz",
        "Glub",
        "Hruk",
        "Jank",
        "Klix",
        "Lurk",
        "Murg",
        "Nok",
        "Plix",
        "Quag",
        "Ruk",
        "Skiz",
        "Trik",
        "Urk",
        "Wizz",
        "Yik",
        "Zik",
        "Gnarl",
        "Skrag",
        "Blart",
        "Krink",
        "Mizzle",
        "Nubb",
        "Pok",
        "Razz",
        "Snig"
      ]
    },
    female: {
      names: [
        "Griza",
        "Blixa",
        "Krikka",
        "Mogra",
        "Nixi",
        "Rikka",
        "Skiva",
        "Vrekka",
        "Zizza",
        "Glinka",
        "Snika",
        "Trixa",
        "Yikka",
        "Zogga",
        "Bokka",
        "Fizza",
        "Murga",
        "Plixa",
        "Razza",
        "Wizza"
      ]
    }
  },
  rules: [{ match: "([^eag])\\1+", replace: "$1" }],
  settled: 0.75, // most goblin names are just what the burrow is: Zikix, the new town
  // a clicky, snickering tongue of one-syllable roots: the describing word comes first, now and then cut off by an apostrophe
  lexicon: `
# settlements
city: +gob 5, +glob 2, Gob
town: +ix 4, +ik 3, +ax 2
village: +ug 3, +ok 3, +ab 2
hamlet: +nik 3, +ip 2, +it 2

# places
home: +hob 3, Hob
farm: +grub 3, Grub
field: +skrub 2, Skrub
wood: +brak 3, Brak
hill: +gnok 3, Gnok
ford: +slosh 2, Slosh
fort: +stok 3, Stok
bridge: +brid 3, Brid
harbour: +dok 3, Dok
valley: +dip 3, Dip
market: +swop 3, Swop
castle: +klonk 3, Klonk
mouth: +gab 2, Gab
mount: +klom 3, Klom
shore: +slip 2, Slip
island: +blob 3, Blob
lake: +pud 3, Pud
haven: +snok 2, Snok
marsh: +muk 3, Muk
spring: +gurg 2, Gurg
meadow: +pluf 2, Pluf
grove: +twik 2, Twik
glade: +twik 2, Twik
bay: +gulp 3, Gulp
cliff: +skarp 2, Skarp
tower: +stak 3, Stak
ridge: +krag 2, Krag
camp: +skwat 2, Skwat
mine: +dug 3, Dug
temple: +zogg 2, Zogg
abbey: +hum 2, Hum
river: +swash 2, Swash
brook: +drib 2, Drib
run: +drib 2, Drib
water: +glug 2, Glug
keep: +stok 2, Stok
hold: +stash 2, Stash
watch: +peep 2, Peep
gate: +klak 2, Klak
rock: +krok 3, Krok
falls: +splat 2, Splat
cave: +grot 3, Grot
den: +hob 2, Hob
pool: +plop 2, Plop
head: +nog 2, Nog
point: +pik 2, Pik
peak: +spik 2, Spik
forge: +tonk 2, Tonk
inn: +swil 2, Swil
hall: +hob 2, Hob
hollow: +dip 2, Dip
glen: +dip 2, Dip
fell: +gnok 2, Gnok
heath: +skrub 2, Skrub
pasture: +pluf 2, Pluf
mill: +krunch 2, Krunch
cape: +pik 2, Pik
crag: +krag 2, Krag
bend: +wonk 2, Wonk
bank: +slip 2, Slip
crossing: +slosh 2, Slosh
sands: +grit 2, Grit

# modifiers
new: zik
old: mog
great: glam
little: snik
long: slok
deep: dub
high: styr
low: sluk
upper: styr
lower: sluk
middle: twix
north: krek
south: swax
east: rex
west: wrog
black: blix
white: gneb
red: krik
green: gliv
grey: slem
dark: skab
gold: glit
bright: glit
silver: skee
iron: klank
stone: krok
bone: skrak
skull: nog
mud: glub
moss: fuz
fire: fiz
smoke: fug
shadow: shax
night: shax
storm: bresh
wind: fwiz
cold: frik
ice: frik
blood: rek
dead: gak
broken: krak
crooked: wonk
sharp: pik
hidden: sneek
wild: wiz
grim: grot
cursed: nix
holy: zog
priest: hum
salt: siz
god: zog
king: gub
lord: gub
thief: nab
merchant: swop
smith: tonk
rat: rikt
bat: flit
spider: skit
toad: blorp
crow: kraw
raven: kraw
wolf: yark
boar: snork
hound: yap
mushroom: pof
thorn: prik
oak: ulb
elm: ulm
fish: slup
two: dib
three: trib
seven: zep
nine: nug

# lands
land: +uz 3, +oz 2
folk: +mob 2
`,
  patterns: {
    "modifier-generic": { templates: "{modifier}{generic} 8, {modifier}'{generic} 1" },
    "owner-generic": { weight: 20, templates: "{root}{generic} 4, {root}'{generic}" },
    compound: { weight: 12 },
    simplex: { weight: 20 },
    "root-land": { weight: 25 },
    "modifier-land": { weight: 22 }
  }
};
