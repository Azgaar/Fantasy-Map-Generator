# names-generator.js

**You are an expert senior JavaScript developer specializing in refactoring legacy code into modern, modular, and environment-agnostic libraries. You have a deep understanding of design patterns like dependency injection and the separation of concerns.**

**Your Goal:**

Your task is to refactor a single JavaScript module from a legacy Fantasy Map Generator application. The goal is to migrate it from its old, browser-dependent format into a pure, headless-first ES module that will be part of a core generation engine. This engine must be able to run in any JavaScript environment, including Node.js, without any dependencies on a browser or DOM.

**Architectural Context:**

*   **Old Architecture:** The original code is wrapped in an IIFE and attaches its exports to the global `window` object. It directly reads from and mutates global state variables like `pack` and `grid`, and directly accesses the DOM via `byId()`.
*   **New Architecture (Target):**
    1.  **Core Engine:** A collection of pure ES modules. It receives all necessary data (`pack`, `grid`) and configuration as function arguments. It performs its logic and returns the newly generated data. It has **zero** knowledge of the browser.
    2.  **Viewer/Client:** The application responsible for all DOM interaction, UI, and rendering SVG based on the data object produced by the engine.

**The Golden Rules of Refactoring for the Core Engine:**

1.  **No Globals:** Remove the IIFE and the attachment to the `window` object.
2.  **Use ES Modules:** All exported functions and data must use the `export` keyword.
3.  **Dependency Injection:** Functions must not read from or mutate global state. All data they need (`pack`, `grid`) must be passed in as arguments.
4.  **Introduce a `config` Object:**
    *   **When you find code that reads a value from the DOM (e.g., `byId("statesNumber").value`), this is a configuration parameter.**
    *   **You must replace this DOM call with a property from a `config` object (e.g., `config.statesNumber`).**
    *   Add this `config` object as a new argument to the function's signature.
5.  **Return New Data:** Instead of modifying an object in place (e.g., `pack.cells.biome = ...`), functions should create the new data and return it. The calling function will be responsible for merging this data into the main state object.
6. **Pure functions:** Functions should not have side effects. They should either return a new state object or a specific piece of data.
7.  **Strict Separation of Concerns (Crucial):**
    *   **UI Input Reading:** As per Rule #4, these `byId()` calls are your guide to what properties the `config` object needs.
    *   **Rendering Logic:** Any code that **writes to the DOM or SVG** (e.g., `d3.select`, `document.getElementById(...).innerHTML = ...`, creating `<path>` elements, etc.) is considered rendering logic.
    *   **You must REMOVE all rendering logic** from the engine module.
8.  **Maintain Style:** Preserve the original code style, comments, and variable names as much as possible for consistency.
9. **Efficient Destructuring:** When passing a utils object, only destructure the specific properties needed within the scope of the function that uses them, rather than destructuring the entire object at the top of every function. This improves clarity and reduces code repetition.

---

**Concrete Example of Refactoring:**

**BEFORE (Legacy `burgs-and-states.js`):**

```javascript
// ...
function placeCapitals() {
  // Direct DOM read - THIS IS A CONFIGURATION VALUE
  let count = +byId("statesNumber").value; 
  // ...
}
// ...
```

**AFTER (Refactored `engine/modules/burgsAndStates.js`):**

```javascript
// ...
// Dependencies, including the new `config` object, are injected.
export function placeCapitals(cells, graphWidth, graphHeight, config) {
  // DOM read is replaced by a property from the `config` object.
  let count = config.statesNumber; 
  // ...
  // Returns the generated data
  return { burgs, states };
}
// ...
```

---

**Your Specific Task:**

Now, please apply these principles to refactor the following module: `names-generator.js`.

**File Content:**
```javascript
"use strict";

window.Names = (function () {
  let chains = [];

  // calculate Markov chain for a namesbase
  const calculateChain = function (string) {
    const chain = [];
    const array = string.split(",");

    for (const n of array) {
      let name = n.trim().toLowerCase();
      const basic = !/[^\u0000-\u007f]/.test(name); // basic chars and English rules can be applied

      // split word into pseudo-syllables
      for (let i = -1, syllable = ""; i < name.length; i += syllable.length || 1, syllable = "") {
        let prev = name[i] || ""; // pre-onset letter
        let v = 0; // 0 if no vowels in syllable

        for (let c = i + 1; name[c] && syllable.length < 5; c++) {
          const that = name[c],
            next = name[c + 1]; // next char
          syllable += that;
          if (syllable === " " || syllable === "-") break; // syllable starts with space or hyphen
          if (!next || next === " " || next === "-") break; // no need to check

          if (vowel(that)) v = 1; // check if letter is vowel

          // do not split some diphthongs
          if (that === "y" && next === "e") continue; // 'ye'
          if (basic) {
            // English-like
            if (that === "o" && next === "o") continue; // 'oo'
            if (that === "e" && next === "e") continue; // 'ee'
            if (that === "a" && next === "e") continue; // 'ae'
            if (that === "c" && next === "h") continue; // 'ch'
          }

          if (vowel(that) === next) break; // two same vowels in a row
          if (v && vowel(name[c + 2])) break; // syllable has vowel and additional vowel is expected soon
        }

        if (chain[prev] === undefined) chain[prev] = [];
        chain[prev].push(syllable);
      }
    }

    return chain;
  };

  const updateChain = i => {
    chains[i] = nameBases[i]?.b ? calculateChain(nameBases[i].b) : null;
  };

  const clearChains = () => {
    chains = [];
  };

  // generate name using Markov's chain
  const getBase = function (base, min, max, dupl) {
    if (base === undefined) return ERROR && console.error("Please define a base");

    if (nameBases[base] === undefined) {
      if (nameBases[0]) {
        WARN && console.warn("Namebase " + base + " is not found. First available namebase will be used");
        base = 0;
      } else {
        ERROR && console.error("Namebase " + base + " is not found");
        return "ERROR";
      }
    }

    if (!chains[base]) updateChain(base);

    const data = chains[base];
    if (!data || data[""] === undefined) {
      tip("Namesbase " + base + " is incorrect. Please check in namesbase editor", false, "error");
      ERROR && console.error("Namebase " + base + " is incorrect!");
      return "ERROR";
    }

    if (!min) min = nameBases[base].min;
    if (!max) max = nameBases[base].max;
    if (dupl !== "") dupl = nameBases[base].d;

    let v = data[""],
      cur = ra(v),
      w = "";
    for (let i = 0; i < 20; i++) {
      if (cur === "") {
        // end of word
        if (w.length < min) {
          cur = "";
          w = "";
          v = data[""];
        } else break;
      } else {
        if (w.length + cur.length > max) {
          // word too long
          if (w.length < min) w += cur;
          break;
        } else v = data[last(cur)] || data[""];
      }

      w += cur;
      cur = ra(v);
    }

    // parse word to get a final name
    const l = last(w); // last letter
    if (l === "'" || l === " " || l === "-") w = w.slice(0, -1); // not allow some characters at the end

    let name = [...w].reduce(function (r, c, i, d) {
      if (c === d[i + 1] && !dupl.includes(c)) return r; // duplication is not allowed
      if (!r.length) return c.toUpperCase();
      if (r.slice(-1) === "-" && c === " ") return r; // remove space after hyphen
      if (r.slice(-1) === " ") return r + c.toUpperCase(); // capitalize letter after space
      if (r.slice(-1) === "-") return r + c.toUpperCase(); // capitalize letter after hyphen
      if (c === "a" && d[i + 1] === "e") return r; // "ae" => "e"
      if (i + 2 < d.length && c === d[i + 1] && c === d[i + 2]) return r; // remove three same letters in a row
      return r + c;
    }, "");

    // join the word if any part has only 1 letter
    if (name.split(" ").some(part => part.length < 2))
      name = name
        .split(" ")
        .map((p, i) => (i ? p.toLowerCase() : p))
        .join("");

    if (name.length < 2) {
      ERROR && console.error("Name is too short! Random name will be selected");
      name = ra(nameBases[base].b.split(","));
    }

    return name;
  };

  // generate name for culture
  const getCulture = function (culture, min, max, dupl) {
    if (culture === undefined) return ERROR && console.error("Please define a culture");
    const base = pack.cultures[culture].base;
    return getBase(base, min, max, dupl);
  };

  // generate short name for culture
  const getCultureShort = function (culture) {
    if (culture === undefined) return ERROR && console.error("Please define a culture");
    return getBaseShort(pack.cultures[culture].base);
  };

  // generate short name for base
  const getBaseShort = function (base) {
    const min = nameBases[base] ? nameBases[base].min - 1 : null;
    const max = min ? Math.max(nameBases[base].max - 2, min) : null;
    return getBase(base, min, max, "", 0);
  };

  // generate state name based on capital or random name and culture-specific suffix
  const getState = function (name, culture, base) {
    if (name === undefined) return ERROR && console.error("Please define a base name");
    if (culture === undefined && base === undefined) return ERROR && console.error("Please define a culture");
    if (base === undefined) base = pack.cultures[culture].base;

    // exclude endings inappropriate for states name
    if (name.includes(" ")) name = capitalize(name.replace(/ /g, "").toLowerCase()); // don't allow multiword state names
    if (name.length > 6 && name.slice(-4) === "berg") name = name.slice(0, -4); // remove -berg for any
    if (name.length > 5 && name.slice(-3) === "ton") name = name.slice(0, -3); // remove -ton for any

    if (base === 5 && ["sk", "ev", "ov"].includes(name.slice(-2))) name = name.slice(0, -2);
    // remove -sk/-ev/-ov for Ruthenian
    else if (base === 12) return vowel(name.slice(-1)) ? name : name + "u";
    // Japanese ends on any vowel or -u
    else if (base === 18 && P(0.4))
      name = vowel(name.slice(0, 1).toLowerCase()) ? "Al" + name.toLowerCase() : "Al " + name; // Arabic starts with -Al

    // no suffix for fantasy bases
    if (base > 32 && base < 42) return name;

    // define if suffix should be used
    if (name.length > 3 && vowel(name.slice(-1))) {
      if (vowel(name.slice(-2, -1)) && P(0.85)) name = name.slice(0, -2);
      // 85% for vv
      else if (P(0.7)) name = name.slice(0, -1);
      // ~60% for cv
      else return name;
    } else if (P(0.4)) return name; // 60% for cc and vc

    // define suffix
    let suffix = "ia"; // standard suffix

    const rnd = Math.random(),
      l = name.length;
    if (base === 3 && rnd < 0.03 && l < 7) suffix = "terra";
    // Italian
    else if (base === 4 && rnd < 0.03 && l < 7) suffix = "terra";
    // Spanish
    else if (base === 13 && rnd < 0.03 && l < 7) suffix = "terra";
    // Portuguese
    else if (base === 2 && rnd < 0.03 && l < 7) suffix = "terre";
    // French
    else if (base === 0 && rnd < 0.5 && l < 7) suffix = "land";
    // German
    else if (base === 1 && rnd < 0.4 && l < 7) suffix = "land";
    // English
    else if (base === 6 && rnd < 0.3 && l < 7) suffix = "land";
    // Nordic
    else if (base === 32 && rnd < 0.1 && l < 7) suffix = "land";
    // generic Human
    else if (base === 7 && rnd < 0.1) suffix = "eia";
    // Greek
    else if (base === 9 && rnd < 0.35) suffix = "maa";
    // Finnic
    else if (base === 15 && rnd < 0.4 && l < 6) suffix = "orszag";
    // Hungarian
    else if (base === 16) suffix = rnd < 0.6 ? "yurt" : "eli";
    // Turkish
    else if (base === 10) suffix = "guk";
    // Korean
    else if (base === 11) suffix = " Guo";
    // Chinese
    else if (base === 14) suffix = rnd < 0.5 && l < 6 ? "tlan" : "co";
    // Nahuatl
    else if (base === 17 && rnd < 0.8) suffix = "a";
    // Berber
    else if (base === 18 && rnd < 0.8) suffix = "a"; // Arabic

    return validateSuffix(name, suffix);
  };

  function validateSuffix(name, suffix) {
    if (name.slice(-1 * suffix.length) === suffix) return name; // no suffix if name already ends with it
    const s1 = suffix.charAt(0);
    if (name.slice(-1) === s1) name = name.slice(0, -1); // remove name last letter if it's a suffix first letter
    if (vowel(s1) === vowel(name.slice(-1)) && vowel(s1) === vowel(name.slice(-2, -1))) name = name.slice(0, -1); // remove name last char if 2 last chars are the same type as suffix's 1st
    if (name.slice(-1) === s1) name = name.slice(0, -1); // remove name last letter if it's a suffix first letter
    return name + suffix;
  }

  // generato name for the map
  const getMapName = function (force) {
    if (!force && locked("mapName")) return;
    if (force && locked("mapName")) unlock("mapName");
    const base = P(0.7) ? 2 : P(0.5) ? rand(0, 6) : rand(0, 31);
    if (!nameBases[base]) {
      tip("Namebase is not found", false, "error");
      return "";
    }
    const min = nameBases[base].min - 1;
    const max = Math.max(nameBases[base].max - 3, min);
    const baseName = getBase(base, min, max, "", 0);
    const name = P(0.7) ? addSuffix(baseName) : baseName;
    mapName.value = name;
  };

  function addSuffix(name) {
    const suffix = P(0.8) ? "ia" : "land";
    if (suffix === "ia" && name.length > 6) name = name.slice(0, -(name.length - 3));
    else if (suffix === "land" && name.length > 6) name = name.slice(0, -(name.length - 5));
    return validateSuffix(name, suffix);
  }

  const getNameBases = function () {
    // name, min length, max length, letters to allow duplication, multi-word name rate [deprecated]
    // prettier-ignore
    return [
      // real-world bases by Azgaar:
      {name: "German", i: 0, min: 5, max: 12, d: "lt", m: 0, b: "Achern,Aichhalden,Aitern,Albbruck,Alpirsbach,Altensteig,Althengstett,Appenweier,Auggen,Badenen,Badenweiler,Baiersbronn,Ballrechten,Bellingen,Berghaupten,Bernau,Biberach,Biederbach,Binzen,Birkendorf,Birkenfeld,Bischweier,Blumberg,Bollen,Bollschweil,Bonndorf,Bosingen,Braunlingen,Breisach,Breisgau,Breitnau,Brigachtal,Buchenbach,Buggingen,Buhl,Buhlertal,Calw,Dachsberg,Dobel,Donaueschingen,Dornhan,Dornstetten,Dottingen,Dunningen,Durbach,Durrheim,Ebhausen,Ebringen,Efringen,Egenhausen,Ehrenkirchen,Ehrsberg,Eimeldingen,Eisenbach,Elzach,Elztal,Emmendingen,Endingen,Engelsbrand,Enz,Enzklosterle,Eschbronn,Ettenheim,Ettlingen,Feldberg,Fischerbach,Fischingen,Fluorn,Forbach,Freiamt,Freiburg,Freudenstadt,Friedenweiler,Friesenheim,Frohnd,Furtwangen,Gaggenau,Geisingen,Gengenbach,Gernsbach,Glatt,Glatten,Glottertal,Gorwihl,Gottenheim,Grafenhausen,Grenzach,Griesbach,Gutach,Gutenbach,Hag,Haiterbach,Hardt,Harmersbach,Hasel,Haslach,Hausach,Hausen,Hausern,Heitersheim,Herbolzheim,Herrenalb,Herrischried,Hinterzarten,Hochenschwand,Hofen,Hofstetten,Hohberg,Horb,Horben,Hornberg,Hufingen,Ibach,Ihringen,Inzlingen,Kandern,Kappel,Kappelrodeck,Karlsbad,Karlsruhe,Kehl,Keltern,Kippenheim,Kirchzarten,Konigsfeld,Krozingen,Kuppenheim,Kussaberg,Lahr,Lauchringen,Lauf,Laufenburg,Lautenbach,Lauterbach,Lenzkirch,Liebenzell,Loffenau,Loffingen,Lorrach,Lossburg,Mahlberg,Malsburg,Malsch,March,Marxzell,Marzell,Maulburg,Monchweiler,Muhlenbach,Mullheim,Munstertal,Murg,Nagold,Neubulach,Neuenburg,Neuhausen,Neuried,Neuweiler,Niedereschach,Nordrach,Oberharmersbach,Oberkirch,Oberndorf,Oberbach,Oberried,Oberwolfach,Offenburg,Ohlsbach,Oppenau,Ortenberg,otigheim,Ottenhofen,Ottersweier,Peterstal,Pfaffenweiler,Pfalzgrafenweiler,Pforzheim,Rastatt,Renchen,Rheinau,Rheinfelden,Rheinmunster,Rickenbach,Rippoldsau,Rohrdorf,Rottweil,Rummingen,Rust,Sackingen,Sasbach,Sasbachwalden,Schallbach,Schallstadt,Schapbach,Schenkenzell,Schiltach,Schliengen,Schluchsee,Schomberg,Schonach,Schonau,Schonenberg,Schonwald,Schopfheim,Schopfloch,Schramberg,Schuttertal,Schwenningen,Schworstadt,Seebach,Seelbach,Seewald,Sexau,Simmersfeld,Simonswald,Sinzheim,Solden,Staufen,Stegen,Steinach,Steinen,Steinmauern,Straubenhardt,Stuhlingen,Sulz,Sulzburg,Teinach,Tiefenbronn,Tiengen,Titisee,Todtmoos,Todtnau,Todtnauberg,Triberg,Tunau,Tuningen,uhlingen,Unterkirnach,Reichenbach,Utzenfeld,Villingen,Villingendorf,Vogtsburg,Vohrenbach,Waldachtal,Waldbronn,Waldkirch,Waldshut,Wehr,Weil,Weilheim,Weisenbach,Wembach,Wieden,Wiesental,Wildbad,Wildberg,Winzeln,Wittlingen,Wittnau,Wolfach,Wutach,Wutoschingen,Wyhlen,Zavelstein"},
      {name: "English", i: 1, min: 6, max: 11, d: "", m: .1, b: "Abingdon,Albrighton,Alcester,Almondbury,Altrincham,Amersham,Andover,Appleby,Ashboume,Atherstone,Aveton,Axbridge,Aylesbury,Baldock,Bamburgh,Barton,Basingstoke,Berden,Bere,Berkeley,Berwick,Betley,Bideford,Bingley,Birmingham,Blandford,Blechingley,Bodmin,Bolton,Bootham,Boroughbridge,Boscastle,Bossinney,Bramber,Brampton,Brasted,Bretford,Bridgetown,Bridlington,Bromyard,Bruton,Buckingham,Bungay,Burton,Calne,Cambridge,Canterbury,Carlisle,Castleton,Caus,Charmouth,Chawleigh,Chichester,Chillington,Chinnor,Chipping,Chisbury,Cleobury,Clifford,Clifton,Clitheroe,Cockermouth,Coleshill,Combe,Congleton,Crafthole,Crediton,Cuddenbeck,Dalton,Darlington,Dodbrooke,Drax,Dudley,Dunstable,Dunster,Dunwich,Durham,Dymock,Exeter,Exning,Faringdon,Felton,Fenny,Finedon,Flookburgh,Fowey,Frampton,Gateshead,Gatton,Godmanchester,Grampound,Grantham,Guildford,Halesowen,Halton,Harbottle,Harlow,Hatfield,Hatherleigh,Haydon,Helston,Henley,Hertford,Heytesbury,Hinckley,Hitchin,Holme,Hornby,Horsham,Kendal,Kenilworth,Kilkhampton,Kineton,Kington,Kinver,Kirby,Knaresborough,Knutsford,Launceston,Leighton,Lewes,Linton,Louth,Luton,Lyme,Lympstone,Macclesfield,Madeley,Malborough,Maldon,Manchester,Manningtree,Marazion,Marlborough,Marshfield,Mere,Merryfield,Middlewich,Midhurst,Milborne,Mitford,Modbury,Montacute,Mousehole,Newbiggin,Newborough,Newbury,Newenden,Newent,Norham,Northleach,Noss,Oakham,Olney,Orford,Ormskirk,Oswestry,Padstow,Paignton,Penkneth,Penrith,Penzance,Pershore,Petersfield,Pevensey,Pickering,Pilton,Pontefract,Portsmouth,Preston,Quatford,Reading,Redcliff,Retford,Rockingham,Romney,Rothbury,Rothwell,Salisbury,Saltash,Seaford,Seasalter,Sherston,Shifnal,Shoreham,Sidmouth,Skipsea,Skipton,Solihull,Somerton,Southam,Southwark,Standon,Stansted,Stapleton,Stottesdon,Sudbury,Swavesey,Tamerton,Tarporley,Tetbury,Thatcham,Thaxted,Thetford,Thornbury,Tintagel,Tiverton,Torksey,Totnes,Towcester,Tregoney,Trematon,Tutbury,Uxbridge,Wallingford,Wareham,Warenmouth,Wargrave,Warton,Watchet,Watford,Wendover,Westbury,Westcheap,Weymouth,Whitford,Wickwar,Wigan,Wigmore,Winchelsea,Winkleigh,Wiscombe,Witham,Witheridge,Wiveliscombe,Woodbury,Yeovil"},
      // additional by Avengium:
      {name: "Levantine", i: 42, min: 4, max: 12, d: "ankprs", m: 0, b: "Adme,Adramet,Agadir,Akko,Akzib,Alimas,Alis-Ubbo,Alqosh,Amid,Ammon,Ampi,Amurru,Andarig,Anpa,Araden,Aram,Arwad,Ashkelon,Athar,Atiq,Aza,Azeka,Baalbek,Babel,Batrun,Beerot,Beersheba,Beit Shemesh,Berytus,Bet Agus,Bet Anya,Beth-Horon,Bethel,Bethlehem,Bethuel,Bet Nahrin,Bet Nohadra,Bet Zalin,Birmula,Biruta,Bit Agushi,Bitan,Bit Zamani,Cerne,Dammeseq,Darmsuq,Dor,Eddial,Eden Ekron,Elah,Emek,Emun,Ephratah,Eyn Ganim,Finike,Gades,Galatia,Gaza,Gebal,Gedera,Gerizzim,Gethsemane,Gibeon,Gilead,Gilgal,Golgotha,Goshen,Gytte,Hagalil,Haifa,Halab,Haqel Dma,Har Habayit,Har Nevo,Har Pisga,Havilah,Hazor,Hebron,Hormah,Iboshim,Iriho,Irinem,Irridu,Israel,Kadesh,Kanaan,Kapara,Karaly,Kart-Hadasht,Keret Chadeshet,Kernah,Kesed,Keysariya,Kfar,Kfar Nahum,Khalibon,Khalpe,Khamat,Kiryat,Kittim,Kurda,Lapethos,Larna,Lepqis,Lepriptza,Liksos,Lod,Luv,Malaka,Malet,Marat,Megido,Melitta,Merdin,Metsada,Mishmarot,Mitzrayim,Moab,Mopsos,Motye,Mukish,Nampigi,Nampigu,Natzrat,Nimrud,Nineveh,Nob,Nuhadra,Oea,Ofir,Oyat,Phineka,Phoenicus,Pleshet,Qart-Tubah Sarepta,Qatna,Rabat Amon,Rakkath,Ramat Aviv,Ramitha,Ramta,Rehovot,Reshef,Rushadir,Rushakad,Samrin,Sefarad,Sehyon,Sepat,Sexi,Sharon,Shechem,Shefelat,Shfanim,Shiloh,Shmaya,Shomron,Sidon,Sinay,Sis,Solki,Sur,Suria,Tabetu,Tadmur,Tarshish,Tartus,Teberya,Tefessedt,Tekoa,Teyman,Tinga,Tipasa,Tsabratan,Tur Abdin,Tzarfat,Tziyon,Tzor,Ugarit,Unubaal,Ureshlem,Urhay,Urushalim,Vaga,Yaffa,Yamhad,Yam hamelach,Yam Kineret,Yamutbal,Yathrib,Yaudi,Yavne,Yehuda,Yerushalayim,Yev,Yevus,Yizreel,Yurdnan,Zarefat,Zeboim,Zeurta,Zeytim,Zikhron,Zmurna"}
    ];
  };

  return {
    getBase,
    getCulture,
    getCultureShort,
    getBaseShort,
    getState,
    updateChain,
    clearChains,
    getNameBases,
    getMapName,
    calculateChain
  };
})();

```

**Instructions:**

Provide a response in three parts:

1.  **Refactored Code:** The complete JavaScript code for the new ES module in ./names-generator.js
2.  **Engine Dependencies:**
    *   List the external modules the refactored code will need to `import` (e.g., `Names`, `COA`) in ./names-generator_external.md
    *   **List the new `config` properties you identified and used** (e.g., `statesNumber`, `growthRate`) in names-generator_config.md This is essential.
3.  **Removed Rendering/UI Logic:** List all the code blocks related to DOM manipulation or SVG rendering that you have **removed** so they can be moved to the Viewer application into names-generator_render.md
