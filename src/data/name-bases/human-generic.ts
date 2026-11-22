import { CONCEPTS, type Concept } from "@/data/name-concepts";
import type { Formant, NameBase } from ".";

// the base speaks plain English: a concept goes by its own word
const words = Object.fromEntries(Object.keys(CONCEPTS).map(concept => [concept, [{ form: concept }]]));

export const humanGeneric: NameBase = {
  id: "human-generic",
  name: "Human Generic",
  length: [6, 11],
  // biome-ignore format: a corpus reads as one line
  places: { names: ["Amberglen", "Angelhand", "Arrowden", "Autumnband", "Autumnkeep", "Basinfrost", "Basinmore", "Bayfrost", "Beargarde", "Bearmire", "Bellcairn", "Bellport", "Bellreach", "Blackwatch", "Bleakward", "Bonemouth", "Boulder", "Bridgefalls", "Bridgeforest", "Brinepeak", "Brittlehelm", "Bronzegrasp", "Castlecross", "Castlefair", "Cavemire", "Claymond", "Claymouth", "Clearguard", "Cliffgate", "Cliffshear", "Cliffshield", "Cloudbay", "Cloudcrest", "Cloudwood", "Coldholde", "Cragbury", "Crowgrove", "Crowvault", "Crystalrock", "Crystalspire", "Cursefield", "Curseguard", "Cursespell", "Dawnforest", "Dawnwater", "Deadford", "Deadkeep", "Deepcairn", "Deerchill", "Demonfall", "Dewglen", "Dewmere", "Diredale", "Direden", "Dirtshield", "Dogcoast", "Dogmeadow", "Dragonbreak", "Dragonhold", "Dragonward", "Dryhost", "Dustcross", "Dustwatch", "Eaglevein", "Earthfield", "Earthgate", "Earthpass", "Ebonfront", "Edgehaven", "Eldergate", "Eldermere", "Embervault", "Everchill", "Evercoast", "Falsevale", "Faypond", "Fayvale", "Fayyard", "Fearpeak", "Flameguard", "Flamewell", "Freyshell", "Ghostdale", "Ghostpeak", "Gloomburn", "Goldbreach", "Goldyard", "Grassplains", "Graypost", "Greeneld", "Grimegrove", "Grimeshire", "Heartfall", "Heartford", "Heartvault", "Highbourne", "Hillpass", "Hollowstorm", "Honeywater", "Houndcall", "Houndholde", "Iceholde", "Icelight", "Irongrave", "Ironhollow", "Knightlight", "Knighttide", "Lagoonpass", "Lakecross", "Lastmere", "Laststar", "Lightvale", "Limeband", "Littlehall", "Littlehold", "Littlemire", "Lostcairn", "Lostshield", "Loststar", "Madfair", "Madham", "Midholde", "Mightglen", "Millstrand", "Mistvault", "Mondpass", "Moonacre", "Moongulf", "Moonwell", "Mosshand", "Mosstide", "Mosswind", "Mudford", "Mudwich", "Mythgulch", "Mythshear", "Nevercrest", "Neverfront", "Newfalls", "Nighthall", "Oakenbell", "Oakenrun", "Oceanstar", "Oldreach", "Oldwall", "Oldwatch", "Oxbrook", "Oxlight", "Pearlhaven", "Pinepond", "Pondfalls", "Pondtown", "Pureshell", "Quickbell", "Quickpass", "Ravenside", "Roguehaven", "Roseborn", "Rosedale", "Rosereach", "Rustmore", "Saltmouth", "Sandhill", "Scorchpost", "Scorchstall", "Shadeforest", "Shademeadow", "Shadeville", "Shimmerrun", "Shimmerwood", "Shroudrock", "Silentkeep", "Silvercairn", "Silvergulch", "Smallmire", "Smoothcliff", "Smoothgrove", "Smoothtown", "Snakemere", "Snowbay", "Snowshield", "Snowtown", "Southbreak", "Springmire", "Springview", "Stagport", "Steammouth", "Steamwall", "Steepmoor", "Stillhall", "Stoneguard", "Stonespell", "Stormhand", "Stormhorn", "Sungulf", "Sunhall", "Swampmaw", "Swangarde", "Swanwall", "Swiftwell", "Thorncairn", "Thornhelm", "Thornyard", "Timberside", "Tradewick", "Westmeadow", "Westpoint", "Whiteshore", "Whitvalley", "Wildeden", "Wildwell", "Wildyard", "Winterhaven", "Wolfpass"] },
  rules: [{ match: "([^peolst])\\1+", replace: "$1" }],
  lexicon: {
    ...(words as Record<Concept, Formant[]>),
    land: [
      { form: "land", weight: 1, position: "last" },
      { form: "ia", weight: 9, position: "last" }
    ]
  }
};
