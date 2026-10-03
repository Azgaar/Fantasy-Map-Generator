// Word lists and weights for generated marker names and legends

export const MARKER_PINS = [
  "bubble",
  "pin",
  "square",
  "squarish",
  "diamond",
  "hex",
  "hexy",
  "shieldy",
  "shield",
  "pentagon",
  "heptagon",
  "circle",
  "no"
] as const;

/** Animals that migrate across each biome, by biome id; others see no migrations */
export const MIGRATING_ANIMALS: Record<number, string[]> = {
  1: ["Camels", "Antelopes", "Jackals", "Hyenas", "Scorpions", "Locusts"],
  2: ["Camels", "Goats", "Wolves", "Foxes", "Eagles", "Falcons"],
  3: ["Antelopes", "Buffalo", "Elephants", "Lions", "Hyenas", "Cranes", "Zebras"],
  4: ["Bisons", "Horses", "Deer", "Hares", "Geese", "Larks", "Wolves"],
  5: ["Apes", "Elephants", "Leopards", "Tigers", "Parrots", "Mantises"],
  6: ["Deer", "Boars", "Badgers", "Foxes", "Crows", "Rooks", "Bears", "Wolves"],
  7: ["Apes", "Jaguars", "Panthers", "Snakes", "Spiders", "Parrots"],
  8: ["Elk", "Deer", "Bears", "Beavers", "Owls", "Ravens"],
  9: ["Elk", "Moose", "Wolves", "Wolverines", "Martens", "Bears", "Ravens"],
  10: ["Reindeer", "Musk oxen", "Wolves", "Foxes", "Geese", "Hares", "Owls"],
  12: ["Herons", "Cranes", "Ibises", "Geese", "Crocodiles", "Frogs"]
};

export const WATER_SOURCE_TYPES = {
  "Healing Spring": 5,
  "Purifying Well": 2,
  "Enchanted Reservoir": 1,
  "Creek of Luck": 1,
  "Fountain of Youth": 1,
  "Wisdom Spring": 1,
  "Spring of Life": 1,
  "Spring of Youth": 1,
  "Healing Stream": 1
};

export const BRIDGE_ADJECTIVES = {
  stone: 10,
  wooden: 1,
  lengthy: 2,
  formidable: 2,
  rickety: 1,
  beaten: 1,
  weathered: 1
};

export const BRIDGE_DECLINE_REASONS = [
  "its collapse during the flood",
  "being rumoured to attract trolls",
  "the drying up of local trade",
  "banditry infested the area",
  "the old waypoints crumbled"
];

export const INN_COLORS = [
  "Dark",
  "Light",
  "Bright",
  "Golden",
  "White",
  "Black",
  "Red",
  "Pink",
  "Purple",
  "Blue",
  "Green",
  "Yellow",
  "Amber",
  "Orange",
  "Brown",
  "Grey"
];

export const INN_ANIMALS = [
  "Antelope",
  "Ape",
  "Badger",
  "Bear",
  "Beaver",
  "Bison",
  "Boar",
  "Buffalo",
  "Cat",
  "Crane",
  "Crocodile",
  "Crow",
  "Deer",
  "Dog",
  "Eagle",
  "Elk",
  "Fox",
  "Goat",
  "Goose",
  "Hare",
  "Hawk",
  "Heron",
  "Horse",
  "Hyena",
  "Ibis",
  "Jackal",
  "Jaguar",
  "Lark",
  "Leopard",
  "Lion",
  "Mantis",
  "Marten",
  "Moose",
  "Mule",
  "Narwhal",
  "Owl",
  "Panther",
  "Rat",
  "Raven",
  "Rook",
  "Scorpion",
  "Shark",
  "Sheep",
  "Snake",
  "Spider",
  "Swan",
  "Tiger",
  "Turtle",
  "Wolf",
  "Wolverine",
  "Camel",
  "Falcon",
  "Hound",
  "Ox"
];

export const INN_ADJECTIVES = [
  "New",
  "Good",
  "High",
  "Old",
  "Great",
  "Big",
  "Major",
  "Happy",
  "Main",
  "Huge",
  "Far",
  "Beautiful",
  "Fair",
  "Prime",
  "Ancient",
  "Golden",
  "Proud",
  "Lucky",
  "Fat",
  "Honest",
  "Giant",
  "Distant",
  "Friendly",
  "Loud",
  "Hungry",
  "Magical",
  "Superior",
  "Peaceful",
  "Frozen",
  "Divine",
  "Favorable",
  "Brave",
  "Sunny",
  "Flying"
];

export const INN_COOKING_METHODS = [
  "Boiled",
  "Grilled",
  "Roasted",
  "Spit-roasted",
  "Stewed",
  "Stuffed",
  "Jugged",
  "Mashed",
  "Baked",
  "Braised",
  "Poached",
  "Marinated",
  "Pickled",
  "Smoked",
  "Dried",
  "Dry-aged",
  "Corned",
  "Fried",
  "Pan-fried",
  "Deep-fried",
  "Dressed",
  "Steamed",
  "Cured",
  "Syrupped",
  "Flame-Broiled"
];

/** Inn fare by good name, served only where the inn's market has the good */
export const INN_COURSES_BY_GOOD: Record<string, string[]> = {
  Cattle: ["beef", "veal"],
  Sheep: ["lamb", "mutton"],
  Game: ["hare", "rabbit", "hart", "deer", "antlers", "bear", "buffalo", "badger", "beaver", "boar", "pheasant"],
  Fish: ["carp", "bass", "pike", "catfish", "sturgeon", "escallop", "eel"],
  Whales: ["whale", "seal"],
  Camels: ["camel"],
  Grain: ["bread", "pie", "cake", "pottage", "pudding", "pasta"],
  Olives: ["olives"],
  Dates: ["dates"],
  Cheese: ["cheese"]
};

export const INN_COMMON_COURSES = [
  "pork",
  "bacon",
  "chicken",
  "goose",
  "duck",
  "pigeon",
  "chevon",
  "eggs",
  "onions",
  "carrot",
  "potato",
  "beet",
  "garlic",
  "cabbage",
  "spinach",
  "peas",
  "beans",
  "pumpkin",
  "apples",
  "pears",
  "rat tails",
  "pig ears"
];

/** Served only where it is 18°C or warmer */
export const INN_WARM_COURSES = [
  "rice",
  "chickpea",
  "eggplant",
  "zucchini",
  "pepper",
  "tomatoes",
  "melon",
  "oranges",
  "mango"
];

export const INN_DRINK_KINDS = [
  "hot",
  "cold",
  "fire",
  "ice",
  "smoky",
  "misty",
  "shiny",
  "sweet",
  "bitter",
  "salty",
  "sour",
  "sparkling",
  "smelly"
];

export const INN_DRINKS_BY_GOOD: Record<string, string[]> = {
  Wine: ["wine", "brandy"],
  Beer: ["beer", "ale"],
  Liquor: ["gin", "whisky", "rum", "vodka", "tequila", "absinthe", "liquor", "spirits"],
  Grain: ["kvass"],
  Honey: ["mead", "nectar"],
  Sugarcane: ["rum"],
  Tea: ["tea"],
  Cattle: ["milk"],
  Horses: ["kumis"]
};

export const INN_COMMON_DRINKS = ["water", "cider", "juice", "sap"];

export const WATERFALL_DESCRIPTIONS = [
  "A gorgeous waterfall flows here.",
  "The rapids of an exceptionally beautiful waterfall.",
  "An impressive waterfall has cut through the land.",
  "The cascades of a stunning waterfall.",
  "A river drops down from a great height forming a wondrous waterfall.",
  "A breathtaking waterfall cuts through the landscape."
];

export const RUMOR_SOURCES = [
  "Locals",
  "Elders",
  "Inscriptions",
  "Tipplers",
  "Legends",
  "Whispers",
  "Rumors",
  "Journeying folk",
  "Tales"
];

export const HILL_MONSTER_ADJECTIVES = [
  "great",
  "big",
  "huge",
  "prime",
  "golden",
  "proud",
  "lucky",
  "fat",
  "giant",
  "hungry",
  "magical",
  "superior",
  "terrifying",
  "horrifying",
  "feared"
];

export const HILL_MONSTER_SPECIES = [
  "Ogre",
  "Troll",
  "Cyclops",
  "Giant",
  "Monster",
  "Beast",
  "Dragon",
  "Undead",
  "Ghoul",
  "Vampire",
  "Hag",
  "Banshee",
  "Bearded Devil",
  "Roc",
  "Hydra",
  "Warg"
];

export const HILL_MONSTER_HABITS = [
  "steals cattle at night",
  "prefers eating children",
  "doesn't mind human flesh",
  "keeps the region at bay",
  "eats kids whole",
  "abducts young women",
  "terrorizes the region",
  "harasses travelers in the area",
  "snatches people from homes",
  "attacks anyone who dares to approach its lair",
  "attacks unsuspecting victims"
];

export const BRIGAND_ANIMALS = [
  "Apes",
  "Badgers",
  "Bears",
  "Beavers",
  "Bisons",
  "Boars",
  "Cats",
  "Crows",
  "Dogs",
  "Foxes",
  "Hares",
  "Hawks",
  "Hyenas",
  "Jackals",
  "Jaguars",
  "Leopards",
  "Lions",
  "Owls",
  "Panthers",
  "Rats",
  "Ravens",
  "Rooks",
  "Scorpions",
  "Sharks",
  "Snakes",
  "Spiders",
  "Tigers",
  "Wolfs",
  "Wolverines",
  "Falcons"
];

export const BRIGAND_TYPES = { brigands: 4, bandits: 3, robbers: 1, highwaymen: 1 };

export const STATUE_VARIANTS = [
  "Statue",
  "Obelisk",
  "Monument",
  "Column",
  "Monolith",
  "Pillar",
  "Megalith",
  "Stele",
  "Runestone",
  "Sculpture",
  "Effigy",
  "Idol"
];

export const STATUE_SCRIPTS = {
  cypriot: "𐠁𐠂𐠃𐠄𐠅𐠈𐠊𐠋𐠌𐠍𐠎𐠏𐠐𐠑𐠒𐠓𐠔𐠕𐠖𐠗𐠘𐠙𐠚𐠛𐠜𐠝𐠞𐠟𐠠𐠡𐠢𐠣𐠤𐠥𐠦𐠧𐠨𐠩𐠪𐠫𐠬𐠭𐠮𐠯𐠰𐠱𐠲𐠳𐠴𐠵𐠷𐠸𐠼𐠿      ",
  geez: "ሀለሐመሠረሰቀበተኀነአከወዐዘየደገጠጰጸፀፈፐ   ",
  coptic: "ⲲⲴⲶⲸⲺⲼⲾⳀⳁⳂⳃⳄⳆⳈⳊⳌⳎⳐⳒⳔⳖⳘⳚⳜⳞⳠⳢⳤ⳥⳧⳩⳪ⳫⳬⳭⳲ⳹⳾   ",
  tibetan: "ༀ༁༂༃༄༅༆༇༈༉༊་༌༐༑༒༓༔༕༖༗༘༙༚༛༜༠༡༢༣༤༥༦༧༨༩༪༫༬༭༮༯༰༱༲༳༴༵༶༷༸༹༺༻༼༽༾༿",
  mongolian: "᠀᠐᠑᠒ᠠᠡᠦᠧᠨᠩᠪᠭᠮᠯᠰᠱᠲᠳᠵᠻᠼᠽᠾᠿᡀᡁᡆᡍᡎᡏᡐᡑᡒᡓᡔᡕᡖᡗᡙᡜᡝᡞᡟᡠᡡᡭᡮᡯᡰᡱᡲᡳᡴᢀᢁᢂᢋᢏᢐᢑᢒᢓᢛᢜᢞᢟᢠᢡᢢᢤᢥᢦ"
};

export const RUIN_TYPES = [
  "City",
  "Town",
  "Settlement",
  "Pyramid",
  "Fort",
  "Stronghold",
  "Temple",
  "Sacred site",
  "Mausoleum",
  "Outpost",
  "Fortification",
  "Fortress",
  "Castle"
];

export const LIBRARY_TYPES = { Library: 3, Archive: 1, Collection: 1 };

export const CIRCUS_ADJECTIVES = [
  "Fantastical",
  "Wondrous",
  "Incomprehensible",
  "Magical",
  "Extraordinary",
  "Unmissable",
  "World-famous",
  "Breathtaking"
];

export const JOUST_TYPES = ["Joust", "Competition", "Melee", "Tournament", "Contest"];

export const JOUST_VIRTUES = ["cunning", "might", "speed", "the greats", "acumen", "brutality"];

export const DANCE_TYPES = [
  "gala",
  "dance",
  "performance",
  "ball",
  "soiree",
  "jamboree",
  "exhibition",
  "carnival",
  "festival",
  "jubilee",
  "celebration",
  "gathering",
  "fete"
];

export const DANCE_GUESTS = [
  "great and the good",
  "nobility",
  "local elders",
  "foreign dignitaries",
  "spiritual leaders",
  "suspected revolutionaries"
];

export const MIRAGE_ADJECTIVES = ["Entrancing", "Diaphanous", "Illusory", "Distant", "Peculiar"];

export const CAVE_FORMATIONS = {
  Cave: 10,
  Cavern: 8,
  Chasm: 6,
  Ravine: 6,
  Fracture: 5,
  Grotto: 4,
  Pit: 4,
  Sinkhole: 2,
  Hole: 2
};

export const CAVE_STATUSES = {
  "a good spot to hid treasure": 5,
  "the home of strange monsters": 5,
  "totally empty": 4,
  "endlessly deep and unexplored": 4,
  "completely flooded": 2,
  "slowly filling with lava": 1
};

export const RIFT_TYPES = [
  "Demonic",
  "Interdimensional",
  "Abyssal",
  "Cosmic",
  "Cataclysmic",
  "Subterranean",
  "Ancient"
];

export const RIFT_EFFECTS = [
  "all known nearby beings to flee in terror",
  "cracks in reality itself to form",
  "swarms of foes to spill forth",
  "nearby plants to wither and decay",
  "an emmissary to step through with an all-powerful relic"
];

export const NECROPOLIS_TYPES = {
  Necropolis: 5,
  Crypt: 2,
  Tomb: 2,
  Graveyard: 1,
  Cemetery: 2,
  Mausoleum: 1,
  Sepulchre: 1
};

export const NECROPOLIS_LEGENDS = [
  "A foreboding necropolis shrouded in perpetual darkness, where eerie whispers echo through the winding corridors and spectral guardians stand watch over the tombs of long-forgotten souls.",
  "A towering necropolis adorned with macabre sculptures and guarded by formidable undead sentinels. Its ancient halls house the remains of fallen heroes, entombed alongside their cherished relics.",
  "This ethereal necropolis seems suspended between the realms of the living and the dead. Wisps of mist dance around the tombstones, while haunting melodies linger in the air, commemorating the departed.",
  "Rising from the desolate landscape, this sinister necropolis is a testament to necromantic power. Its skeletal spires cast ominous shadows, concealing forbidden knowledge and arcane secrets.",
  "An eerie necropolis where nature intertwines with death. Overgrown tombstones are entwined by thorny vines, and mournful spirits wander among the fading petals of once-vibrant flowers.",
  "A labyrinthine necropolis where each step echoes with haunting murmurs. The walls are adorned with ancient runes, and restless spirits guide or hinder those who dare to delve into its depths.",
  "This cursed necropolis is veiled in perpetual twilight, perpetuating a sense of impending doom. Dark enchantments shroud the tombs, and the moans of anguished souls resound through its crumbling halls.",
  "A sprawling necropolis built within a labyrinthine network of catacombs. Its halls are lined with countless alcoves, each housing the remains of the departed, while the distant sound of rattling bones fills the air.",
  "A desolate necropolis where an eerie stillness reigns. Time seems frozen amidst the decaying mausoleums, and the silence is broken only by the whispers of the wind and the rustle of tattered banners.",
  "A foreboding necropolis perched atop a jagged cliff, overlooking a desolate wasteland. Its towering walls harbor restless spirits, and the imposing gates bear the marks of countless battles and ancient curses."
];

export const ENCOUNTER_KINDS = [
  { subject: "Bandits", verb: "have set an ambush" },
  { subject: "Wild beasts", verb: "have been sighted" },
  { subject: "A lone traveler", verb: "was seen wandering" },
  { subject: "Cultists", verb: "gather in secret" },
  { subject: "A pilgrim", verb: "walks the road" },
  { subject: "Refugees", verb: "have made camp" },
  { subject: "Smugglers", verb: "move under cover of night" },
  { subject: "A hermit", verb: "dwells alone" },
  { subject: "Mercenaries", verb: "ride through" },
  { subject: "Poachers", verb: "have been active" }
];
