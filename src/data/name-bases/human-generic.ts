import type { WrittenNameBase } from "@/types/names";

// English as high fantasy tells it: describing words stand apart as often as they join (Black Keep, Greyhaven),
// founders take a possessive (Aldric's Watch), seats end in Keep, Hold and Hall; the rest is English's
export const humanGeneric: WrittenNameBase = {
  id: "human-generic",
  name: "Human Generic",
  extends: "english",
  length: [5, 12],
  settled: 0.5, // half the names say what stands at the place: a keep, a vale, a hollow

  places: {
    names: [
      "Aldermere",
      "Aldor",
      "Aldwyn",
      "Ambergate",
      "Amberly",
      "Anwick",
      "Archenwood",
      "Ardel",
      "Ardmore",
      "Arlen",
      "Arnost",
      "Ashcombe",
      "Ashenvale",
      "Astor",
      "Avenor",
      "Banwick",
      "Barran",
      "Barrowdale",
      "Belmarch",
      "Blackhaven",
      "Blackmoor",
      "Bracken",
      "Brackenmoor",
      "Brann",
      "Brenmoor",
      "Brenna",
      "Briarwatch",
      "Brightvale",
      "Brynn",
      "Caddon",
      "Caddor",
      "Calden",
      "Calder",
      "Carlow",
      "Carran",
      "Carrow",
      "Coldwater",
      "Corran",
      "Corvin",
      "Cragmoor",
      "Crowhallow",
      "Dalmore",
      "Darnel",
      "Darrow",
      "Dawnhold",
      "Deepmere",
      "Dellor",
      "Dornwall",
      "Dorran",
      "Drumhold",
      "Dunmarrow",
      "Dunmore",
      "Dunstan",
      "Duskwatch",
      "Edane",
      "Edgemoor",
      "Elden",
      "Elderholt",
      "Elmshire",
      "Emberfall",
      "Embermoor",
      "Erran",
      "Eskdale",
      "Esker",
      "Estmarch",
      "Faircombe",
      "Fallowmere",
      "Felmoor",
      "Fenmarch",
      "Fenn",
      "Fennick",
      "Ferran",
      "Frostgate",
      "Frostmere",
      "Galmoor",
      "Garron",
      "Garrow",
      "Gaunt",
      "Glenmarrow",
      "Goldmere",
      "Gorran",
      "Gorse",
      "Greyhallow",
      "Greymarch",
      "Greywatch",
      "Haldor",
      "Hallam",
      "Hallowmere",
      "Harlow",
      "Harrow",
      "Harrowgate",
      "Hawkmoor",
      "Heathmere",
      "Highcrest",
      "Highmarch",
      "Holloway",
      "Ironhold",
      "Ironmoor",
      "Istor",
      "Kaedon",
      "Kaldor",
      "Kell",
      "Kerran",
      "Kestrel",
      "Kingsmere",
      "Kingsreach",
      "Lanmoor",
      "Lannor",
      "Larkspur",
      "Lorn",
      "Lorne",
      "Lorrin",
      "Lowmarch",
      "Malden",
      "Mardon",
      "Marrick",
      "Marrowdale",
      "Merin",
      "Merrow",
      "Mirefield",
      "Moonfall",
      "Morden",
      "Morrin",
      "Morrow",
      "Mosswick",
      "Navar",
      "Norrow",
      "Northmarch",
      "Oakmere",
      "Orlen",
      "Orrin",
      "Orwen",
      "Pellam",
      "Pennmoor",
      "Penrith",
      "Pikestone",
      "Querrin",
      "Ravel",
      "Ravenhold",
      "Ravenmere",
      "Redmarch",
      "Rennick",
      "Rhosk",
      "Rhoswick",
      "Rodden",
      "Rookhallow",
      "Rothmere",
      "Saltmarsh",
      "Sarrow",
      "Shadowmere",
      "Silverdale",
      "Skarn",
      "Sorrowdale",
      "Stannor",
      "Starhaven",
      "Stonemarch",
      "Stormhold",
      "Storrow",
      "Sunfall",
      "Tarnwick",
      "Tarran",
      "Tarrow",
      "Tavor",
      "Thale",
      "Thornbury",
      "Thornhold",
      "Thurn",
      "Tolland",
      "Tolmere",
      "Torran",
      "Torwick",
      "Trevan",
      "Tumbleford",
      "Ulden",
      "Valemont",
      "Valen",
      "Vardel",
      "Varn",
      "Wardel",
      "Wardmoor",
      "Wenlow",
      "Westhaven",
      "Westmarch",
      "Whitmoor",
      "Winterhallow",
      "Wolfsgate",
      "Wolfsmere",
      "Wychwood",
      "Wyndham",
      "Wyre",
      "Yarrow",
      "Yorn"
    ]
  },

  waters: {
    mode: "pick",
    names: [
      "Aire",
      "Alde",
      "Ambry",
      "Arle",
      "Asher",
      "Aven",
      "Bane",
      "Brann",
      "Briar",
      "Calder",
      "Carne",
      "Corrin",
      "Dane",
      "Darrow",
      "Eller",
      "Elver",
      "Esk",
      "Fenna",
      "Glim",
      "Greave",
      "Kennet",
      "Lisle",
      "Lorne",
      "Lune",
      "Marrow",
      "Morrow",
      "Nell",
      "Nene",
      "Orme",
      "Pell",
      "Quell",
      "Rane",
      "Rother",
      "Seld",
      "Swale",
      "Tamar",
      "Teme",
      "Thorne",
      "Tine",
      "Tumble",
      "Ure",
      "Vael",
      "Varrow",
      "Wend",
      "Wey",
      "Wharfe",
      "Wither",
      "Wyre",
      "Yarrow"
    ]
  },

  people: {
    male: {
      mode: "pick",
      names: [
        "Aldric",
        "Alaric",
        "Alyn",
        "Ambrose",
        "Anselm",
        "Arlan",
        "Aron",
        "Arthor",
        "Aubrey",
        "Baldric",
        "Barric",
        "Bartram",
        "Benedict",
        "Benfry",
        "Bertram",
        "Borin",
        "Bram",
        "Brandon",
        "Brennan",
        "Brom",
        "Cadric",
        "Caspar",
        "Cedric",
        "Corwin",
        "Coryn",
        "Dalric",
        "Daren",
        "Darian",
        "Denys",
        "Donnel",
        "Dorian",
        "Duncan",
        "Edmund",
        "Edric",
        "Edwyn",
        "Elric",
        "Emeric",
        "Emmon",
        "Everard",
        "Falk",
        "Gareth",
        "Garrick",
        "Garth",
        "Gawen",
        "Gerold",
        "Godric",
        "Hadrian",
        "Halder",
        "Harlan",
        "Harwin",
        "Hendry",
        "Herrold",
        "Hobart",
        "Hollis",
        "Hugh",
        "Humfrey",
        "Ivor",
        "Jarod",
        "Jasper",
        "Jonnel",
        "Kendric",
        "Kester",
        "Lambert",
        "Leoric",
        "Lewyn",
        "Lucan",
        "Lyonel",
        "Madoc",
        "Marek",
        "Mathis",
        "Merrick",
        "Mortimer",
        "Myles",
        "Niall",
        "Odo",
        "Orrin",
        "Osmund",
        "Osric",
        "Oswin",
        "Owain",
        "Perrin",
        "Piers",
        "Quentin",
        "Randal",
        "Raymund",
        "Renfred",
        "Rickard",
        "Robart",
        "Roderic",
        "Rolf",
        "Rowan",
        "Rufus",
        "Soren",
        "Steffon",
        "Theobald",
        "Tristan",
        "Ulric",
        "Uther",
        "Valen",
        "Varian",
        "Waltyr",
        "Warrick",
        "Wendel",
        "Willem",
        "Wolmer",
        "Wyl",
        "Wymund",
        "Wystan"
      ]
    },
    female: {
      mode: "pick",
      names: [
        "Adela",
        "Alayne",
        "Alys",
        "Amabel",
        "Aveline",
        "Beatrice",
        "Bethany",
        "Bryony",
        "Catrin",
        "Cerys",
        "Clarice",
        "Cordelia",
        "Delia",
        "Elara",
        "Eleyna",
        "Elinor",
        "Elowen",
        "Elyse",
        "Emmeline",
        "Freya",
        "Gilliane",
        "Gwen",
        "Gwyneth",
        "Helena",
        "Hilda",
        "Isolde",
        "Jeyne",
        "Jocelyn",
        "Kyra",
        "Leona",
        "Linnea",
        "Maren",
        "Margery",
        "Marissa",
        "Melara",
        "Meredith",
        "Nessa",
        "Odette",
        "Rhea",
        "Rohanne",
        "Rosalind",
        "Rowena",
        "Sabine",
        "Serra",
        "Seren",
        "Sybell",
        "Talia",
        "Tansy",
        "Una",
        "Wenda",
        "Willow",
        "Wren",
        "Ysilla",
        "Yvaine"
      ]
    }
  },
  rules: [
    { match: "([^deflnoprst])\\1+", replace: "$1" },
    { match: "(?<=[^aeiou][aeiou]t)\\+t(?=on)", replace: "tt", at: "join" }, // Sutton
    {
      match:
        "(?<=[a-z]{3} ?(?:water|bourne|burn|brook|beck|rill|run))\\+(?:ton|ham|by|wick|stead|ley|bury|town|haven|gate|hold|fall|port|reach|crest|mark|cote|croft|den)$",
      replace: "",
      at: "join"
    }, // a town on the Blackwater is Blackwater
    {
      match: "(?<=[a-z]{3}(?:water|bourne|burn|brook|beck|rill|run))\\+(?=[a-z]{3,}$)",
      replace: " ",
      at: "join"
    }, // what stands on the Blackwater is a word of its own: Blackwater Bridge
    { match: "(?<=^|[+ ])([a-z]{3,})(?=[+ ])(.*) \\1$", replace: "$1$2", at: "join" }, // Greenhollow, not Greenhollow Hollow
    { match: "(?<=[sc]e|x|sh|ch)\\+s\\+", replace: "+", at: "join" }, // Aliceford, not Alicesford
    { match: "ll\\+(?=ton)", replace: "l+", at: "join" },
    { match: "r\\+r", replace: "rr", at: "join" }, // Winterrest, Alderrock
    { match: "le\\+l(?=ey)", replace: "+l", at: "join" },
    { match: "s\\+s(?=t)", replace: "+s", at: "join" },
    { match: "s?chester$", replace: "cester", when: "long" }
  ],
  lexicon: `
# settlements
city: +haven 3, haven 2, +gate 2, gate 2, +hold 2, hold 2, +fall 3, +port 2, +town 2, +reach, Reach 2, +spire 2, +crest 2, +mark 2, +helm, +bury, +chester, +minster, Landing 2
town: +ton 3, +bury 2, +ham 2, +wick 2, +stead, +hall 2, Hall, +haven 2, +gate 2, +hold 2, Hold, +fall 2, +watch, Watch 2, +rest 2, Rest 2, +mark, +crest
village: +ton 4, +by 3, +ley 3, +ham 2, +stead 2, +wick 2, +cote 2, +bottom, +dell 2, +combe, +rest, +home 2, Green 3, End 2, Cross, Hollow 2
hamlet: +cote~cot 4, +ley 3, +stead 2, +croft 2, +nook 2, +end 2, +hole, +den 2, +thorpe 2, +by, End 3, Green 3, Nook 2, Cross 2, Row

# places
hall: hall
fort: Keep 4, +hold 3, Hold 2, +watch 2, Watch 2, +guard 2, Guard, +fort 2, Castle 2, +helm
castle: Castle 3, +castle 2, Keep
harbour: +port 3, Harbour 3, haven 2
market: +market 3, Market 2, +port, +cheap
valley: vale 4, dale 4, dell 2, +combe
mount: Mountain 3, mount 2, fell 2, +horn 2, pike
island: isle 3, Island 3, +ey 2, holm 2
haven: haven 4, Havens 2, +hythe
marsh: marsh 3, Marshes 2, fen 2, mire 2, moss
cliff: cliff 3, Cliffs 2, scar, edge
tower: tower 4, +tor
rock: rock 3, +stone 3, Stones
falls: Falls 3, +fall 3
garden: +garden 3, garden
hollow: hollow 4, +combe
peak: peak 3, +pike
barrow: barrow 3, Barrows 2, +howe
gate: gate 3, Gates 2
wall: wall 3, Walls 2
rest: Rest 3, +rest 2
guard: +guard 3, Guard 2, +ward
spire: spire 3, Spires

# modifiers
new: new
old: old 5, ald+
great: great
little: little
long: long
broad: broad 3, brad+
deep: deep
high: high
low: low 2, nether 2
upper: upper 2, over+
lower: lower 2, nether 2
middle: middle 2, mid+ 2
north: north 3, nor+
south: south 3, sud+
east: east 3, eas+
west: west 3, wes+
black: black
white: white
red: red
green: green
golden: golden 3, gold+ 2
grey: grey
blue: blue
dark: dark
bright: bright
stone: stone
iron: iron
copper: copper
silver: silver
gold: gold
salt: salt
amber: amber
glass: glass
crystal: crystal
bronze: bronze
steel: steel
marble: marble
cold: cold
wind: wind+ 3, Windy 2
mist: mist+ 3, Misty 3
snow: snow+ 3, Snowy
storm: storm+ 3, Storm's 2
frost: frost+ 3, Frozen 2
winter: winter+ 3, Winter's
quiet: quiet 2, still+
wild: wild
fair: fair
holy: holy 2, hallow+
free: free
dun: dun
pale: pale
crimson: crimson 2, scarlet 2
last: Last 3, last+
far: far
lone: lone 3, Lonely 2
lost: Lost
hidden: Hidden
broken: Broken
burnt: burnt 2, Burning
drowned: Drowned 3, Sunken 2
bitter: bitter
sweet: sweet
hard: hard 2, stark 2
strong: strong
sharp: sharp
dread: dread 4, dire 2
grim: grim
merry: merry
weeping: Weeping
whispering: Whispering
haunted: Haunted
sleeping: Sleeping
wandering: Wandering
singing: Singing
crooked: Crooked
barren: barren
bleak: bleak
proud: proud
cursed: Cursed 2, bane+
blessed: Blessed
narrow: narrow
steep: steep
round: round
swift: swift
clear: clear
true: true
dead: Dead 3, dead+

# lands
land: +land 4, +lands 3
march: +march 2, +mark 2, Marches
country: +shire 3, +dom
isles: Isles
`,
  patterns: {
    feature: { weight: 5, templates: "{generic} 3, The {generic}" },
    "modifier-generic": { templates: "{modifier}{generic} 5, {modifier} {generic} 5" },
    "owner-generic": {
      weight: 25,
      female: 0.1,
      templates: "{root}'s {generic} 5, {root}{generic} 4, {root}s{generic} 2"
    },
    "generic-of": { weight: 8, templates: "{root}{generic} 5, {root} {generic} 3, {root}" },
    compound: {
      weight: 22,
      templates: "{modifier}{generic} 4, {modifier}{generic} {settlement} 5, {modifier} {generic} 2"
    },
    relative: { weight: 6 },
    simplex: { weight: 10 },
    "modifier-land": { weight: 45, templates: "{modifier}{generic} 3, {modifier} {generic}" },
    "root-land": { weight: 25 }
  }
};
