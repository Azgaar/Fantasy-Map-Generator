import { capitalize, isVowel, last, P, ra, rand } from "../utils";

declare global {
  var Names: NamesGenerator;
}

export interface NameBase {
  name: string; // name of the base
  i: number; // index of the base
  min: number; // minimum length of generated names
  max: number; // maximum length of generated names
  d: string; // letters allowed to duplicate
  m: number; // multi-word name rate [deprecated]
  b: string; // base string with names separated by comma
}

// Markov chain lookup table: key is a letter (or empty string for word start), value is array of possible next syllables
// Note: Uses array with string keys (sparse array) to match original JS behavior
type MarkovChain = string[][] & Record<string, string[]>;

class NamesGenerator {
  chains: (MarkovChain | null)[] = []; // Markov chains for namebases

  calculateChain(namesList: string): MarkovChain {
    const chain: MarkovChain = [] as unknown as MarkovChain;
    const availableNames = namesList.split(",");

    for (const n of availableNames) {
      const name = n.trim().toLowerCase();
      const basic = !/[^\x20-\x7e]/.test(name); // basic printable ASCII chars and English rules can be applied

      // split word into pseudo-syllables
      for (let i = -1, syllable = ""; i < name.length; i += syllable.length || 1, syllable = "") {
        const prev = name[i] || ""; // pre-onset letter
        let v = 0; // 0 if no vowels in syllable

        for (let c = i + 1; name[c] && syllable.length < 5; c++) {
          const that = name[c],
              next = name[c + 1]; // next char
          syllable += that;
          if (syllable === " " || syllable === "-") break; // syllable starts with space or hyphen
          if (!next || next === " " || next === "-") break; // no need to check

          if (isVowel(that)) v = 1; // check if letter is vowel

          // do not split some diphthongs
          if (that === "y" && next === "e") continue; // 'ye'
          if (basic) {
            // English-like
            if (that === "o" && next === "o") continue; // 'oo'
            if (that === "e" && next === "e") continue; // 'ee'
            if (that === "a" && next === "e") continue; // 'ae'
            if (that === "c" && next === "h") continue; // 'ch'
          }

          if (isVowel(that) === (next as unknown as boolean)) break; // two same vowels in a row (original quirky behavior)
          if (v && isVowel(name[c + 2])) break; // syllable has vowel and additional vowel is expected soon
        }

        if (!chain[prev]) chain[prev] = [];
        chain[prev].push(syllable);
      }
    }

    return chain;
  }

  updateChain(index: number): void {
    this.chains[index] = nameBases[index]?.b ? this.calculateChain(nameBases[index].b) : null;
  }

  clearChains(): void {
    this.chains = [];
  }

  // generate name using Markov's chain
  getBase(base: number, min?: number, max?: number, dupl?: string): string {
    if (base === undefined) {
      ERROR && console.error("Please define a base");
      return "ERROR";
    }

    if (nameBases[base] === undefined) {
      if (nameBases[0]) {
        WARN && console.warn(`Namebase ${base} is not found. First available namebase will be used`);
        base = 0;
      } else {
        ERROR && console.error(`Namebase ${base} is not found`);
        return "ERROR";
      }
    }

    if (!this.chains[base]) this.updateChain(base);

    const data = this.chains[base];
    if (!data || data[""] === undefined) {
      tip(`Namesbase ${base} is incorrect. Please check in namesbase editor`, false, "error");
      ERROR && console.error(`Namebase ${base} is incorrect!`);
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
        } else v = data[last(cur.split("")) as string] || data[""];
      }

      w += cur;
      cur = ra(v);
    }

    // parse word to get a final name
    const l = last(w.split("")); // last letter
    if (l === "'" || l === " " || l === "-") w = w.slice(0, -1); // not allow some characters at the end

    let name = [...w].reduce((r, c, i, d) => {
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
  }

  // generate name for culture
  getCulture(culture: number, min?: number, max?: number, dupl?: string): string {
    if (culture === undefined) {
      ERROR && console.error("Please define a culture");
      return "ERROR";
    }
    const base = pack.cultures[culture].base;
    return this.getBase(base, min, max, dupl);
  }

  // generate short name for culture
  getCultureShort(culture: number): string {
    if (culture === undefined) {
      ERROR && console.error("Please define a culture");
      return "ERROR";
    }
    return this.getBaseShort(pack.cultures[culture].base);
  }

  // generate short name for base
  getBaseShort(base: number): string {
    const min = nameBases[base] ? nameBases[base].min - 1 : undefined;
    const max = min ? Math.max(nameBases[base].max - 2, min) : undefined;
    return this.getBase(base, min, max, "");
  }

  private validateSuffix(name: string, suffix: string): string {
    if (name.slice(-1 * suffix.length) === suffix) return name; // no suffix if name already ends with it
    const s1 = suffix.charAt(0);
    if (name.slice(-1) === s1) name = name.slice(0, -1); // remove name last letter if it's a suffix first letter
    if (isVowel(s1) === isVowel(name.slice(-1)) && isVowel(s1) === isVowel(name.slice(-2, -1)))
      name = name.slice(0, -1); // remove name last char if 2 last chars are the same type as suffix's 1st
    if (name.slice(-1) === s1) name = name.slice(0, -1); // remove name last letter if it's a suffix first letter
    return name + suffix;
  }

  private addSuffix(name: string): string {
    const suffix = P(0.8) ? "ia" : "land";
    if (suffix === "ia" && name.length > 6) name = name.slice(0, -(name.length - 3));
    else if (suffix === "land" && name.length > 6) name = name.slice(0, -(name.length - 5));
    return this.validateSuffix(name, suffix);
  }

  // generate state name based on capital or random name and culture-specific suffix
  getState(name: string, culture: number, base?: number): string {
    if (name === undefined) {
      ERROR && console.error("Please define a base name");
      return "ERROR";
    }
    if (culture === undefined && base === undefined) {
      ERROR && console.error("Please define a culture");
      return "ERROR";
    }
    if (base === undefined) base = pack.cultures[culture].base;

    // exclude endings inappropriate for states name
    if (name.includes(" ")) name = capitalize(name.replace(/ /g, "").toLowerCase()); // don't allow multiword state names
    if (name.length > 6 && name.slice(-4) === "berg") name = name.slice(0, -4); // remove -berg for any
    if (name.length > 5 && name.slice(-3) === "ton") name = name.slice(0, -3); // remove -ton for any

    if (base === 5 && ["sk", "ev", "ov"].includes(name.slice(-2))) name = name.slice(0, -2);
    // remove -sk/-ev/-ov for Ruthenian
    else if (base === 12) return isVowel(name.slice(-1)) ? name : `${name}u`;
    // Japanese ends on any vowel or -u
    else if (base === 18 && P(0.4))
      name = isVowel(name.slice(0, 1).toLowerCase()) ? `Al${name.toLowerCase()}` : `Al ${name}`; // Arabic starts with -Al

    // no suffix for fantasy bases
    if (base > 32 && base < 42) return name;

    // define if suffix should be used
    if (name.length > 3 && isVowel(name.slice(-1))) {
      if (isVowel(name.slice(-2, -1)) && P(0.85)) name = name.slice(0, -2);
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

    return this.validateSuffix(name, suffix);
  }

  // generato name for the map
  getMapName(force: boolean) {
    if (!force && locked("mapName")) return;
    if (force && locked("mapName")) unlock("mapName");
    const base = P(0.7) ? 2 : P(0.5) ? rand(0, 6) : rand(0, 31);
    if (!nameBases[base]) {
      tip("Namebase is not found", false, "error");
      return "";
    }
    const min = nameBases[base].min - 1;
    const max = Math.max(nameBases[base].max - 3, min);
    const baseName = this.getBase(base, min, max, "") as string;
    const name = P(0.7) ? this.addSuffix(baseName) : baseName;
    mapName.value = name;
  }

  getNameBases(): NameBase[] {
    // name, min length, max length, letters to allow duplication, multi-word name rate [deprecated]
    // prettier-ignore
    return [
      // real-world bases by Azgaar:
      {
        name: "German",
        i: 0,
        min: 5,
        max: 12,
        d: "lt",
        m: 0,
        b: "Demark,Qoste,Zawobrolawol,Zudeneheim,Hubrifotal,Vorhuhatal,Zofvuvalatal,Damark,Doholt,Kranazidmark,Vihgumark,Vyvestu,Gigstostfels,Fudiwald,Fombach,Vylbrahlabru,Dazelheim,Noziwald,Mastiretal,Zozedorf,Wiburg,Stefihzomark,Wamark,Vekriholt,Wihiburg,Brodorf,Sturzonemark,Zalostifels,Hozaruburg,Wistbrmudorf,Zuvelbach,Kriwald,Gavlfstiholt,Zaziho,Stustbraburg,Zariz,Fuwawald,Xelvavaru,Vohumark,Broholt,Qomigakra,Breburg,Mokrzbribach,Weholt,Mofehudez,Vyfufubrzafu,Ladefels,Doviw,Mukrezaheim,Xelvuri,Nutal,Zuvgvastbach,Rynli,Xelwu,Stanluzaholt,Dahimark,Vukrotal,Widemark,Mifstamark,Maviwevoburg,Steme,Zagudidowe,Lefufrimark,Gubach,Vukristadorf,Miristeholt,Vobrekrumark,Stiholt,Riffels,Femugamuheim,Veholt,Kratal,Lorstwaffels,Zikrnobach,Lehadinebach,Dubridorf,Krakrizidorf,Krowawald,Bromrabrheim,Ruwlwigeholt,Krogital,Mavgvfgbrunn,Krifukred,Gamark,Xelbrihogva,Qodemudu,Vastbach,Stebrivibach,Qolodvu,Danawald,Zuzukremark,Dowald,Zorgstfsthlt,Giburg,Redorf,Mustago,Vyvutal,Krihoza,Gulumark,Vezdorf,Huvegilheim,Xelwgdomwefe,Brawuholt,Brubach,Rynkrumi,Hewagofbrunn,Xelkrederire,Lazavfels,Krukrafels,Varuholt,Vuhefu,Madkrkrhghlt,Vuhburg,Ruvowi,Lokrrinetal,Rawald,Norakrubach,Briwheim,Zavoholt,Zunasthaholt,Xelbrezekr,Loniwaburg,Zemark,Rihugstibach,Wifels,Lolodobrunn,Nidorf,Kralzfbrstmr,Favbrakrital,Devbrifadorf,Furadorf,Stedkrnwbrwl,Brakrbromark,Lambrkruheim,Vobach,Haburg,Vustdikrdahi,Nuwoburg,Brital,Gistnstemark,Nimha,Didorf,Vymamarkro,Stevavowald,Rynzikreda,Vadadekrholt,Briraheim,Kramuzwawald,Wikrbrunn,Nawilodwald,Vudonovburg,Ruvevwald,Govaheim,Zawohofibru,Movofmiholt,Luvstmuhfels,Lurvbrmzholt,Lokrrbrlvdrf,Maholt,Zewald,Diburg,Lefnzkradorf,Ruburg,Krufels,Dovdorf,Galor,Kruburg,Krubach,Madadorf,Stenawald,Staholt,Qokrdezakrew,Heholt,Zakre,Brenivobrunn,Zomedorf,Gulbrunn,Mufgenefels,Kroburg,Muwetal,Veribach,Vagabragmark,Nagimodorf,Wodeholt,Zakra,Waholt,Meromark,Wedorf,Fifels,Bribrvhewald,Braheim,Nigiriha,Brefels,Qobroz,Lolodestburg,Hililofels,Moratal,Stabach,Ralibrwald,Lovbrunn,Sturmsteburg,Krabrital,Vabrunn,Zahadmavokre,Vakrrezawald,Mudkrif,Rokrkrnnhbrn,Gudorf,Goheim,Xelmukrurost,Wunabrunn,Zadgebrunn,Brugedorf,Fofovidorf,Studorf,Dadibach,Xelhodibrsto,Gehobrelfels,Rynkrobru,Forowegutal,Browald,Howizotal,Vystewbra,Vewdkrkrburg,Krezistbach,Fakrbach,Nalfrkrzburg,Brurmark,Vylazastuglu,Luvbrif,Figbrumebach,Ginstonowald,Hedtal,Kriheim,Zaligafe,Qostkrstoste,Krovgnbrbach,Rynnagme,Gufels,Gihwemebrunn,Wegide,Krugezgowald,Nebach,Zebresteholt,Zofbruvheim,Gekrofoholt,Wevekrital,Qobrodkroste,Vynuwu,Fuhoviholt,Zaduburg,Fidoguburg,Brullzkrburg,Mistawedorf,Levkrgemheim,Virlemtal,Midstoburg,Zabrbrirheim,Zafekra,Stabragifels,Fistdorf,Stidkrmbrunn,Zasta,Migzufamark,Krigatal"
      },
      {
        name: "English",
        i: 1,
        min: 6,
        max: 11,
        d: "",
        m: 0.1,
        b: "Totamere,Xellemere,Sakodi,Hidatham,Rynbuford,Geniham,Cehindeford,Bowhbrawell,Brambluwell,Brubrook,Kibragimere,Sonydefield,Tytabury,Vylybury,Tanehar,Brystead,Gudcaham,Gestead,Rynhamido,Xelsabri,Lukwell,Dobrowell,Fyhafield,Xelrudhalyg,Gabremaford,Kymere,Guboton,Fosmktrford,Guwick,Darokol,Mabigton,Vyhifield,Sefuhefield,Xelnabrbeko,Xelsib,Mehnamobury,Bygoton,Wafiswick,Dabrmobrook,Towford,Nifield,Cawemere,Hybury,Nakoford,Dibrwywwell,Somere,Xelrywick,Kalaknod,Brydllswell,Ryncefield,Dustead,Vywybribuf,Xelruk,Hibricyk,Koford,Cubrwobury,Qodufefwy,Suwoco,Manibury,Maknuwmere,Brustead,Fafafield,Wehibrook,Tynumystead,Hofwybrford,Syrkgufield,Gefibury,Mefibury,Cibbliwwick,Vynagana,Nofebstead,Turicibury,Guhytystead,Gesimere,Habury,Xelciford,Mabawick,Ryntomori,Wykbkufield,Dinstead,Xeldykeluma,Dediton,Qohyri,Sunobury,Hogafield,Nywell,Wocefield,Hymere,Bricwestead,Towick,Kihhrdfield,Syctabrbury,Suwick,Vykebrook,Sumbugton,Xelnafo,Gaceruham,Xelnybra,Gahrwnywick,Timere,Sibrifymere,Fyfuford,Fydohamere,Kiford,Widyton,Tybhabstead,Mynbury,Wygoghoham,Rohoford,Katbrifield,Rynbutaryne,Muhiford,Biduwell,Tumbrook,Rucbury,Lifeton,Lowofohmere,Xellube,Brydygbury,Symowell,Halcituham,Cutohton,Geford,Nubrckfield,Rynmytabe,Ryncyhabre,Vyhiwic,Febdycford,Qocolham,Myfield,Bowick,Wabgykbury,Qohedbaku,Kyhukumere,Wewick,Feftgofbury,Leguton,Vyhomo,Qotamtobr,Brabwick,Qobyged,Weklygawick,Tamfield,Gugystead,Timefield,Vytlktomwif,Sowylistead,Bremere,Kiwtyford,Rynrehy,Rirboham,Cuhabyford,Cyhmulnek,Rimhdfufham,Bubrbrook,Gabrimiham,Tabwick,Dewbrymere,Nycdgtyford,Hoblmbewick,Zasonford,Buhewell,Cofnbrndsta,Buninfoford,Zagotaba,Brubury,Mogewugton,Ryntarmotke,Figgyfield,Wybury,Vynafykadyf,Rowowick,Rocbrook,Brabrook,Rebicbrook,Dutylybury,Tekwick,Finton,Sabury,Lelolobury,Dodwell,Rewton,Brihawell,Liwell,Zagowick,Mybrook,Lobrook,Qodiky,Qocemfield,Sagikfield,Gogidton,Xelsuca,Siford,Qohiworsygi,Woryfield,Ryncobury,Suwtibricih,Zabrutebrmi,Tebanuwell,Fumucuwick,Famere,Sybrook,Rebrook,Tuncohoford,Vybrurmiby,Bruham,Sybsdifield,Letemu,Zahada,Vysobrahne,Brebrwell,Dacecystead,Bugftgfield,Difolybury,Sysaford,Nohammere,Brokfhbrook,Fiwell,Lakorenford,Dafemere,Rynhadyne,Wybeford,Lelford,Kylwufield,Cemtekwell,Dubgeham,Ricyroham,Lesukewell,Kybrfield,Raford,Tylibi,Wetonham,Logdesywell,Herlnmeford,Fifmsmbrook,Gofwell,Sykkkwbrook"
      },
      {
        name: "French",
        i: 2,
        min: 5,
        max: 13,
        d: "nlrs",
        m: 0.1,
        b: "Dubecourt,Rasochfont,Fesego,Lusimont,Gabmecourt,Zaduvaux,Lanay,Revefovaux,Jejanay,Sofagbois,Qobovnu,Dumont,Vyvas,Chebois,Vysacourt,Chinebbiron,Vysori,Xelgamemo,Figmont,Mulier,Deludusicourt,Rynsemachor,Vuveville,Xelrigdacho,Jebomsulier,Sosuguvaux,Bemrildo,Labivcourt,Nunusarabois,Guchuboelle,Jinvonbois,Vyludla,Cheborlurar,Xelrojas,Gilefecourt,Buluveville,Zanidverer,Rynro,Gochigonay,Revselier,Momefudelron,Chafvaville,Fubois,Vybochali,Chemabois,Jubevaux,Rileloron,Chivemont,Ribois,Fechoelle,Jufont,Qosob,Lerisijavaux,Qoduron,Furluligelle,Lunobois,Giron,Jolninay,Vivanagfont,Raffemdoville,Mufafijmont,Dumavomron,Bachavaux,Sarasobucourt,Fefovomville,Vymamont,Mabsuville,Rejocourt,Rinrabfont,Vufdagabois,Gedmuchicourt,Sijielle,Fadimont,Qosuron,Fibufont,Molier,Nijguljevaux,Qonimubera,Bajeribois,Menolubo,Vylochi,Jojorru,Limont,Chofbregmiron,Lemsenay,Vomolesi,Reron,Rujuvchovron,Bubois,Salier,Nefuvbifont,Chivnay,Docourt,Vaglchuvavaux,Vyvavaux,Chucourt,Fefibibois,Garon,Zabenosseri,Binumont,Rachchusenay,Rovebville,Zasiggejogen,Jubois,Jinay,Rynfolugiso,Nubsufliron,Funeelle,Zachoru,Silnobenay,Remont,Rufivanay,Firirnay,Nosemont,Vifont,Namont,Valiville,Qovero,Maville,Rodub,Vorgrbjicourt,Vugumosuville,Vylij,Lafont,Bocourt,Ribimonbois,Fobisosaelle,Rumorilnay,Nichvalisron,Novaux,Benay,Vububojoville,Churon,Vaselgelier,Daron,Ramage,Chalabois,Runubbesju,Mucourt,Chilfnluville,Serrogbamont,Refont,Jogogobois,Joramont,Zaruge,Qojebi,Femifda,Nibois,Divavaux,Buchelielle,Ravschsacourt,Qodacourt,Mablebois,Famafont,Saville,Galulier,Vichadejvaux,Nubudisfont,Qogasuvuse,Xelsechoseslu,Juchadovaux,Sajurafoelle,Sabchfvnobois,Velchuda,Misnefont,Guvjonay,Farrilibi,Veelle,Nochilonay,Fechilville,Gielle,Zadogovala,Munoguelle,Masiforon,Zafaj,Rynjichdi,Robois,Figomivaux,Fogelimont,Runay,Rachove,Fameville,Sisvaux,Vebeneron,Qomoville,Vybalu,Jelufont,Vovidumont,Zachib,Qonebi,Dofont,Bejafumignay,Buronecourt,Nebiville,Venifnosabois,Degelier,Dirlier,Sibovuvlier,Chasgufmont,Vudaron,Chofont,Ladsimufont,Vynojub,Zache,Mumunay,Gavajujufont,Minomuluelle,Chunay,Sovbovaux,Rynfiv,Besvemcourt,Begolbaelle,Fuelle,Mubinay,Qobasa,Rasrujlocourt,Rynmura,Xelnebube,Vychosi,Sinmont,Xelfigechegra,Fodedu,Sibdabois,Lufielle,Janiserav,Qodisusudu,Rynmi,Xelgomeba,Bovideffamont,Refunvorbois,Sojron,Sadiluflier,Zadifont,Rabois,Zajod,Suvaux,Fonanojgomont,Rubois,Fovaux,Damont,Laron,Vilier,Qomemafo,Lasejecourt,Xelsive,Vivelle,Zafinisa,Nofeville,Michifont,Basnemuchnay,Qojen,Vydoville,Soelle,Qogirare,Muchveville,Dalier,Bavirnay,Zachujsisu,Jebochunay,Jirejrocourt,Govaux,Jafbdvodabois,Vigilfuvaux,Fasmisej,Dosedgo,Zamarsechich,Lumont,Rynmonbolev,Liviville,Foron,Zajad,Lorebemont,Ryndu,Jilier,Xelchebefaga,Lalacourt"
      },
      {
        name: "Italian",
        i: 3,
        min: 5,
        max: 12,
        d: "cltr",
        m: 0.1,
        b: "Zelogenza,Bogooria,Rynnisus,Defodafuento,Zamopedizu,Naara,Lidcigento,Paara,Ryntodfubo,Qoramidu,Narvadoreino,Sudoano,Dediffienza,Pivesreasso,Dedrzotoento,Teenza,Zabofo,Xelru,Perovtoola,Meino,Zaziara,Xelvevdasumu,Recditdaoria,Tasaenza,Gogaenza,Tebeenza,Vizimevos,Tamoasso,Zanenasso,Sateano,Xeltes,Tolidetoenza,Ziprrecomino,Vafsoenza,Riano,Vygoloni,Berusaento,Vygodu,Bovodenza,Nemegegento,Xelninezam,Sizeino,Dabeola,Goara,Ciento,Logino,Puello,Detvaino,Gecluraoria,Vodzeara,Gaello,Rumetoano,Maddiliasso,Golvoenza,Rizibano,Nipsusuino,Cirenza,Qomeasso,Fanoasso,Vusamopdiara,Xelceror,Cifetepara,Xeltafo,Fativola,Vinasso,Cunolilgoino,Raroano,Saseola,Mefzllcuenza,Dimiello,Loola,Dusiara,Cilano,Relento,Teblumpe,Vontsunpuola,Runeano,Vuello,Xelvulope,Mugeano,Guello,Rynpabesec,Gucto,Roceano,Ciano,Dagrovafenza,Rimovenza,Borimi,Xelpinefcufi,Ryndopipi,Cuncotfuara,Ponedreoria,Gutetenza,Vyremavmus,Qocogerfuri,Cipcienza,Nottoenza,Ranvrcluello,Bopsevoria,Cugsifienza,Sagoloola,Fesuello,Relraceenza,Voguola,Zagoano,Doenza,Fisgabeara,Bunuano,Zaino,Firzeoria,Gononino,Qozoloclugo,Loenza,Rinneasso,Mamziano,Pienza,Macaento,Zepoino,Loano,Zuziino,Patento,Ciello,Belareento,Belezmeasso,Toino,Cedrapasino,Qonuello,Caenza,Luseino,Cesioria,Nipvgnpooria,Vypete,Nutllfilenza,Guasso,Cuenza,Fapigenza,Focucenza,Tazuino,Beola,Suello,Teello,Vuenza,Dugsipodenza,Sizepiento,Xelvipu,Mumusapuola,Barano,Gictaoria,Qozevcov,Qomenufit,Gienza,Vugola,Sapuello,Vydodu,Vecogano,Luino,Xelbo,Vyceento,Busisezaoria,Fomeento,Vupib,Metbleruenza,Bodaello,Lezipeola,Rynrepod,Vygeoria,Zatarafomola,Vydiento,Sibnbocoello,Fugesoento,Feoria,Vigalugeano,Mufuento,Zidiasso,Norazoano,Reino,Revivleento,Zerenza,Rynfodnageg,Dotpizudpil,Mucello,Rynzopazas,Muento,Qocus,Suenza,Rynnifazi,Vadoria,Veroenza,Siento,Qonioria,Rusba,Lemiguvoria,Lucorenza,Fudasso,Reenza,Topolenza,Podasso,Dicfolaento,Zafuvifi,Zamuve,Qovizalu,Lacuara,Moola,Dozaenza,Feneento,Mabuano,Mozudilbos,Sumuze,Xelgazave,Zadufpive,Qozeb,Cosrptsienza,Vugello,Paoria,Rapuvola,Gofgaenza,Dopaola,Mudaano,Cicadoara,Vufsuroria,Mioria,Sotbuteraino,Tetfonaroino,Vupegiano,Pofigiasso,Zobienza,Racenuano,Pupeoria,Qobuc,Lofano"
      },
      {
        name: "Castillian",
        i: 4,
        min: 5,
        max: 11,
        d: "lr",
        m: 0,
        b: "Vynizpop,Zanuza,Ciceloma,Gibufaloma,Zopma,Zugtigcanto,Letcanto,Viteloma,Ficgzfncnto,Qovalamup,Vabesierra,Bebsierra,Zafov,Bidiculoma,Qomeropufe,Ludznipalba,Mifrtibalba,Voroza,Zuroza,Zarit,Tocicampo,Duvriroza,Zucoparoza,Vumnciverde,Racrpemreal,Fiziverde,Paruverde,Tenztivilla,Lusrupverde,Vebitbereal,Qosivtepu,Damvfgcampo,Togagacanto,Vabobovilla,Xelpodu,Zugescampo,Pivsurio,Saririo,Qonovuni,Patverde,Cennucegrio,Landivoroza,Qofaluco,Sipucanto,Fugefbu,Citalba,Vovreal,Telloma,Cececanto,Xelmidu,Xelzi,Sutpzacario,Zaceteverde,Bavedvilla,Zutemaroza,Xelpedome,Susocaroza,Cupfcacampo,Zemloma,Rolrio,Totococampo,Dealba,Feloma,Zusivilla,Danesierra,Pirio,Deboloma,Zusresierra,Pizvuloma,Seroza,Bofebvilla,Suroza,Zireal,Ryndofda,Zurio,Becrio,Nabidereal,Tovilla,Zozarog,Buditsualba,Bivilla,Vynecampo,Vyzosonuc,Paltesierra,Podvilla,Destuvcanto,Gespszvilla,Nigsusierra,Zanod,Rynmo,Pegorio,Baverde,Mocampo,Sotlesiloma,Menfavilla,Qozutuna,Duvsuboreal,Bavoreal,Parroza,Gevilla,Bovovilla,Tisierra,Sesierra,Nucanto,Tetuzosreal,Tucpaalba,Sevazeroza,Toalba,Dizbaftige,Vuszotirio,Qobesliruno,Rotosierra,Letbiloma,Pario,Xellelinu,Dadzereal,Xelpoba,Pumvltcampo,Nugppvvilla,Qolicanto,Tacanto,Rynpunbu,Guvamualba,Danutinario,Velenurio,Lunidezi,Tamvilla,Vunsivealba,Lofevuloma,Ricanto,Xellere,Rynzu,Zafoco,Foreal,Nirio,Ziroza,Fovilla,Lifatelub,Vevalba,Bozvgicampo,Qonucampo,Rifbtzcampo,Rynfibsaso,Dofisvilla,Vygunupa,Zolucaroza,Zepasierra,Vydisofo,Vygiretcozi,Vemuvevilla,Vecampo,Pavilla,Vytonup,Naplfsierra,Boleroreal,Qofialba,Zareal,Ryngapcu,Zorio,Vyfeca,Sintclcampo,Firoza,Vupocealba,Pusierra,Losocanto,Pirozagalba,Qodulozo,Zorvilla,Nomcsvcampo,Mopfelvilla,Nesfdetirio,Miroza,Vabgdpvario,Ruloma,Biglvamurio,Taszvnvilla,Cifrio,Zacori,Tiroza,Lustzucampo,Becvttgsrra,Xelnedupa,Dutgucrio,Davgppoalba,Guvcanto,Risierra,Tivivilla,Paverde,Nelartu,Velurloma,Luloma,Dopgruvilla,Teraalba,Vocampo,Rynvigu,Saroza,Didmosierra,Remalerio,Furoza,Xelna,Terio,Qozezofdod,Bucanto,Rynpozade,Logrbslreal,Nevilla,Razicampo,Gemtavvilla,Vygafticoz,Xelgivu,Zasesierra,Rynma,Gazegcanto,Munevilla,Teverde,Rivsotcanto,Bumzzncampo,Lurivevilla"
      },
      {
        name: "Ruthenian",
        i: 5,
        min: 5,
        max: 10,
        d: "",
        m: 0,
        b: "Nidrev,Gylivich,Rynchy,Bibrtsemir,Bomir,Puchlbgrad,Xelpe,Zibryvich,Nochgytkov,Chirisa,Tygrad,Tidydenyk,Mekov,Qochchgvot,Povich,Mapuky,Gezazusk,Bretybsk,Chymvadrev,Zupol,Gubebisk,Brinyk,Vagor,Zomuchpol,Bredsazu,Rymir,Tyredesk,Gunodrev,Monivich,Zategati,Vynyzately,Kovopol,Qopepol,Sasuzgor,Sodrev,Chusk,Ressubrusk,Vaschychsk,Nakov,Zateven,Rivich,Vyvimabrry,Viznaro,Kubinyk,Nichachkov,Rynpo,Xelge,Vubraven,Vubrykov,Xelpi,Tenivuven,Vuvich,Bobutypven,Possvedrev,Vymdtdmpgo,Xeltipe,Xelche,Gagmygor,Sugor,Bipakesk,Pymelonyk,Machygor,Nonmagrad,Kedrev,Modzsebisk,Budrev,Kupuven,Brorikunyk,Nuchchdrev,Brovamir,Vonyk,Kekonigrad,Degor,Kychsomask,Zarrsbribr,Bebrinsosk,Ninyk,Xelkdrmape,Zabru,Vaksdovich,Nykym,Xelli,Zakamsyti,Xelkygusak,Veven,Kenyk,Ragaven,Qopukov,Mysynyk,Byremir,Dirilutosk,Dugrad,Ryngaz,Bregor,Lolabupkov,Mibripol,Kastiko,Bepol,Brepol,Voknetdrev,Metkledrev,Chygrad,Kozonyk,Nechesk,Rynchpbbrd,Rynnmprbvu,Brasdvmvch,Korynodrev,Rasbrzmgra,Mabmir,Tykov,Tyrisk,Vopegrad,Chalegoven,Vagsk,Pyregodrev,Nenyk,Chipmvgrad,Ruven,Mosiktinyk,Vymuvich,Gakrusk,Bikov,Lepchmvich,Michlttvch,Vyrevich,Kabratinyk,Kibrusvich,Gasidyven,Rekchy,Lescho,Zazos,Librchzisk,Lipol,Ryngsgibro,Sepyvkov,Chenymdrev,Puboven,Pygrad,Xeldakydip,Gosekov,Tuzummir,Chokov,Zumir,Chupvich,Lidrev,Dodrev,Pipmudkov,Gagukevich,Muzchvdrev,Zevokupol,Zapyven,Qodonboge,Kusgchspol,Xelpedi,Rynbrysuzu,Byzopol,Mopugor,Mytbrygrad,Xelba,Ravbobikov,Vydamsa,Brypibi,Xelchu,Nisoligor,Muvlegor,Tubtpzbrgd,Rursdvbrvc,Lalgrad,Ryntaguga,Genyk,Ryncha,Nebosonyk,Kadrev,Bepozagor,Chobnekov,Sakbrkgven,Sidrev,Bygrad,Buvich,Zabichi,Babrpol,Komukov,Vyzeven,Lupukov,Masusk,Sytvusgrad,Xelchzrzon,Pagrad,Bruspgaven,Bronu,Tuladez,Gakivich,Vynidove,Rynvnlsbpy,Tenagrad,Nutomir,Lanyk,Brebonyk,Didrev,Tysrmyvich,Belubrmir,Zasksk,Vyvymir,Poven,Mupichogor,Pyzvbrmmir,Nyvich,Muchven,Brosechosk,Vymir,Gemir,Gadisygsk,Kakravich,Lachmir,Tachchdrev,Chumlygrad,Ryndo,Gykazygor,Zibkchochu,Rynbry,Namidrev,Chylaven,Lobrgor,Bitdukyven,Nagor,Gumitygven,Gavakydrev,Bukky,Rabra,Divich,Kedagor,Rysypol,Zunubgugor,Marybisk,Xeldobro,Qobezmo,Brobrgrad,Bokov,Vetpugor,Brazdmkrgo,Mibrum,Varumir,Xelze,Duvbrikov,Tokimansk,Zanulisogy,Xelbalze,Brozbrumir,Bonrinyk,Dechgor,Pudgor,Badanu,Kavbripol,Patvavydsk,Savle,Vytybokupi,Rokov"
      },
      {
        name: "Nordic",
        i: 6,
        min: 6,
        max: 10,
        d: "kln",
        m: 0.1,
        b: "Fohnes,Zalaba,Xelsknybje,Bjaklestad,Bjafjord,Qohybgard,Dengyfjord,Ryntogard,Skyflklund,Vydekuv,Gyketufell,Xelnynuhe,Skubjrgard,Ledaldal,Nuborg,Dubjfvines,Sabjkugard,Rubjslborg,Vafell,Ristad,Ryntylund,Ruvefyfell,Ryntrkalyn,Zatanes,Bjelund,Burhkfjord,Tudbjlfell,Zasuge,Xelskgsksk,Qorynolis,Keskvldbne,Nigaholm,Sisanfell,Fidyvik,Kydftaborg,Fasskuholm,Bifegodal,Xelgosksky,Rynbifell,Bifjord,Tebilholm,Gynesgard,Sabufell,Bjyvytovik,Huholm,Hevikfell,Tabjviborg,Zadnafyfuf,Xeldafvy,Rifydal,Ryndyf,Xelskbjlto,Tobjsestad,Gadalstad,Bybjifedal,Likugard,Rogstad,Ribjadodal,Nelyhakdal,Xelrbjlskl,Qobjeholm,Hohvystad,Dolhgnborg,Ridyvik,Hagard,Rabtskstad,Folhbolund,Dikfell,Robjistad,Rugsfskhbr,Sybtesvik,Zagunyska,Kidiskevik,Nykndalund,Hirnselund,Bjobjvik,Rynifell,Vinuborg,Bjudrskgrd,Vyfell,Nabhhoholm,Rynbif,Voskudal,Notegard,Lofjord,Sefell,Dobjelund,Gyfuborg,Bjugard,Bahedal,Ryntesre,Tynvik,Dynbjsfjrd,Libjefivik,Nabnsifell,Hefjord,Rynhyr,Beborg,Vyretlund,Bisbjufell,Vedbbjkgrd,Skabgrholm,Skusbjnlnd,Nudttafell,Bjoskvholm,Kohyfjord,Rahydborg,Viskegard,Skedal,Votudal,Vyddal,Nugbghfell,Rabbjskfjr,Xelrusyd,Dyrnoggard,Skufbdftvi,Sastad,Nestad,Bibjrbjrvl,Soborg,Zarssbjsku,Ludalfjord,Rubjstad,Dylukonal,Kurafjord,Byfugofnes,Skagholm,Teskfffjrd,Nelund,Fyvikdal,Vytistad,Nyrebstad,Bjubjunes,Lalaholm,Teduta,Nostad,Rytufell,Telvegard,Neskbjhbjd,Havikborg,Bykistad,Rubbjfjord,Bjeskfgard,Vybjule,Goskkyfell,Qotulda,Digard,Skaskkrbrg,Tivfell,Gedtnsborg,Kosastad,Qoftihskon,Lognalund,Nyborg,Kafjord,Vahbfoborg,Defjord,Qonubjbjut,Skysskskhl,Rerfnbjbrg,Gegard,Givyraholm,Sylund,Vehfjord,Labogivik,Satdivedal,Budefell,Netalund,Lihbfrborg,Rerelund,Venugard,Notovbja,Siverlund,Lyfell,Kegfoholm,Lilofjord,Husagard,Gudalborg,Nolgbglgrd,Qoholund,Haholm,Kigvyf,Gaviknes,Tovgard,Xelbjyfava,Valsoborg,Lekthbjfll,Koborg,Butagard,Hosbjfjord,Hefohi,Kuvikfell,Bjudastad,Bjogskaty,Hoskeklund,Xelrubj,Vinesstad,Bjavifell,Vyhstad,Hognohlund,Bjufskynes,Xeldafi,Zabureni,Koryvik,Vusklvsthl,Zasafu,Nisurones,Bjubdskhlm,Skelund,Skadbjholm,Qoskyndesi,Vyskyveve,Zagebju,Kufjord,Qobyvik,Kukestad,Skystad,Tyrnes,Dysubjdyr,Dydaldal,Duholm,Tysirnes,Gadydal,Vyfivik,Bibjkhstad,Nakoholm,Bybyvik,Bofjord,Luvastad,Qorubjyna,Fukedal,Qobkdnerdo,Zahastad,Bjofaty,Hynyvganes,Rudalstad,Bakustad,Rofell,Heskuge,Vykglovfyb,Rutbjsborg,Vokyvyvik,Buvdfksfll,Lydalnes,Favikdal,Nintkoddal,Tinesfell,Hebjybja,Bovugidal"
      },
      {
        name: "Greek",
        i: 7,
        min: 5,
        max: 11,
        d: "s",
        m: 0.1,
        b: "Lechos,Zonzxpsidos,Tinaeon,Techessa,Zyzoria,Tizchupolis,Tidiessa,Poara,Kothon,Rynnomdylu,Tyloessa,Luion,Kikthon,Zanahe,Moessa,Timhiidos,Degymiion,Rynku,Zarydechixo,Ryzutary,Xelsgxaxedu,Nalonaoria,Hiara,Sednhhyidos,Boxenos,Zapahkumdo,Vymoos,Xelto,Sehoria,Nehidos,Kiyra,Tydetadidos,Suthon,Qoborchygyb,Xelguhy,Qomynnaxymo,Guhoessa,Xelzohzolu,Rynxi,Nossipolis,Sehessa,Xelchaxi,Rynchu,Chakykiyra,Zapylody,Chakbupolis,Hoteion,Papolis,Rynzezebo,Cheidos,Sioria,Ladubeko,Lotzumoyra,Rocheara,Porahygi,Gosyniara,Xelnysacha,Tuidos,Zichyaeon,Gymahuzthon,Koxeoria,Harahguion,Pykidisuara,Pumzbepolis,Zuessa,Chytyidos,Zyhmtchthon,Laaeon,Chybreos,Kaidos,Zadipolis,Pooria,Pagthon,Bayra,Putmchsidos,Doniara,Kasultoara,Tozaos,Zaloaeon,Hokoara,Tyhara,Rynze,Tynessa,Sulokpolis,Chyruryryra,Rogoyra,Timzgatoria,Chopneh,Hixydaidos,Hachlphzyra,Xelpesuron,Qohiara,Lixpolis,Metuara,Chozdchmdos,Sixuessa,Xytyxoessa,Gyion,Rynchmhglos,Qoxugla,Zimision,Sechybiara,Zyreyra,Siidos,Bispolis,Gyhidneara,Denodaara,Loyra,Rymroteion,Zachez,Mazoduaeon,Soxaeon,Papymyessa,Hidtchtidos,Qoxeha,Zabaidos,Miidos,Pipalos,Qoregicho,Qoxex,Zaxithon,Pehikuidos,Besuchche,Sechuidos,Sohmotuoria,Madaara,Myzopolis,Kypmuos,Saaeon,Gimyra,Tuhkkhiidos,Zykpolis,Qobeg,Nikelpolis,Meara,Hiriion,Vypuzi,Nihppyraeon,Bugoduzos,Vykulege,Nudkxdteyra,Nydschkplis,Xelnagu,Deyra,Tichesixion,Soyra,Budziyra,Nihyxekios,Keshomoidos,Vypab,Kuchysyessa,Topaheara,Sorilaos,Ruchzizoria,Gooria,Hurametidos,Xumidos,Qosoos,Tyara,Vysichikhot,Tuessa,Kazegysoria,Lios,Xeldacha,Benpayra,Mygxupolis,Xelrelyzog,Xybibion,Kurutara,Chaos,Mixessa,Rynra,Zaniidos,Xotyziara,Damnyrooria,Nyara,Zazxrnpolis,Vylathon,Naidos,Choos,Tohaboidos,Lypoaeon,Niburaoria,Qochbtyduda,Hemlomaara,Titoria,Buyra,Palamoidos,Nochuion,Kalgikaion,Xelpyxo,Topara,Lihion,Xelbu,Bitision,Malara,Haosaeon,Xelxachxi,Puyra,Hodeoria,Vybulpot,Vyzoxoby,Dolyxysoion,Pipapolis,Logotrahyra,Xelchisuhe,Lizibuessa,Leksirdiyra,Hyaeon,Hachaos,Sakidos,Chechbppyra,Xelpurel,Hychedyos,Kapolis,Kupyxo,Loion,Zazudizur,Zazuchbol,Dakonaara,Dyessa,Chezibyra,Zaxgatuthon,Horakaxoria,Buryos,Xigetyyra,Saosthon,Maoria,Puhathon"
      },
      {
        name: "Roman",
        i: 8,
        min: 6,
        max: 11,
        d: "ln",
        m: 0.1,
        b: "Cidpugainum,Visuia,Diiaara,Gutmuroum,Saleia,Vypsgatemca,Vealis,Ticupa,Lebbeentum,Sivpufaorum,Pedmupealis,Vulnipeorum,Zagosetetug,Rynvabene,Vocoorum,Ryndusita,Noum,Suvlumiinum,Zacoona,Tuvvcrnavia,Lugusiella,Qoduorum,Fifiinum,Levasoum,Vabsifeia,Vaboorum,Tosaavia,Muvoona,Meentum,Bediinum,Vydori,Copiara,Ruentum,Cerroboorum,Piiainum,Nefrcgsntum,Vyfoum,Bupuentum,Vasirinum,Qotnnomline,Cegeentum,Cionaavia,Lebdudainum,Ratutaentum,Famofu,Mifara,Xelruti,Cavrceentum,Fuavia,Xelfavovana,Qomirpa,Xeltugir,Vurefagulia,Debsuella,Niaraara,Ribiniorum,Nunabealis,Zapicefvo,Neiaona,Mupvoteella,Tofafeinum,Sigmnbaella,Suella,Reia,Nitalaella,Noavia,Viceferomum,Poavia,Sabuara,Lorevlaia,Lamadonella,Liorum,Podfuella,Nitadoia,Lipalis,Larorum,Canaavia,Vuinum,Qomigmuniru,Peumentum,Surufuentum,Curbcrbapia,Ferboum,Dovella,Qofucru,Locafiavia,Rynvincog,Sualis,Facona,Gefuinum,Doblspvella,Bisviia,Vopusorum,Feella,Palpcgentum,Votfguentum,Govugi,Pualis,Sudinum,Qomaara,Vedbonuavia,Vyguvu,Murorum,Foumorum,Cipiara,Gogella,Libreum,Focalis,Niinum,Mientum,Nivivainum,Salmocoara,Vibtosaella,Sobtereinum,Citcot,Didvaella,Pigdaona,Nasgiia,Nogiboalis,Falalis,Degaorum,Beorum,Levmiara,Zafile,Zadipetimto,Cifumum,Sogoella,Fomavuia,Qomupemo,Vegientum,Viiaorum,Xelnevfulip,Tasubuum,Vyseavia,Pudicvimara,Tocoinum,Ruumalis,Depetuona,Luentum,Sarbpofalis,Casogavia,Bogedaum,Sepientum,Xelrulofe,Lientum,Mididiella,Vygitisi,Rutaara,Fatsadiinum,Sareentum,Levfacella,Gusecgiavia,Damlepuinum,Femaluona,Tirdildaona,Qocini,Gitigoorum,Xelpiri,Vyfiona,Zapoara,Taella,Vymapse,Cuvnnpdalis,Furipium,Xeltim,Zamaru,Mangemgium,Doaraia,Zamururodo,Dabgnnoalis,Maorum,Cumoinum,Sesefiia,Xeltgoredse,Bibivium,Pipigealis,Legoforum,Citdasaella,Dodoum,Camiroraona,Veverato,Xelfdvusmeb,Coinum,Qopamcac,Tisrolentum,Gevopacona,Rotaona,Fiseona,Cinaia,Goloia,Puuminum,Roggodentum,Vylalanetom,Paraara,Durnulo,Rynnavlot,Seorum,Tucinum,Giella,Vemoavia"
      },
      {
        name: "Finnic",
        i: 9,
        min: 5,
        max: 11,
        d: "akiut",
        m: 0,
        b: "Xelsy,Kijen,Vepkiniemi,Vojmjslahti,Nujsalo,Simkoski,Tupenolinna,Xeljivnoryh,Matarylinna,Vysijiny,Tokylinna,Zanejinym,Satrokyla,Zahilmun,Lelamor,Qoruhapopym,Rulahti,Sekyla,Zalupylo,Moputikoski,Zajisa,Lamesivaara,Valahti,Petjarvi,Sytekkoski,Tihtperanta,Rynpuma,Makyla,Teranta,Nikyla,Qohiniemi,Meralvaara,Kiphtllrnta,Tipolinna,Kakoski,Rejpruvsalo,Typalinna,Mutehniemi,Kahyvasalo,Vynitesem,Jymynyvaara,Musivejarvi,Zakistole,Nuvaara,Kumranta,Vitesalo,Xelny,Palvhelinna,Vukalvamaki,Miklneranta,Metppissalo,Persikoski,Honsumaki,Zakyniemi,Zahytim,Mejsalo,Rissnajarvi,Sejanilinna,Hasmlljrnta,Harnmrlahti,Tulomaki,Junekoski,Tevjhapkyla,Rakyla,Kumulolahti,Nyvhvkemaki,Linynuniemi,Rynka,Qomephe,Zakyti,Qohuvmijyn,Lanev,Ryholahti,Tyhyvesalo,Mavrsekoski,Zamelinna,Tyhranta,Tuvsyranta,Vylylo,Kokyla,Norrphniemi,Japsmtemaki,Movulolahti,Qovomo,Jirolamaki,Hinhkvkjrvi,Vinakyla,Karranta,Savsimaki,Lulinna,Rynto,Viniemi,Semrohesalo,Jupekut,Zajima,Pevykanmaki,Taniemi,Vosalo,Pakhumlinna,Mermrvslnna,Vunelinna,Lanyjkoski,Piniemi,Qopajarvi,Vykymas,Kerhryniemi,Zavalinna,Vymim,Novvvhniemi,Zatujeha,Metranta,Qosikyla,Sijtnylinna,Pymmijlahti,Vasjolamaki,Jovetav,Tysalo,Suknpkniemi,Hompvijarvi,Jitylinna,Ryntiruli,Vyvara,Vylekoski,Qohysalo,Lunhetranta,Miniemi,Vynmaki,Zanosy,Hisehavaara,Penkpolinna,Nujetasalo,Nakvukoski,Vysukoski,Kysjarvi,Vyjarvi,Zalura,Zakemaki,Mokone,Sekjyrmo,Rynva,Norhanesalo,Honpnnymaki,Pesalo,Lumjpavaara,Vohntaniemi,Nohohivaara,Jemiklahti,Nuveranta,Lahumaki,Halahti,Sumnmmhrnta,Lasav,Hohuvokyla,Vyjovam,Rynnmsahyso,Ramvjalahti,Qolesvujsu,Roranta,Temaki,Polksaniemi,Vykposajvor,Vunhtolinna,Lilinna,Nolikyla,Mekemaki,Nulalinna,Sopesalo,Mylylykoski,Terkyniemi,Ryntor,Ryvranta,Rykatut,Kahulahti,Movulahti,Nuhpolokyla,Hyletjarvi,Vajymaki,Senylinna,Resalo,Tyjarvi,Kekyla,Sajarvi,Rohvjolahti,Vipkoski,Tojevaara,Ryvulinna,Mynulinna,Qorulvyvyvi,Jyrtkulahti,Hoperasalo,Hyvjleskyla,Qovesalo,Najynlinna,Zapih,Mytikyla,Himtuhniemi,Vuvtelinna,Pakyla,Kumaki,Rujpkulmaki,Qoheranta,Luhukyjsalo,Rukyla,Mevyvaara,Kipajlinna,Totropumaki,Xelnirpoju,Mipylahti,Rysypniemi,Nasmaki,Havaara,Xelmajne,Xelmypivju,Qojuhheso,Ruvolevaara,Jermekyla,Nisalo,Vytyhujy,Sasalo,Sokisalo,Vimihsamaki,Vyten,Kynjtnvaara,Toljvmekyla,Nijapvamaki,Tujarvi"
      },
      {
        name: "Korean",
        i: 10,
        min: 5,
        max: 11,
        d: "",
        m: 0,
        b: "Dadki,Vydihae,Chuchbnugye,Chegu,Dinunam,Ryngogiksuk,Supigumju,Qomosehi,Bugye,Hojewon,Nineksan,Sugubaseong,Vykagengij,Hidpege,Niseong,Jusan,Naktutseong,Rynmihnog,Qopudong,Nojerim,Bachahseong,Nompchcheon,Guwon,Tuchkjseong,Sewon,Nejurim,Bigchihanam,Zahahopa,Jinucheon,Kejetpodong,Bucheon,Tajusan,Gepbihasan,Dusetigju,Yocheon,Nuhiywon,Monam,Nurim,Nunam,Rynhe,Bahudwon,Yimensan,Xelmete,Jetgusugye,Manumrim,Komagmipiju,Nesan,Tekirim,Jitdong,Kutosan,Yomitughae,Kaksumgigye,Jameydong,Yiguwon,Meschocheon,Qobamejabu,Tatgye,Kubiwon,Higye,Qotopadu,Berim,Rynjuchupit,Nobahae,Danoy,Gekimuseong,Pebkasechju,Sejhae,Takaychesju,Badisnorim,Tawon,Genam,Hekbakrim,Kinam,Xelhibe,Kabikbaju,Nerim,Tusibuseong,Soniseong,Vykubeh,Kigehigye,Nahohasan,Nudadong,Kusidepgye,Kogye,Zasunam,Gusdschahae,Tokudong,Doyipehdong,Mowon,Yitnchyugye,Hoseong,Bejadong,Zapehae,Desigye,Vytichseyi,Jingdecheon,Tumogye,Huwon,Qotapo,Mubipirim,Bokonduwon,Bowon,Qokochi,Chohayayu,Vykokha,Tejen,Bohae,Supmassosan,Banam,Kusehidgye,Qopuseong,Chechcheon,Pahujhae,Chachjjchsa,Vygetohkapo,Zamas,Pusiwon,Tupasan,Nujurim,Rynpipakos,Jagimwon,Pujidong,Dehdong,Dosawon,Gejus,Pewon,Nahibonam,Hochiseong,Jedong,Sipamegye,Gihchuhoju,Ryngide,Pechmucheon,Gategye,Gachich,Mewon,Rynbu,Dephitpasju,Batednam,Ryntsdtapug,Mosucheon,Purim,Kagye,Chihijokju,Sunuhopwon,Gochuseong,Yajoseju,Sudong,Chiygegye,Juchiju,Hejtasan,Patekowon,Rynsat,Cheju,Zayohajo,Nopaniju,Chuhgkbdong,Niduseong,Bakasejwon,Tugigye,Rynkaso,Paywon,Hashchanhae,Yadong,Pesmahae,Vysastodi,Kimbu,Pubtucheon,Dotusubnam,Gegpmntdong,Biyowon,Bipseong,Tacheon,Yedahibwon,Chatyinam,Sidong,Chuseong,Sajucheon,Sumehae,Jewon,Geyidanam,Bindibadong,Detonam,Ryntesuche,Gadong,Taseyo,Zastiyechpi,Tupchtcheon,Nojadunuju,Chemuseong,Hujebrim,Vybajig,Piyudochnam,Jubeju,Yisan,Bahinam,Pigerim,Yojusan,Dahekhigye,Mechsan,Tegiysan,Xelke"
      },
      {
        name: "Chinese",
        i: 11,
        min: 5,
        max: 10,
        d: "",
        m: 0,
        b: "Buling,Rynlztbcha,Bidshan,Dukkiho,Xijaguguan,Zahujing,Huping,Ryngiz,Qosuhnulko,Rynchgdloh,Sezcheling,Ketguan,Naguan,Sugikiling,Tohkdxchng,Xezezashan,Xelxami,Hehiqeguan,Xelyukiqe,Qolehta,Fedtfgyang,Qochktchng,Qaping,Hitjoyuhai,Jaxgncheng,Kaling,Mofdchjang,Huluyang,Nalhai,Xelhesuhbi,Dumishan,Yujshan,Mamoguan,Qojijine,Zayagih,Guyang,Chotkcheng,Rynchege,Xelsigmuxu,Femkeyjing,Zaguche,Gamnhashai,Diyang,Qonambu,Qabzfeshan,Nischchjng,Rynchhibol,Munszidhai,Jahutguan,Bitlkbngan,Xelgobu,Beyndiguan,Xelsbekehu,Zoquguan,Saping,Rynxfgqodo,Socheng,Xocheng,Daszukzhou,Qulsgajing,Jijcheng,Konjing,Kelifuyang,Jonofaguan,Fuqucheng,Qekzhou,Bikonoyuan,Yeling,Qomixbeku,Dahizhou,Qogitguan,Gukbiyang,Vydotub,Yeshan,Zecheng,Xelxa,Taxhhashan,Vydaxtus,Xeldu,Xelxahub,Zaxiy,Xebping,Bijing,Xeqxxcheng,Dokzfzhjng,Qobeshan,Fozhou,Liping,Hechzfchng,Kaxmxtjing,Mobenihai,Taxtubyuan,Yalchuling,Xelig,Hechidguan,Xelqujuxqe,Galihai,Qokoxizchu,Zemishan,Joxaping,Hizhou,Lihsamyang,Chelejing,Tozhou,Duchcheng,Bonla,Fidon,Juzbiqyang,Nezuhai,Qojudedi,Futjyaguan,Xuling,Zohehai,Giyuan,Bushan,Yefohai,Chuqeyuan,Qemguan,Vyqijayo,Didchgspng,Xudle,Xelqazati,Gazhou,Yofmnchchn,Rynfaf,Chobglzhou,Vyjako,Guyiguan,Zaxihai,Suyfoshan,Hukeping,Tezicheng,Dujdokfey,Rynznfoymi,Nazfgldchn,Hiyduhai,Rynmmicheh,Yudoping,Rynyufofzo,Vyhufima,Ryndabun,Chuxetping,Dichchddha,Hochucheng,Yuzuling,Zahati,Vybacho,Focheng,Qenxocheng,Xeqin,Xatljgjing,Xelyiyo,Biping,Tiping,Zeficheng,Hohai,Qosije,Vydajing,Baknucheng,Xelzubuy,Xanizajing,Qodogluto,Libecheng,Qotujing,Koguan,Diguan,Zuzzaluhai,Fucheng,Huquzo,Jumuzhou,Xujyjiyang,Juqqhiyuan,Majing,Mahuloyuan,Zabig,Lechmijing,Duhijing,Yohuling,Jechzhou,Qahyach,Vyfib,Bahzashan,Tezeping,Hobchushan,Nuyuan,Tisochyang,Dochslehai,Ziqdonshan,Lindjeling,Noljgmhzga,Xella,Lefxeqi,Tekigcheng,Qegimuling,Sezizoyuan,Gehai,Yuchnuyuan,Nosegishan,Tuyusuyang,Hajhuki,Mobcheng,Fuhizhou,Kegimiping,Rynlujas,Jinaloguan,Qojalatim,Yachaguan,Xuhqihai,Zehejing,Huxicheng,Kebling,Sekhhtling,Rynjaga,Chehhlskpn,Mihchltchn,Chadehai,Somamhai,Qoqaniqu,Xehachzhou,Ryndujo"
      },
      {
        name: "Japanese",
        i: 12,
        min: 4,
        max: 10,
        d: "",
        m: 0,
        b: "Qodiben,Yafehama,Nishara,Xelbe,Gifuhama,Rynhariha,Gikoya,Fuyetani,Guchsato,Yikura,Sumori,Jechrisato,Rynzani,Xelkabuyib,Dochejuy,Michrbhara,Dejrdsbhma,Chotinhama,Chezzmssto,Yamjuzkura,Hiysigu,Tenaka,Sohara,Dodkura,Chetayama,Vyragchite,Restoshima,Fuzsjihara,Zagogu,Vygechyiz,Zasadenu,Nizjudkawa,Funkntkawa,Nedayama,Xelgu,Xelkagikur,Sehotani,Sunikomori,Juhara,Vysug,Bohitani,Nafmezru,Jemori,Kagsato,Duchrsbshm,Taychhsato,Tokawa,Yoyinu,Yubrinaka,Bogmerkura,Foyama,Qocheregdu,Zafu,Zajibus,Rynja,Nochuhara,Forbdehara,Rynsura,Fijobnofa,Rynba,Zissushima,Nukawa,Vydigore,Budeseyama,Ratani,Yoyhara,Zagchokura,Mimahukawa,Rynzsechoz,Zanugeta,Vyku,Hutnhbhama,Rabshima,Tezohama,Gakawa,Kuhama,Zarosef,Chekhfhmri,Xelmi,Vydegmu,Ruyiranaka,Kehara,Nadakawa,Johohara,Rodohonaka,Vyzefa,Sehara,Yobfesu,Sikura,Vygu,Chonaka,Chiyama,Yumori,Jotani,Madatani,Nechjesato,Jefmmzhama,Sanhotani,Temori,Tishima,Teybmkkura,Nubajmori,Zakej,Hamruhu,Dugchtkawa,Rufanohama,Roya,Xelyo,Muyrsnsato,Yiddehyama,Godetani,Rynbo,Mutani,Yaratkura,Debtntkawa,Yakefukura,Sotanaka,Tokura,Setani,Chushima,Chakura,Rynchomuyu,Kudeshima,Rokiyumori,Chihama,Matuyama,Zozo,Tisnahama,Mehzanaka,Mibkmahama,Gihama,Goftdchama,Sikawa,Dekimori,Koshima,Duyama,Nukisato,Kokhara,Rakishima,Jotados,Xelgema,Tesato,Korbjakawa,Zekawa,Chayama,Suftrekawa,Junehama,Rofasato,Jighama,Xelfaz,Chizashima,Bahasato,Vynachehu,Xelmur,Bifafkawa,Chasato,Bahama,Yosigutani,Rynchujge,Chahama,Zodnishima,Datnzosato,Qodomudo,Yonaka,Chukura,Giychrshma,Fechmori,Rofhara,Yuhojetani,Guhushima,Yusato,Tosshinaka,Qoranag,Zichskyama,Gejyehhara,Negahama,Gachaskawa,Xelbecha,Gadnuysato,Vyka,Chokawa,Tagdokura,Zeshima,Dazrjfyama,Zake,Segisamori,Yechbinaka,Firkura,Detani,Vyzuchefi,Nafmathara,Zuhama,Fasayimori,Ditani,Kojumori,Juyyehara,Tayhunaka,Yahe,Qoduk,Chechakawa,Dihara,Gitinkura,Rynbroyahi,Borfekura,Johokura,Difkawa,Vyhase,Zakuda,Mebotani,Zusehakawa,Zayiguna,Sotnaka,Kanofanaka,Sodi,Qofhfuhhoj,Gutnaka,Bibutani,Joyhusato,Sechinaka,Bebbhnnaka,Chatisato,Jechtuhama"
      },
      {
        name: "Portuguese",
        i: 13,
        min: 5,
        max: 11,
        d: "",
        m: 0.1,
        b: "Garavcampo,Mucec,Rynmegolge,Naditenova,Funopranova,Penova,Dotalva,Pevuoura,Rapvila,Notinova,Beteilha,Nenova,Caserra,Maritaeiro,Debfepanova,Betupialva,Mufbudcosta,Zamecosta,Qolun,Xellafebu,Bigmnbailha,Xeldenim,Votgpocampo,Taserra,Sevila,Begovoeiro,Mivucoura,Nictolserra,Conoalva,Barilnova,Qomecosta,Varecosta,Rynces,Vydeserra,Bulevila,Socosta,Qobogaberu,Fecuserra,Folitlima,Carsoguvi,Zamieiro,Zabula,Rynpu,Megopavila,Ramooura,Pavamlealva,Sefebilima,Xelbonisu,Fioura,Dafragasbem,Mutmefcosta,Qosif,Biscosta,Laclurevila,Pacdrocosta,Tanova,Qonolab,Gatogmu,Panuvila,Zadieiro,Finova,Bifticoilha,Vucampo,Necampo,Ricampo,Dovvsoserra,Vuserra,Lobugroilha,Temeserra,Qogeme,Medovuserra,Boveiro,Cofedocosta,Paoura,Fifiilha,Debgafcampo,Camboluoura,Tupivila,Bipisubvila,Besofoserra,Doslima,Lonipnova,Qomipa,Nabgurealva,Mufilnova,Gatdnuserra,Vypilima,Sunova,Fueiro,Rerulooura,Sosurueiro,Vectemoura,Qotolo,Pipcapcosta,Neilha,Xeldvidepuv,Migfabacgi,Sucaca,Zabicutdat,Secvfesilha,Caoura,Xelbofnal,Conllaserra,Gogonova,Godnpafoura,Buvila,Surivnalima,Ruvgusiilha,Poeiro,Nodaserra,Zagesrunimu,Seeiro,Sesiluilha,Gefiluserra,Negvbicosta,Petilima,Qogobli,Saalva,Gusarilha,Vacidvaeiro,Toilha,Movila,Culnova,Davila,Movtucuilha,Nioura,Talima,Getgorovila,Xeldurudsi,Daeiro,Vanorcampo,Zanac,Calavicampo,Vieiro,Fiserra,Mipslbfcsta,Fecampo,Rivomulnova,Mugvecosta,Figbtuserra,Redicosta,Zavagid,Vyserapu,Nelcopuoura,Vysecampo,Reeiro,Pefmafailha,Rynsumo,Futaalva,Tugsnpserra,Pucampo,Ryngafiga,Naricampo,Gosiilha,Ducencampo,Ligaoura,Rynteti,Facesoura,Bebbelnova,Vipealva,Mocrcbcampo,Rutilha,Dagacosta,Radtiserra,Peilha,Gosuserra,Nosavegoura,Livdaeiro,Repossi,Sevinova,Lervvvnniro,Culomom,Fununova,Lureiro,Buleiro,Ravslpcosta,Xelpeti,Cagidnieiro,Paveiro,Toeiro,Ryntutibde,Tuvrocampo,Zafadefodas,Bobudisilha,Deplsucosta,Laggvicosta,Vygedma,Mesnmavalva,Qobbupafved,Celitalima,Taftalonova,Fetsgpserra,Badscipoura,Ryngenelu,Sanifilima,Gutultevila,Lilualva,Seftecosta,Zacicela,Tipilima,Redolima,Ranampanu,Fotbadualva,Sinovila,Gipolima,Rynsivito,Pilima"
      },
      {
        name: "Nahuatl",
        i: 14,
        min: 6,
        max: 13,
        d: "l",
        m: 0,
        b: "Henahu,Holuchtotlan,Tletlicitlan,Qonehezuh,Pecuhhunahu,Lexaqua,Hacpequpoacan,Muchozxoch,Netletlan,Zuhopan,Zayxoch,Qocixunyomo,Nupantlan,Lehehco,Tihoquuchacan,Tlatlaquezpan,Vytlam,Licocal,Lacotitla,Toyuzpan,Zahuzu,Ryntlyitlacpo,Hucpan,Chuchmetu,Xemtmcqotitla,Lictical,Chuzuxaacan,Xupanacan,Pultichepxoch,Quezimyotl,Ponititla,Meyatlan,Queptlan,Vyhepxo,Lotaco,Cunahu,Pahtitla,Rynpuquamu,Zecxachiyyotl,Xeltunahu,Vyzotitla,Xehuhical,Xiyiyipan,Motlche,Ryncutepec,Chupezexoch,Paacan,Pazecal,Zatahuze,Xelxizcho,Quucimeco,Nichquoxoch,Ryncexequo,Zihilpan,Zayocalho,Qochalixtu,Xechupipan,Tlititla,Xelxeteta,Meyizlical,Chimetitla,Pipatu,Xetyititla,Cacical,Vytlemunez,Chuquenahu,Hemenahu,Ticaltepec,Hahultlu,Cochozatlan,Meychtlttepec,Xozutitla,Zuacan,Yolupan,Cozamaxuco,Metitla,Xelchocnihe,Rynpzxechacyu,Xanahu,Qochuno,Chichzumoacan,Nechapocal,Manahu,Ryntletleze,Xehzozco,Picico,Petlhontepec,Zemqanucayotl,Tlacotitla,Lichitlan,Zaytleyotl,Tlulepan,Chinahaquical,Tlohoquipan,Zatuzuy,Motitla,Zezituyotl,Neyoxoch,Mutonahu,Conahu,Laxihyotl,Chiloxihonahu,Tenahu,Tlunahu,Molizumanahu,Xucniho,Xihahxenahu,Noxeacan,Yocalxoch,Cemicem,Qochepi,Nutepec,Tintitla,Putlan,Ryntuzutele,Cutepec,Quutitla,Layotitla,Mepipantepec,Yutlan,Lunahu,Cecalpan,Hatepec,Xelchemuzquey,Xuquelatepec,Mechanahu,Zacoxoch,Pamayinacan,Vyhepo,Zatepec,Quaxucatepec,Puzemtitla,Zamonahu,Puceacan,Zanetl,Qotlical,Zetucal,Xeciytluco,Tlepuchutepec,Rynxohaz,Quontlopeni,Heyziyacan,Zaxepintlu,Xexqchputxoch,Yotunzotepec,Naxacal,Rynquequuxa,Yichco,Molptllnchtpe,Zumeyuxaacan,Zapxoch,Yezotitla,Yichcal,Chiyupacal,Chochxeyotl,Tolacan,Quocoacan,Notlitputco,Quetanochical,Ryntoacan,Xutcmiletepec,Qotatla,Muquetitla,Zoyochecxoch,Tleecxuttepec,Tlupan,Zatitoque,Quoqopyocecal,Tleqmalyutlan,Xaacan,Hupipan,Tlucipotayotl,Mamitlan,Quotitla,Yapehiquuyotl,Cayotl,Qualutepec,Hitolocitepec,Notitla,Quutuhemoacan,Cexquehtitla,Zetlchtlmxoch,Qoyoyotl,Quatltpntitla,Zonocal,Lotlyimo,Vytuhoye,Vyputohoho,Petutlan,Choyotl,Chutlacan,Notlocal,Quexoch,Copeximutepec,Yaacan,Lepacan,Tetatepec,Qoquecal,Xelyuto,Zalutuzo"
      },
      {
        name: "Hungarian",
        i: 15,
        min: 6,
        max: 13,
        d: "",
        m: 0.1,
        b: "Csetuszehaza,Rokert,Gyahaza,Veszkemidmezo,Vuntocsamezo,Zashmacsukert,Meliget,Bogevzavar,Qotahalom,Vynahetgag,Csatoriszeg,Fodomb,Vypazvar,Gaszeg,Turefalva,Daturemakert,Vymefihedta,Kapkgyobpatak,Rynsomi,Raszeg,Gefaspatak,Sihalom,Gazepatak,Dagyefalva,Baszzocsikert,Kedihovedomb,Lummonpatak,Szuszigyikert,Bekert,Gikert,Qolaszoglipe,Qofigi,Puksrigypatak,Gyersupatak,Qorogi,Zamtuhaza,Dekert,Pagetahlahaza,Xelricse,Sinmamabudomb,Qogyarig,Qoszbeszgyuzu,Saszreguhalom,Pifosze,Sipifalva,Megyru,Pobszttiliget,Mecszosohalom,Mogyiduvar,Kupgzigaliget,Migyonuliget,Vyszuzahi,Rynmutar,Mavzepohalom,Bologypatak,Kigyuvakert,Posabmezo,Nefakert,Masodomb,Kogukert,Libaffalva,Kogyetutumezo,Gyesaszhalom,Discsgekidomb,Pomratzipatak,Kigvuthaza,Limezo,Fuszeg,Gitadomb,Hipatak,Mafalva,Ryntopatak,Csefalva,Dofafalva,Bevakert,Gyusvzuzhalom,Fohimhaza,Zadahefugyne,Rohabkemezo,Zasivar,Samoszfam,Csogdiliget,Szalapuhaza,Haszgigihalom,Szestngaliget,Guzheszamezo,Xeltuhalom,Fuggyu,Faszehaza,Ragitfalva,Szigyicshaza,Sehsozohaza,Podoliget,Lemezo,Szugngmehalom,Vykonriset,Xelgyimtimida,Xelszisa,Kaszpimezo,Viminihaza,Csisafalva,Rynhuvar,Kiszrbbkgptak,Remnszmuliget,Mugyohaza,Tadomb,Zusivimezo,Tozcsidfalva,Lipatak,Zonehalom,Zeppapaszvar,Tomezo,Luhogfalva,Vivtlovmadomb,Dubbfunaliget,Gyambeszeg,Mevarkert,Zerslisvimezo,Folagyeszeg,Vygocsuvu,Rofalva,Zotrohalom,Tiliget,Ratmuka,Nohurinohaza,Hiliget,Gyamezo,Totefalva,Zakedomb,Gyalahaza,Zarehogyugye,Liszkert,Guhalom,Tovarliget,Mocsutudomb,Zatuzof,Rynszihuszsum,Szimezo,Gyatotiliget,Rehevar,Gyuszmdgokert,Vykuminsih,Qoszuru,Mevotfavar,Qodenigyte,Rynhegyote,Hesokert,Hopilagymezo,Vasfalva,Kelanhalom,Kurugekikert,Pagyetukert,Pavepgupatak,Higyefalva,Szusehalom,Csovar,Vinunnuszeg,Rucshadomb,Nilutatmezo,Vyhelugy,Beduvar,Dubipofalva,Bicsozumezo,Liszodomb,Mabizrefalva,Szabgyelpatak,Renamezo,Vymeszozecso,Kafucsafalva,Szamivar,Gyugykoszeg,Vylebebo,Kizmahadomb,Lihalom,Kuvarhaza,Gughalom,Kufalva,Gyuhaza,Sagyezovar,Rafalva,Modakliget,Nahaza,Ganegyuvar,Netahitadomb,Szocslnmlovar,Besepudomb,Goszmmzlhalom,Ladekakert,Nahalom,Kitubikokdomb,Rudfalva,Sokulaliget,Rynfugoro,Szonihvar,Vadebivedomb,Szesztvhpatak,Riszephalom,Recsigokert,Szepglgyohaza,Vakuszeg,Csetemezo,Lozihmuhalom,Vutffpahpatak,Hateszedomb,Hihukepehalom,Csorivar,Dutzahezamezo,Roszdomb,Xelkus,Tomopatak,Litezdomb,Rynmuliget,Gyiszeg,Gocsggicshaza,Qogyobanotte,Gyaszeg,Maszemezo,Zazalagidko,Hohemezo,Csokert,Losumezo"
      },
      {
        name: "Turkish",
        i: 16,
        min: 4,
        max: 10,
        d: "",
        m: 0,
        b: "Purlobadag,Tosnupazar,Deyadakaya,Qohep,Tuhisar,Qorayo,Yiguzdere,Vyterpocup,Negol,Nisobudag,Lomsyosova,Rodag,Rethghtepe,Yikent,Licegol,Qocu,Gebrhctepe,Lopazar,Gidag,Dideladag,Nele,Pochkhdere,Makent,Lodag,Hagdrhisar,Nobmgpazar,Yesedere,Litokedag,Muyo,Kehutepe,Medatbidag,Hoyurt,Tahisar,Toyedekaya,Hubova,Puhkent,Zahicen,Taremedag,Mekeleyurt,Tackidag,Buykaya,Gimltkpzar,Yitopazar,Midhisar,Kucaova,Mopnmikent,Papazar,Sekaya,Hopdere,Yubmedere,Coova,Zarilicopu,Nobuyilti,Hakagol,Henbdahova,Zabicultez,Nelzzpazar,Hihloyoova,Hadtugol,Gedeova,Xeltatora,Ryndoru,Zarbochogi,Hikhezyurt,Xelpotey,Cogdere,Bedamocova,Vybundu,Nudag,Vyma,Dobuneyurt,Zame,Losekedere,Cakedikaya,Muknahkent,Cetedgol,Medidere,Neprase,Lehtahpu,Zahoygob,Qoci,Yupdagol,Ryntolutom,Xeleclipat,Mozrbayurt,Danoylagol,Rynzupo,Lekent,Xelsopzeme,Mokkrltpza,Yetyesadag,Girepidag,Yicadag,Tebknokent,Bikent,Xelpuhra,Zedokigol,Nikent,Yedag,Tatudag,Gucegigol,Kuleyurt,Hoova,Yebareksep,Hibikent,Ramkkedere,Suyurt,Hahidere,Zosdupazar,Qoramamu,Zatobi,Pimcdetepe,Takdere,Tatictepe,Hetepe,Qolonu,Cozepazar,Nurokaya,Yagol,Nicigdere,Zacenkaya,Lagazikaya,Yizbkdyurt,Yicpazar,Sopuhisar,Teguha,Vyzo,Saova,Lidaova,Rynseyomro,Kedcyhisar,Hucsahisar,Nuypazar,Deova,Bilhkitepe,Kodere,Qodo,Lugol,Yalagogol,Bolhisar,Xelzokeh,Tihigedag,Yolukaya,Niyurt,Zapucaca,Momocokaya,Cezzozova,Nahisar,Gepkpytepe,Xelzetubi,Rubi,Modhhdkaya,Siputepe,Rynped,Deskaya,Bogedalgol,Kanucaova,Xelnesoga,Mupdere,Birkkyugol,Canihisar,Horenukaya,Yinu,Ripzyeyurt,Zazepazar,Xelhriyrog,Capazar,Ridere,Hirekaya,Lelgol,Rynrori,Nocudag,Gohdzakent,Pishpzdere,Datepe,Cohukent,Xellecu,Deto,Lugokaya,Vysugyiko,Zadi,Yetepe,Gordspazar,Zeyayurt,Lecubiova,Minukent,Kicidag,Cunbetepe,Nirtarkaya,Kikent,Mehkaya,Mapozidere,Partcikent,Rehitepe,Gehhgktepe,Damasidag,Rynpucum,Sabimgol,Gubcidag,Racitepe,Kehu,Yamtakaya,Rynmedul,Dahisar,Karmapazar,Hastepe,Togsdkdere,Bidag,Marnutepe,Tetepe,Zayurt,Yipgikpo,Mupazar,Tohisar,Mosgzhisar,Sasdeyurt,Yocecedere,Tatcapudag,Dekent,Tedag,Bimitepe,Loboova,Recehisar,Hiyurt,Xellisu,Gozuyurt,Xelpapupad,Ririkaya,Ceova,Pinkakdere,Puhdimtepe,Soponosdag,Qolo,Vydeto,Zuraygol,Ziruckent,Poygnatepe,Simkent,Gezopazar,Xelmibeba,Gayotepe,Kibudatepe,Dayurt,Cukaya,Cakaya,Hibashisar,Ditabgol,Nebllakaya,Zihemidere,Yurbohkaya,Bazdere,Geztzhisar,Qomoru,Layokaya,Sakoyikaya,Takova,Doygzagdag,Kiytugol,Gokent,Detipazar,Rynhukiti"
      },
      {
        name: "Berber",
        i: 17,
        min: 4,
        max: 10,
        d: "s",
        m: 0.2,
        b: "Xellukibse,Fufdkukhen,Zelbaazul,Narioura,Hoghar,Kitizi,Zurughar,Rynlay,Limnobtizi,Tafhtbsgzu,Yotka,Zuazul,Rehitala,Wukaranara,Bugunara,Himighar,Nobulukhen,Nolhltazul,Xelzamu,Ryndunum,Hubtyaziri,Xelne,Redmgbziri,Tomlonziri,Muazul,Qofamumo,Howoifri,Forlamru,Gatinara,Dibtkaghar,Reoura,Zirubetala,Kaziri,Woguyutizi,Kiyi,Zayeyu,Yighar,Benawitala,Kosazul,Vyse,Bokhen,Wisuyuoura,Hebiho,Zamogiwul,Kufunit,Zazi,Mughar,Zedrfsnara,Hokkgslura,Temaz,Litdsdlkhe,Hatizi,Bamatizi,Hiifri,Xelgano,Ledeki,Latwontizi,Zughar,Zuslbitizi,Mumhokhen,Fudnara,Yilrfhnara,Hitbtutizi,Zofghar,Woyetizi,Bugedumaz,Qorigihdol,Nahatala,Qofat,Gabnoztizi,Xelha,Setala,Haifri,Qoyidwe,Yuziri,Nisaoura,Daswrnazul,Bowdszoura,Sawbffoura,Nultala,Seyaremaz,Kimagatala,Lelfnsazul,Zalmubtibi,Nunara,Tazughar,Yiboltizi,Vyhirodume,Tayehazul,Lekhen,Moziri,Mobhmwazul,Narunara,Ruksbotala,Yeyikziri,Tatala,Waoura,Solukhen,Lusasu,Rollriifri,Heifri,Kubughar,Noghar,Zawimudog,Subkhrlura,Maazul,Xelti,Toazul,Kaditizi,Teazul,Zamaz,Yuttala,Wugehiziri,Titizi,Bidwatizi,Duazul,Xelzigo,Gaifri,Futngwtala,Wukhen,Nafgizghar,Xelfi,Nuhoura,Vyfagbamob,Yodtala,Laifri,Nendononki,Tazyoyazul,Nuyuoura,Dutkhen,Sozozo,Fafabooura,Qoneyi,Taifri,Rynzasa,Hikuziziri,Tuheghar,Hokogaziri,Qodari,Korbidziri,Vymirahu,Totizi,Lihzughar,Wegitizi,Tomhmsziri,Sotala,Sokoretizi,Lohanara,Soyifri,Libiguymaz,Vyhote,Zanu,Kastizi,Huhbwktala,Susghar,Genara,Zafagi,Kuazul,Mifeifri,Bukthskhen,Bugtnukhen,Biwugeghar,Lozbfttala,Damaz,Botaifri,Lenara,Qomofagera,Sefmabomaz,Hooura,Xeltelitik,Goronkhen,Zagketaldo,Rughar,Vyzotem,Rynwufi,Faghar,Gewifutala,Satizi,Kukihunara,Xelma,Qonehur,Hukrwatala,Zanara,Vybanise,Vylisehi,Lernmrhmaz,Zonsoifri,Ranbasziri,Zasiyri,Muzfntziri,Didlkonara,Limnkukhen,Nayiftala,Hire,Wuzohrimaz,Vyfezo,Kubuwado,Yekzanara,Fabkuytizi,Vyfi"
      },
      {
        name: "Arabic",
        i: 18,
        min: 4,
        max: 9,
        d: "ae",
        m: 0.2,
        b: "Nanahr,Dunahr,Zezedar,Qokajdife,Wokjzeayn,Bikaqir,Sukah,Hayzjabal,Huwijabal,Rynru,Lijabal,Bektunahr,Sedffaayn,Siras,Xeljnmtot,Fuydiras,Rynzmjilu,Fujabal,Lahusdar,Zehhewsah,Badar,Biayn,Kedhabsah,Zisah,Sunaqwadi,Qolewuja,Qodsanahr,Fewadi,Vybo,Keras,Minamed,Wumyadar,Rewim,Qobyyomja,Nabjuwadi,Zehakul,Zokezmed,Tijawqir,Zaywamede,Mosamisah,Fomaraayn,Finahr,Narkadar,Karemed,Modar,Rynte,Fetusouk,Yerrblwdi,Ladar,Qohofu,Mujabal,Hofnahr,Jajabal,Suras,Zajayefi,Tejirdar,Kowerayn,Kalsouk,Vywazey,Toayn,Zabalura,Qonanolo,Noqmindar,Doqesouk,Ruzifsouk,Bedar,Lejabal,Qoho,Julnahr,Jikkjabal,Dubhztsuk,Muwadi,Najamed,Memsasouk,Qoras,Rynqu,Rynna,Nufmonahr,Beayn,Yuwiwadi,Kutekras,Qoloduzo,Denufras,Kujabal,Newadi,Hofqir,Vylo,Jojabal,Webras,Daqoras,Zofwfwbwj,Beyrdnahr,Jiqbjsouk,Yuynahr,Maqir,Lutbkaayn,Musah,Qowusufe,Fibndudar,Yuqir,Quriredar,Qoqurbame,Winahr,Qunanahr,Mojisah,Tewadi,Habnahr,Xelbuh,Zasu,Rynqiti,Bosaayn,Zaqow,Weqszwadi,Yujabal,Yehnusouk,Fibyanahr,Difuqir,Rulyawadi,Yoywknahr,Desuluras,Qojeyen,Vyjitu,Dasah,Qodemomed,Hisasouk,Xelbjbmku,Jazdjabal,Hawadi,Vyduru,Widsah,Buzusouk,Soknahr,Suklusouk,Yokyoqir,Qilimed,Liayn,Suqir,Hohzzwadi,Botiqsah,Safbiydar,Rujsosouk,Dorqhzjba,Bosikidar,Siayn,Vyyanak,Hojklomed,Dadesouk,Norsouk,Zosah,Rayhamed,Rejefuras,Qahimed,Dozoqir,Nordmsouk,Zitu,Burhjabal,Manwanahr,Vytiq,Nifqjabal,Todar,Lasah,Fuhidar,Kaytkiqir,Zakumbada,Wefew,Nebmzudar,Relufayn,Xelfiqomo,Feyajabal,Rynzama,Besouk,Qoru,Zalaweras,Duzmed,Jiniwadi,Biqir,Wuliyosah,Dotusouk,Lurdnsouk,Zakdar,Lanahr,Zojaloayn,Totoayn,Qaqusouk,Hakoqir,Rynsusoq,Jiras,Husa,Nijabal,Jalinahr,Qowura,Rynfiruba,Jatequs,Maqetimed,Kenahr,Rynzubufi,Rynzi,Merijabal,Sahijabal,Qudar,Yafasayn,Kofnahr,Dofqrwadi,Suksjabal,Wonahr,Dozinsah,Rynju,Zarsewadi,Setbnoayn,Qolefyu,Nuqdekras,Wumjkedar,Jiqir,Sawurnahr,Majedar,Rynle,Debshldar,Fowadi,Felyinahr,Mosah,Danahr,Hamzayras"
      },
      {
        name: "Inuit",
        i: 19,
        min: 5,
        max: 15,
        d: "alutsn",
        m: 0,
        b: "Seknunemnait,Qomsorsusuk,Rotakoyaqaq,Vosoruvik,Tituk,Tesuk,Rynsimanru,Nakosey,Qomiut,Tusatupaaq,Vykurmoneyo,Vasnait,Pinyutavik,Kiyituuq,Vemekisosuk,Kepliq,Ruyekqasuk,Toqivunoqaq,Piyeqaq,Qokvumyutuuq,Vetuuq,Noqaq,Mimvevyoretuk,Pikyuranqunait,Tiptiqsuk,Konyoqovik,Quqvik,Pirnavik,Kenuk,Miriliq,Qomuqmaqa,Namtimtuk,Rinait,Tapevnuk,Tuquliq,Retuuq,Nevyo,Remamittuk,Xelye,Qinesmiliq,Qotisqoy,Topuvik,Vykene,Mayusuk,Yenait,Vakeliq,Vinunuk,Vysanuk,Vopmiqumsomtuk,Topaaq,Qorirasmu,Yimenuk,Rampesutuuq,Yepeyu,Yomoripaaq,Poseqatiktuuq,Qetotuuq,Naypoyvuvnuk,Tesmurnait,Suqoqotuk,Tumiut,Paqoveyemiut,Qomommo,Zarimpepon,Royiqevaqaq,Nesuk,Rynvu,Veninait,Vitiknuk,Mesuk,Pipnumiut,Poyvusikyanuk,Vusuk,Panituuq,Vykeyire,Rynvuvoto,Muranaqivik,Mopputonqa,Zaqokivu,Tumsaqamsuk,Raremiut,Yapetvituuq,Yiyusopaaq,Teratuuq,Seyunapotuuq,Tusuk,Seretuuq,Suyinuk,Yevtesumoyqaq,Zanotu,Xelvesay,Vosutatuk,Vitopeyanait,Ruvetavik,Yuyqerumtuk,Xelrosyosi,Rekapaaq,Reraqaq,Qomete,Rutesenyupaaq,Muvik,Maqutonait,Yuqituuq,Qotusuk,Maqayetuuq,Nevatuk,Zatotuk,Qaqyatuk,Xelvapiqep,Vereqironvik,Kekikninait,Satpumsuk,Yiqaq,Kivtuk,Toqaq,Kopavik,Sunait,Suliq,Vatsusuk,Kuyorusuk,Maqeyaliq,Sanait,Poyumosuk,Poviliq,Kuqinait,Reqenuk,Satuuq,Pumiut,Norevuyoyliq,Nekaqovik,Siqukutuk,Patusyortuk,Tupaaq,Yitopsimiut,Qovepo,Yaqaq,Suynemiut,Nipotayaliq,Ruytareqavik,Sutuk,Tarquntuk,Raqotpumpu,Vyyorunoqu,Serqiksiyavik,Saseqotuk,Vynuqor,Konrutuuq,Rynseyev,Yenpaaq,Niyipsanektuuq,Zaqupapsem,Rosuportuuq,Mevnisutnait,Papaaq,Xelnosokip,Yumiut,Ruymatomiut,Riruvik,Xelmirasni,Tevqasirvimliq,Yamnait,Qurnuk,Pisavik,Raqevik,Qonupavike,Vuretutmiut,Tomiqapoqaq,Rotuk,Qavivapaaq,Qaninariqnuk,Vysoqaq,Yamunamiut,Nenunuk,Sisumovamiut,Sarokavik,Povikavik,Pupkosanait,Yesyatanuk,Rusrapaaq,Siqmiut,Vukiyimpi,Yekumitnuk,Xelpumu,Koyotupatuuq,Niyequliq,Nupaaq,Variku,Takaqomituk,Vipitvasuk,Kunmossamiut,Rynkuve,Sayquvipaaq,Qeyatikiqliq,Qamupenait,Mutmuyasnait,Yeyunqinait,Xelqevu,Katuuq,Paqpopnait,Kituuq,Toquqo,Komaronuk,Xelniretiq,Nurekunasuk,Kopavetuuq,Yumyosuk,Pukmevano,Rynmovikuvu,Siriyuyutuk,Puqtotusuk,Rurvekoytuk,Qevik,Xelkimeqa,Setimiut,Revkonranait,Monomonait,Zakokapam,Toppuqenait,Qosoyorliq,Qesotatonait,Pesektetuk,Ryntetkoquru"
      },
      {
        name: "Basque",
        i: 20,
        min: 4,
        max: 11,
        d: "r",
        m: 0.1,
        b: "Lonudte,Rordtugaeta,Zitegi,Vyhi,Gezlabondo,Xigkridondo,Kimudaibar,Dodbuhut,Vylarub,Sunurazuri,Xelbud,Hiral,Xelre,Gitreondo,Daaran,Zealde,Mumxzelzuri,Dezmendi,Qosedza,Datekiko,Vykitel,Nekalde,Xoldimob,Kenuaran,Zikaalde,Nozezitegi,Rynrahinaki,Gimendi,Hozuri,Xisbutondo,Zara,Vyheno,Toalde,Kixoteuri,Tabbaznieta,Zagi,Xargorri,Zodhsitibar,Diuri,Mozitegi,Tixuxealde,Bokmuzo,Sukategi,Migeta,Tolgorri,Rahasaaran,Xelzhirelse,Ziaran,Sixogorri,Koxtukialde,Tidangorri,Dazorno,Vynoduxba,Taeta,Xosoralde,Rynxaxa,Mihahegorri,Liibar,Sutxezzaeta,Vyruzomi,Dikartegi,Muma,Zazumendi,Nauri,Zuhiboibar,Xelses,Rynhebomu,Qohi,Samategi,Helaran,Xelmunlito,Kekagsaondo,Metlduktegi,Rulugondo,Temendi,Kohtegi,Sumendi,Geibar,Kamhndnnndo,Hutaran,Xellhhdemdu,Ruknnibtegi,Siniaran,Xulhkrutegi,Naaran,Xube,Kukdiluibar,Rynmahot,Seburondo,Mihudnoalde,Xolute,Laondo,Kexolondo,Zexhghsmndi,Regorri,Nutabemendi,Geri,Lihigaibar,Mulotitibar,Badi,Xelhi,Huzuri,Setdosuondo,Mitutekouri,Gezehutegi,Sagorri,Humendi,Vyrukeli,Kalxueta,Mamudetegi,Nehaibar,Nedaondo,Ronizuri,Sanimeta,Vyturabri,Dahki,Loggamsuuri,Lubuzuri,Nuxalo,Zabi,Qogorulge,Lunin,Xualde,Zisenaran,Zaondo,Xatoalde,Sirutegi,Xelsuxanal,Maxamendi,Ladximmendi,Memsogorri,Gamendi,Gokeibar,Qotiguhu,Rynlhnbazod,Kunemauri,Hazodageg,Melutegi,Noibar,Lumendi,Xizehoneuri,Helualde,Gaeta,Gitzdimendi,Xemendi,Zada,Sihbetiibar,Saibar,Zamugzadi,Xitlrnualde,Xelmuldize,Qobubki,Vyzil,Bizi,Tisbgixibar,Tarihiibar,Zesosuleta,Mishuzuri,Dutegi,Kurkkegorri,Bamiguzuri,Mozeondo,Xirdlurzuri,Hamoondo,Zalednidre,Rubxeibar,Hemendi,Hugorri,Xeldeh,Rynta,Zanih,Zenkuibar,Xelzasa,Hodaran,Kokmlkmbndo,Takutloaran,Leibar,Nezmendi,Koxemuxuri,Mohuxaalde,Keheliaran,Dabehzuri,Mozmoxzuri,Rynbobezu,Robkesega,Bamimendi,Zadzuri,Xumendi,Rynti,Todaxiaran,Kiboboeta,Gunkealde,Ryndoheda,Vysixedza,Hualde,Riluzibar,Xuggiondo,Xuxhmumibar,Nizklxgalde,Turaondo"
      },
      {
        name: "Nigerian",
        i: 21,
        min: 4,
        max: 10,
        d: "",
        m: 0.3,
        b: "Taze,Vytahezi,Nirrwemina,Nerima,Bebala,Gubala,Zofpjtbala,Motari,Qokegabda,Hiteloduna,Sorrima,Gerjkutari,Bazuykala,Loskusmina,Lulchyduna,Zirumina,Sazipuduna,Kuritari,Gutschloko,Folloko,Sonfwukala,Kafabala,Futari,Nachizari,Lidmina,Wumgokoro,Betiweloko,Zamilanlo,Fujpbuzari,Nomina,Renetari,Mokala,Yitetakala,Sodkoro,Kumehra,Nachilbala,Sibala,Yitari,Rynljjepes,Tibala,Hayzteduna,Rynhizeg,Chakala,Xelsa,Yozide,Ruduna,Rynme,Zakoh,Kulklchhzr,Lurorakala,Diwagtari,Buwzari,Fafijiloko,Podnsubala,Sejo,Hewitari,Wugowurima,Xellopeyu,Fulu,Vyda,Chidztplko,Mehwetari,Zabe,Dewbmiduna,Zado,Meponotari,Peduna,Konchdkoro,Ramsweduna,Bojobala,Herahobala,Besuzari,Wokoro,Momnitari,Kibzitkoro,Bajeluduna,Janjpiguma,Rynmolewe,Zako,Xelhsranru,Xelbwuboda,Hakbubala,Lafbore,Gutemina,Lufwzokala,Nudakguma,Nezari,Chifchlbla,Samrrdkala,Puhsffloko,Xelhotil,Kawi,Porsafu,Chuwgfnkro,Fawdatari,Vybazdefu,Jobala,Wamamina,Daboduna,Jiwnpnmina,Pechpabala,Letari,Xellzbpube,Febloko,Kalogerima,Kubukoro,Lerihmina,Lurima,Mopih,Rifitari,Rynbed,Jitirima,Selchuguma,Wergsukala,Hahonaloko,Vyzibe,Wehkoro,Benizari,Zahaledu,Numigoloko,Wetoloko,Zeku,Qotazisi,Lawfafa,Loggpuduna,Fesude,Jewoguma,Huymalkoro,Zate,Yekoro,Rynjofaso,Zarustoye,Fochid,Guyukoro,Xelbikase,Zozlwizari,Daduna,Yehchumina,Mufloko,Pizlakala,Hekala,Baloko,Chuchhpkla,Tinkoro,Muditiguma,Witognig,Zuse,Nodepekala,Rosukoro,Dezeguma,Lanokrima,Tupskumina,Mannedrima,Bipkfzmkro,Mazwe,Horunuzari,Lokaguma,Yachzari,Hazari,Fuyzijmina,Wazu,Xelfu,Chuzaduna,Gopekala,Rirjezkoro,Migwpebala,Jaguma,Ditgthtari,Hiwzari,Wamina,Mogfjnjkro,Yebala,Bummsobala,Vychayichu,Zabuyapay,Rujajurima,Rynhipipa,Rugazeguma,Qoni,Gichlbmina,Duwokirima,Mebala,Losduna,Loffojmina,Jeloko,Vysu,Manilurima,Gulazukoro,Rynsefo,Hegrima,Lidokala,Zahdhebcho,Rikkbizari,Ruchakala,Birima,Zubbrnkala,Rizari,Mirabiduna,Yopkoro,Botolamina,Duzari,Kipjezari,Rojegobala,Yatkojrima,Vyle,Rynfuyaswa,Makala,Hopaloko,Chimina"
      },
      {
        name: "Celtic",
        i: 22,
        min: 4,
        max: 12,
        d: "nld",
        m: 0,
        b: "Gwyglen,Rynnupalegw,Gobr,Fuglen,Rynlesa,Gwypicairn,Wabran,Lumoor,Breglen,Movale,Cifubraglen,Bruglen,Mononotor,Moloch,Brovale,Mywovale,Cudun,Brosfa,Nator,Rabotudun,Vylatren,Zamulpygwe,Bromytba,Wigogwmuglen,Gutocigmere,Rynmor,Gwuvale,Lumere,Sybugwumtor,Wenumgowglen,Newasogimere,Nudogwtor,Gwewyn,Sydun,Fuleficy,Gwutbrfybran,Vywuraci,Cotgwycairn,Lapbbgwgmere,Patipator,Bagatoloch,Bramere,Xelpylo,Babran,Nybobpotor,Bysdun,Cywyn,Limoor,Dicecceloch,Gacairn,Sawgyloch,Fecodbriwwyn,Fabran,Buwloch,Qoba,Rafytufmuwyn,Rynpamfil,Fevale,Wagwpeloch,Wadcbbrsmoor,Sybryboloch,Brygwyvale,Gwigibrvale,Turugadun,Zabrinus,Notumetvale,Zalo,Feglen,Fodun,Wopeloch,Ryngwfatigwu,Zawusem,Depeglen,Soglen,Facairn,Nybran,Peranonsator,Gibybygwwyn,Xelngwbrbrni,Cydun,Nubran,Ridglen,Gypaloloch,Wydbriloch,Dolimoor,Gewuvale,Fogmifwomere,Wogwwemoor,Ledun,Cogwewyn,Ryngugido,Wybrydliwe,Ciglen,Pagnimoor,Redi,Ryndrgwbrumo,Fincecimoor,Nocairn,Ribrbrnpmoor,Lunelutor,Galoch,Xelngwlobrel,Demmamere,Pubrugwwyn,Pybrudun,Xeltofagwo,Gwegiwaloch,Vysa,Dopebran,Zawa,Qobra,Gusymere,Lomoor,Mirybwyn,Gwugmoor,Fatsdggwator,Rafmgwlibran,Cusnagwyglen,Fycairn,Pewerogovale,Lygofmoor,Zadugy,Sytucadun,Pecairn,Lebralavale,Futudelabran,Nusloch,Xelpabra,Xelgani,Ticy,Rynsyt,Mutubrwewyn,Dytutor,Copomoor,Mamapobran,Pywyn,Zacymoby,Fubran,Luvale,Gwulitor,Lucairn,Pobrlbfgbran,Dudorubtor,Brotor,Bryvale,Lonodun,Vyly,Bybran,Dobrocoddun,Solu,Nywwe,Liwvale,Taryturdun,Bribtor,Nawyn,Remere,Qosutacona,Lugiloch,Brawywyn,Sebrapdun,Fymoor,Typowbriloch,Xelte,Vypywynib,Bramatimoor,Beloch,Subregama,Brifagwuvale,Duricairn,Doglen,Nevale,Musircatywyn,Leglen,Brogepadloch,Fyfidywucdun,Xelwacaco,Vyci,Pympgwtimoor,Puwutor,Redymumoor,Pibran,Rynrirba,Wyglen,Ryngwysolo,Delybran,Dafbodiglen,Posnymere,Gwibrotywyn,Vycygum,Pigwmere,Seloch,Lefsigwumoor,Tysogwowyn,Bripupeloch,Gubro,Wimanucloch,Micairn,Zabrasyse,Xelwugbiso,Mynutor"
      },
      {
        name: "Mesopotamian",
        i: 23,
        min: 4,
        max: 9,
        d: "srpl",
        m: 0.1,
        b: "Tubizab,Mimur,Honu,Hanabkour,Rynresa,Tuhkrsttn,Xeldirho,Qobu,Kubari,Zahi,Ruzuesh,Zodur,Zararuni,Dozdohnib,Xelgskzim,Zoggibari,Kodenara,Qoda,Gahnsthsh,Kuzab,Kakgunib,Nonara,Dadekar,Nanara,Kuesh,Hoszunnib,Deknbanib,Hosekar,Dezab,Ratuzi,Mebdolzab,Zagezoto,Roduzab,Hikar,Gonara,Rynkardu,Sabutdur,Nahekizab,Bozikar,Zimushi,Rynbom,Nitbari,Kisur,Bobari,Segosip,Kanazab,Nobadekar,Kekohnara,Genudur,Gukar,Giltankar,Qodesek,Muza,Boesh,Zagose,Reznib,Turobdur,Zato,Rynga,Nugeakk,Nodigeur,Rehodadur,Tediteur,Zadu,Buznara,Nohunib,Rynsu,Nigtitesh,Qohnsagah,Didur,Qonarolib,Zesip,Rilnsozab,Luesh,Qole,Siztidur,Xeltuzoma,Nakbubari,Rynnerum,Rynzbkbed,Lorikesh,Didisur,Zersip,Logzinara,Zour,Mibari,Nubaguzab,Mehhanara,Marmtrsip,Genisip,Liraboesh,Sonosakk,Hedur,Xeltssrid,Domzdbari,Vytuhotsi,Damugiesh,Bodur,Heur,Qohugike,Mobanara,Rynlet,Vyzi,Geesh,Goakk,Rotomesh,Gesip,Kehur,Nasginsip,Tanara,Dibtelakk,Muur,Xelmiza,Banib,Kotsabari,Budur,Dadasur,Tabari,Gihzour,Zoludur,Rurisuur,Miborruur,Derzigzab,Siur,Zinusip,Vysilbura,Tuklusip,Kanninib,Gebaakk,Dosdnmsip,Kentlanib,Haknara,Ruztedur,Lenib,Gendezesh,Matsnhnra,Biksannib,Gisamisip,Toku,Nimhtuesh,Qodiremob,Xelnbalte,Guslohdur,Tinara,Qogu,Duribari,Kisip,Mokonara,Taesh,Kedur,Mulrmezab,Sakakk,Vyha,Turnogur,Gelikar,Buzizab,Zulresdur,Nasip,Gudnhudur,Gesedur,Gabuniesh,Kosmrezab,Keur,Vytomhi,Qonulem,Lomanib,Tanib,Zasiggi,Lesip,Lolkboesh,Vygese,Segsodur,Zaniesh,Lombbtsip,Tusstanib,Dunlgedur,Hemtnnara,Nikiesh,Tohakk,Laszsgkar,Qohale,Tokiesh,Soluznara,Lilsesesh,Rynmibi,Dibhsbari,Zadghikga,Butozab,Tidur,Lokoludur"
      },
      {
        name: "Iranian",
        i: 24,
        min: 5,
        max: 11,
        d: "",
        m: 0.1,
        b: "Foyozar,Suhfafumehr,Zadar,Kovfivar,Mudinav,Dagird,Zudrurud,Vydebvuna,Rasuvar,Rynnep,Fesrkpfabad,Ryngo,Davarud,Ryngoheyate,Sesekar,Zanedagird,Vybanhi,Xelyina,Fuzar,Vedsgdogird,Vyzubeni,Gumukar,Sikumehr,Vymeto,Konuzunav,Yusfavar,Zageturfu,Bokar,Yaridebrud,Vyvovar,Dinufamehr,Siyrazokar,Desodiz,Matekaabad,Somikenkar,Tenav,Pukar,Puzepokar,Vuyidiz,Zaydazar,Tegotshahr,Vyfud,Nekimehr,Geftozegird,Komfe,Bapohpogird,Pinaboyokar,Hizar,Tifevnav,Revar,Funagozar,Qosuzimu,Gopofinav,Kurkamehr,Yugird,Hugmihuabad,Kokugird,Zamenav,Rommehr,Goragird,Foynav,Rynmihuye,Huphbzdshhr,Ragird,Mesfohukar,Yuvahiranav,Xelzosbidi,Doyikar,Duhofiabad,Hukakinav,Gumehr,Vopgteshahr,Dunizar,Vykobota,Tekar,Vozar,Hagofmehr,Vababad,Virfadiz,Qokefaru,Babunurud,Vygusovof,Ganivar,Zizakar,Hambipamehr,Zedorud,Rynhpisegpo,Rynzakefboz,Kupnav,Dosobe,Heyibakar,Xelri,Zafakiz,Zafgomehr,Hosugonav,Xelkemezegu,Xelpo,Hoyhikenav,Puvediz,Royhezudiz,Zanimek,Toabad,Xelduhi,Yakdiz,Voshahr,Zebefanav,Zopirud,Ryntepurbem,Pufgtuyabad,Dakar,Rynfe,Zazeabad,Zegird,Zapetu,Vysutazos,Mehifadiz,Xeldanono,Vegototozar,Yekikar,Setabad,Qozusidmihe,Ruraroabad,Binav,Huvzar,Kesurdiz,Vyfapkuti,Herabad,Gavubzar,Gesnfeshahr,Vyraha,Zisnpgoabad,Vanakar,Pagushahr,Vomerud,Rynsoposo,Zahuzar,Fodorud,Qoraabad,Pihobezar,Vyyezfudon,Vyhit,Febpudiz,Nibadiz,Ziniyorud,Riruni,Seranav,Yugimehr,Tetivismehr,Hizmehr,Sukubkar,Ryntetute,Zagize,Susvasgird,Dekopoabad,Yutuvshahr,Hinav,Mizdrevenav,Zapad,Pishahr,Visikeku,Pakar,Mukar,Rugird,Givnav,Yorakar,Zapopme,Bopokokar,Nepvktivkar,Vyvira,Fedgomehr,Hanav,Fukdiz,Tadpumemehr,Fetkediz,Savebiabad,Getaggird,Rirnav,Fezifaz,Vegird,Rosakar,Zavuguh,Mahabad,Yemhgnugird,Qosefo,Nerud,Vyrivikus,Kushahr,Hurud,Rufmtivmehr,Rodiz,Yetoyimehr,Dinav,Qozogird,Veyoshahr,Kemehr,Rayrpzfinav,Pomgird,Dunav,Qokafehev,Putshahr,Hahysapgird,Gabebagird,Hirud,Bodamehr,Genfgzvivar,Qopunafuto,Zapukoyo,Dedvar,Vynarud,Bimmzezinav,Rosurkigird,Pegzubpinav,Qohovorog,Pehohurud,Perkzsaabad,Vysemetye,Fabidiz,Tamenav,Zagamehr,Novigird,Maberud,Doshahr"
      },
      {
        name: "Hawaiian",
        i: 25,
        min: 5,
        max: 10,
        d: "auo",
        m: 1,
        b: "Naphonoloa,Nipakapuna,Zawepemu,Qolihho,Nihipakula,Vykiliwek,Polpnweloa,Wellmwpuna,Pikula,Lukula,Peluhilo,Qokihe,Pahilo,Pownimpali,Hakula,Wippwilani,Nakkamana,Wawloa,Wamiwanalu,Pipulani,Nawimwai,Mawlani,Munwnupali,Puloa,Lepolani,Kilani,Muwkhhhilo,Zakipeko,Piwakula,Xelhlwemin,Lupippuna,Mawunu,Pikhehpuna,Wamapa,Wekanumoku,Pelmlehilo,Pilopinim,Hokihilo,Palowuwai,Kukepenalu,Mapali,Hohimnalu,Vywuwai,Lumapali,Nuhilo,Hamonimana,Zapikemma,Xelhinuh,Lapuna,Wopuna,Pelkemoku,Momana,Lumana,Zahoni,Wulmopu,Hinomana,Kumenumana,Kohilo,Hewemoku,Koninalu,Huklhnmana,Mikinalu,Rynla,Zaluloa,Mimwlelani,Hulwkphilo,Kimawihilo,Mukula,Nehonalu,Wokweloa,Melepali,Milapali,Wahlani,Lihpa,Zahowi,Mikmana,Pemwwihilo,Xelnawmiw,Lamoku,Pohakloa,Wuhpkanalu,Niwwlwpali,Lawpo,Kakapimana,Rynmapi,Penupo,Xelwi,Lihlunmoku,Lunmanlani,Kumkllnalu,Wememoku,Wuloa,Nukuloa,Kuweloa,Lemoku,Nukula,Xellololpo,Pemepali,Qokuwai,Hupali,Xelpa,Vykiwe,Wephninalu,Qomihina,Homoku,Wunalu,Kiwuhilo,Pupphknalu,Wiwwunalu,Laklani,Vykalohwok,Nammwekula,Nupmlunalu,Vykawpeku,Wolani,Vywoki,Wenehilo,Winokula,Zahoka,Kalppowloa,Vywepuna,Lipawkula,Qokukula,Napali,Halani,Nomnhnpkla,Niwowai,Zalinupak,Hamoku,Qolohpu,Mikalowai,Lalklelani,Lilolemoku,Pohawai,Nihllolani,Menalu,Pemlepuna,Kenemoku,Mawihilo,Vylulpune,Kanokomloa,Kipnilani,Hawla,Wapikula,Zawamikpu,Wonlani,Pipuna,Xelhapuha,Mamokhilo,Lawwenalu,Lehimana,Wopowawai,Qowiki,Homlkmkula,Lupklamoku,Xelmulam,Nupupuna,Wopipipali,Kilolani,Puhki,Nimana,Hiloloa,Hemwiwpali,Xelwkphope,Hoklum,Kemoku,Mikihilo,Welani,Vyhwunihep,Luhekula,Qopkomilpe,Mopwpholoa,Hupahopuna,Mokononalu,Mupali,Xelhewupi,Wehwilmana,Mumlimoku,Hemmana,Lipemmana,Kewomana,Wihilo,Vylalu,Wimoku,Wokula,Wepali,Kapenalu,Malhuwai,Nohowai,Hehihokula,Mukonikula,Holipali,Rynwe,Popkmipuna,Wakepuna,Wapinalu,Memapali,Mopemuwai,Nowehikwa,Milehilo,Vypale,Lennephilo,Linapa,Nimmoku,Rynhehko,Nihilo,Mimulani"
      },
      {
        name: "Karnataka",
        i: 26,
        min: 5,
        max: 11,
        d: "tnl",
        m: 0,
        b: "Hekere,Xellnethali,Chabokibela,Gisebela,Gogiri,Bivpura,Hesesiri,Dehomara,Zayayama,Nadichikere,Gapete,Devara,Sakote,Purubvara,Hinitajpete,Vajohipura,Panadu,Tanvchupete,Rakote,Yonakote,Zanepkih,Chokovara,Tomabo,Yichkninadu,Nakgkuhbela,Johalli,Lekukote,Peggahalli,Musepivi,Hikote,Gosaharnadu,Nulanadu,Nangpihalli,Rynnu,Techihalli,Jelubgiri,Batnadu,Qovogiri,Nochttkpura,Subpura,Nubmara,Bepenadu,Savukevara,Zaguhusos,Tihepete,Kipuhuhalli,Nuhvmiygiri,Lemikekere,Rynpi,Toretnopura,Zanuvorir,Gopogovara,Bohalli,Rogiri,Kachubela,Nuttobmara,Qosedvajup,Qoyogu,Rikirda,Nohalli,Jepemtopete,Ruyulkugu,Xelmajonar,Rynpa,Ronadu,Chehltenadu,Labdechkote,Qoyukitebaj,Gupete,Rynteyor,Xelripmad,Pavara,Dikubela,Kiseso,Vykukote,Yihalli,Duybojupura,Jenemara,Hegomara,Qokalhoviyo,Vakere,Xeldojha,Hamnekote,Sehvara,Tetoka,Rynbokukuni,Dajovuba,Tuvkegiri,Mekote,Sujopete,Chovara,Jahhitugiri,Yasgiri,Qorutoro,Tayajagiri,Yijevara,Yagmghopete,Raltavkote,Jammulevara,Gitpdpvvara,Goyamkobela,Yoluvara,Gaynadu,Babgilomara,Qokava,Yasuhipura,Lamnadu,Botdugiri,Matajhalli,Putagunadu,Qopemara,Vatayo,Nuyurakere,Jajpsrsnadu,Rivipete,Pachkipura,Pochptakote,Zagigiri,Danadu,Zakivo,Yupujepura,Chahmchkote,Nutuhalli,Pomara,Chuchnhpura,Chuvenopura,Rohakukere,Yapura,Chesaj,Yipura,Gakote,Lodvara,Sisukote,Tektucha,Xelmtunuryo,Vutbuhekere,Yavibela,Hilagiri,Xelpigu,Qodakibda,Negiri,Meyitenadu,Ryntopa,Yegiri,Vyjekote,Chodukibela,Nadalaggiri,Zamovuk,Behpvgevara,Zahechod,Kejubolvara,Mudchorkere,Mahalli,Junmiykote,Gavnjanvara,Chovglagiri,Kogiri,Yuhkjehalli,Chukvebvara,Nodihalli,Boyehalli,Zagasuvutu,Yoyangiri,Qorepura,Chibogenadu,Jumpvjabela,Bembdehalli,Yogiri,Gihbdmpkote,Tujohukote,Sopura,Vuspete,Lamara,Ropura,Huvnrligiri,Zabussaye,Dulchkonadu,Dutsitanadu,Vagekote,Nimara,Bayukere,Nemara,Huvivara,Solpura,Hapuhalli,Gukote,Bememara,Hunadu,Chimako,Robepovara,Qotapuga,Dipkddvkote,Japumara,Nuchabela,Monohalli,Huppchukere,Dosulomara,Qokumara,Rohapete,Murohudbela,Tibela,Pakusatu,Vybovju,Xeljehi,Lipyosupura,Sejtukote,Dibela,Vygatu,Dipura,Vyralugire,Jipete,Gemanikote,Chupura,Sehalli,Vychata,Kohalli,Guljesomara,Legachibela,Yadipura,Kejokimara,Korulduyoy,Sokote,Posodinadu,Zavatagi,Gekere,Gahgumara,Halunadu"
      },
      {
        name: "Quechua",
        i: 27,
        min: 6,
        max: 12,
        d: "l",
        m: 0,
        b: "Lipiyemi,Xelmumarca,Yisipampa,Kosilukuna,Mitotewasi,Zakiho,Wuposuyu,Yumowasi,Neqikoqurqu,Vywourqu,Xelchi,Yanetwowasi,Torkunupampa,Zahokpawa,Chanqara,Churuna,Kaqopemarca,Meleqsuyu,Penpampa,Yirkuna,Lakarutamayu,Motsuyu,Chehataqsuyu,Chuschhumayu,Nequwoqruna,Puchumarca,Yeytemimarca,Kikuna,Kunemarca,Mukpakehsuyu,Xelsiq,Ripemayu,Metambo,Xelhopa,Nachororu,Popampa,Tapnchamkuna,Noqmarca,Kopkolamarca,Nochnikmarca,Chewtambo,Mimayu,Chachchamayu,Nimarca,Rarampampa,Yiheurqu,Xelsstchwcha,Teymiholkuna,Qonpanita,Supampa,Yomopampa,Qochoq,Nulesuyu,Rynkumaya,Vylimelo,Sohisuyu,Rynmoha,Nayhechowasi,Qampnlepampa,Yilumarca,Yonekisurqu,Hichaphana,Rynlahseni,Tahuyotambo,Xelmum,Vywimayu,Rynmey,Nasqara,Letolut,Qoluch,Vylipmayu,Zappsiqchilo,Yuttambo,Tewnasuyu,Yoqrmsktambo,Hansuyu,Rynmowwiku,Perukuna,Chopomakuna,Nolepampa,Chatotu,Kuqeseurqu,Komarca,Tipampa,Nateurqu,Qeruna,Hiyesuyu,Qurolpampa,Wocharotmayu,Mukuna,Zachihe,Nopulpakuna,Zamipochoqu,Qochihoqe,Xelsesetu,Newasi,Yeychuwasi,Pohapitambo,Weyqara,Rischkuqurqu,Nimmitambo,Tupesimayu,Komayu,Qorinoch,Wotapamarca,Xellecha,Rynlama,Xelparkipi,Watambo,Zasoraqi,Wuqelasuyu,Tokakuna,Mantrrqiruna,Qikonepurqu,Somnmulmarca,Numayu,Qenpllpmarca,Yahopampa,Vytamarca,Panqlkirqara,Mikuna,Vyturequchu,Rynyeyoqmeku,Tokuna,Churawasi,Qoweqara,Yichchqpampa,Yenelursuyu,Zahusuyu,Rynmenwahu,Siqoqara,Kelupukuna,Qitambo,Hequqisuyu,Rasuyu,Tomwasi,Vymocho,Peqokuna,Tohhprnaqara,Tupeyusuyu,Chichenawasi,Yuqara,Kewiteme,Yerkuna,Hakeqara,Qilqara,Xelkano,Vyqihche,Sosuyu,Hoyiqara,Xelmuy,Xelroka,Resitpamayu,Nisukuna,Wechqara,Mewilwasi,Nehuhnotambo,Tapomiyeruna,Chanmat,Vychakrar,Pulalewasi,Termoqara,Meqisuyu,Choqurqu,Wihruna,Rynwemu,Vypemayu,Hihpchpiurqu,Zamitambo,Siyimarca,Nawochapampa,Kiheqsekuna,Ryntewasi,Vychoschi,Qoqara,Notikuna,Koqiropruna,Kenamarca,Qilamurqu,Tawlnesiruna,Ryntiramom,Ratawasi,Xelyawuru,Qoruna,Qochunu,Sukuna,Rawusuruna,Tulmyhaqwasi,Xelsiyya,Seqara,Tiqlinaqara,Rynlechuwu,Vychosiyiwok,Wachopoqara,Qolowasi,Nekamarca,Yarepampa,Charnirimayu,Sapulisuyu,Chamwachurqu,Luchasuyu"
      },
      {
        name: "Swahili",
        i: 28,
        min: 4,
        max: 9,
        d: "",
        m: 0,
        b: "Ziwpwani,Rynhkgfoy,Zazacheke,Fibekito,Chubchdra,Futanga,Zahfdtnga,Tazuzuri,Gitekito,Rynjif,Zumchkazi,Mudhelima,Subari,Likzpwani,Rynhale,Gometkito,Xelpen,Rynche,Dafukito,Wakazi,Tekazi,Kadara,Zamajane,Hachidara,Vyso,Fabilima,Xelgochus,Pikazi,Wonbazuri,Jatidara,Rynyi,Niynpchzr,Budmji,Ramukazi,Jichzztng,Chazibari,Zazolima,Zayanru,Xelmrwchc,Xelduli,Kakito,Pokito,Mozuwi,Fujutanga,Latazuri,Makchhfsn,Termppwni,Joksokazi,Kazgyumji,Yegoybari,Kirimji,Qoka,Hidwpwani,Sukazi,Zotizuri,Widbgnkzi,Felibari,Zagahiwu,Kachzzuri,Pibhumji,Feksana,Pofnltnga,Tingmztng,Wifwrpwni,Fizomji,Rapwani,Zechsujun,Qofu,Yupilima,Jolima,Hachabari,Rynluka,Gimchtnga,Kajkito,Zasana,Yasilima,Xeldoch,Kunsesana,Donitdara,Tomkazi,Tumapwani,Mudidara,Vydifa,Wakito,Kupztsana,Leknadara,Gudara,Wechpkazi,Bisana,Xelwo,Tufidun,Vyfu,Noyo,Gapwani,Musana,Wipabkito,Lilchbari,Vyhuka,Haypwani,Waszpwani,Rynganiw,Kutisana,Jochadara,Chizwemji,Jujowzu,Rynbari,Zatdodara,Tekdara,Gitodomji,Rudwlpwni,Zahgwesfu,Qosiyizu,Rafabari,Zafijpade,Suyrnpszt,Lasife,Moymizuri,Vycha,Qohntahhi,Tojdara,Filupmji,Binurkito,Qohichi,Dajodara,Qorwukehe,Yozfezuri,Cheppwani,Gobpwani,Gamatanga,Waydara,Ditdobari,Namji,Hizemji,Chakito,Lagupwani,Gofnwdara,Xelguf,Wikchsbbr,Yuktlzrmj,Jazuri,Fujba,Jetusana,Charmsana,Pudara,Zachchsza,Chunhflma,Hojdgchkz,Fontanga,Vyju,Wufgjgzri,Dizolsana,Hohpntnga,Jalima,Jochklima,Jimmtimji,Gubulima,Lotppwani,Nodu,Xelruhi,Fukemji,Hifgwtnga,Lessbspwn,Rulima,Woyudiku,Tajrmtnga,Zawipe,Bukazi,Buzbpwani,Fudara,Yomsskito,Posekazi,Jajjjlima,Xelyeha,Vydifwulo,Dabari,Hasana,Rawemji,Xelchsgse,Rynfukeso,Hitjpwani,Rekito,Feflpwani,Vyfukefa,Yamyinmji,Qogugfo,Fahdara,Xelngesun,Futzuri,Dochudara,Rumji,Sikekazi,Wofolkazi,Kedara,Patgmwzkt,Zimpktnga,Siribari,Rynfegihu,Rynbkodez,Nowut,Gebjtanga,Qopimtija,Farchgzgs,Qozip,Gibrtzuri"
      },
      {
        name: "Vietnamese",
        i: 29,
        min: 3,
        max: 12,
        d: "",
        m: 1,
        b: "Mokuloviet,Xeghoa,Kiquolinh,Bunphonam,Rynxonovo,Naxobinh,Kinthanh,Trinphxelong,Ligbominh,Hehnabinh,Dutelinh,Gebinh,Gochutrominh,Neblahoa,Galkihkihoa,Vygacotro,Caminh,Triminh,Kelinh,Xulogvahoa,Bephivolinh,Mumimolinh,Nociquuviet,Lecphohoa,Phoson,Hoxitoson,Xelniquog,Vibinh,Vysi,Canqlaphlong,Ryngu,Zagunso,Tabumulong,Quodolong,Gibinh,Sebtrilong,Midevutroson,Lucigoviet,Nahuvucbinh,Talong,Xelquak,Rynphu,Qoxecadu,Phononguhoa,Cutronson,Tubimic,Qophvvaquubi,Quevomedunam,Phevitadong,Nitelong,Xaquexohoa,Dudson,Gonxi,Quadtrabinh,Soletimlinh,Tatasdahoa,Tranam,Bubixa,Quabinh,Dutrutro,Pheldong,Dilnam,Phimtrxadong,Dahonam,Ryndihu,Subtrivominh,Kilinh,Rynhecuhovo,Netrvilulong,Seguglong,Dolhebinh,Selismubinh,Nibquiqueson,Quehoa,Cithanh,Sulong,Suminh,Gigphtrkdong,Gaduhison,Valong,Trudece,Buxedong,Lephake,Phuge,Bimelong,Culdogphuson,Hogehoa,Xelqua,Mitredong,Gotrhohkonam,Quutenasminh,Dothanh,Telludong,Teminh,Xoneboviet,Vulinh,Helinh,Rynsaxi,Midphqendong,Zavavvanxa,Cuminh,Higamsoson,Phaki,Kokason,Vyvxaphetrti,Zacis,Phehoa,Rynhila,Qoktrnabceva,Triphmoseson,Quadong,Tisuson,Lothanh,Sogahoa,Xelgaquubke,Quubsmuthanh,Livtkaboviet,Mimxetrviet,Phigdong,Qosa,Kison,Vihuhoa,Trexelinh,Qohicohi,Trothanh,Lebelihminh,Duxtrtrndong,Mamugenam,Nololhoa,Xesocathanh,Vahoge,Hithanh,Gomuvoxadong,Hotrophubinh,Voquaset,Sinam,Tretlo,Traqunam,Salong,Moxphphulong,Vophuson,Xunam,Detrihoa,Gephunithanh,Trudong,Sanam,Xalinh,Phoguvoxson,Mablong,Vytridab,Kiminh,Modong,Phetrxetinam,Phaqucisoson,Casdilong,Ladugihoa,Tuhnaghoa,Vuson,Cexsuquinam,Zaxo,Bohoa,Phumqikilong,Katuhoa,Zabaxihimeb,Coson,Xelbegxamitr,Cuxedidong,Xuhalechoa,Bothanh,Nuquxedong,Quelamsi,Caxadobinh,Nequnam,Troshaglong,Quuxuce,Xithanh,Tocadolong,Quudohoa,Zavokoku,Quenilson,Lubinh,Gubinh,Qotimisoge,Lohumlinh,Vylebi,Doson,Temeviet,Debinh,Gubhoa,Gaxminh,Desulabinh,Phetokacdong,Candong,Tequananam,Licevetrminh,Kithanh,Phadong,Troson,Tixsemphuhoa,Vidlqueldong"
      },
      {
        name: "Cantonese",
        i: 30,
        min: 5,
        max: 11,
        d: "",
        m: 0,
        b: "Tepotak,Supogotak,Chekei,Fumhilam,Sasiwollung,Maselam,Tedfchishan,Chukazukei,Chomun,Luchuyo,Vyluzguya,Faglung,Vykishan,Zapop,Qolasilu,Dutsuki,Nokei,Qobizoti,Chezfelsing,Yeyihshan,Foluchilpo,Zihismun,Rynzesuchya,Nowokei,Nemdomun,Xelsesuy,Dedlyazulam,Xeldik,Linolulung,Wopomun,Bachpmzshan,Chatchmmlng,Gahadun,Wisagdadlam,Kapalulung,Godipo,Demun,Nayuwuhoi,Ninzihoi,Luhoi,Qofohe,Nihgene,Bopowan,Likchgoshan,Keheshan,Tosing,Qoyemun,Geposing,Vylane,Delchutak,Zahot,Zafunu,Tatutelche,Qowelam,Watiwan,Dekei,Gopachokei,Gakofiypo,Rynnucho,Mobpyapshan,Dezabmun,Pewugsosing,Wilpo,Tabma,Dochnnfalam,Limike,Sigtak,Yagishan,Hiphoi,Hibsizalam,Zafafmoge,Saykei,Vyfeze,Wizis,Leposing,Gimipo,Qokudati,Tadyuwlatak,Fopohoi,Domzopewtak,Bawbomulung,Chufadwan,Zuldewtatak,Qoginzisga,Ketak,Yumazetpo,Xelyi,Chiseshan,Dotachohoi,Vyfehoi,Xellobu,Mesawu,Bipehchomun,Suhola,Mazapektak,Yozamun,Selam,Wemafsing,Senmetodi,Qozotu,Zahichfeku,Momun,Bokei,Fowan,Senzinahmun,Chukoyalam,Madahkesing,Zashan,Chusgushan,Chafukasing,Misayso,Biyowshan,Duzewiwsing,Podifusing,Vykalmomahu,Wugkei,Maziszekei,Lelefihsing,Fepayatak,Chechgfklng,Nazkpnasing,Duzumbugwan,Sowowishan,Nashan,Qoyochud,Zayahshan,Solam,Nibapilmun,Mesmspashan,Fitofukei,Chobchilam,Pobisbahoi,Dulotak,Vyhulochoch,Nahutipo,Fapgpweshan,Rynchchotlo,Hichazusing,Helung,Wumun,Kowakeshan,Zasemun,Chadamwopo,Kugatabipo,Xelzinihpe,Tapmun,Rynzzchimge,Vywohicha,Tayimun,Rynwewi,Botak,Suseshan,Pawan,Fomkuhoi,Mumettak,Gusfimohpo,Dochiliwan,Lazositshan,Xelme,Qobulam,Nahuhfasing,Lolatayshan,Yekolam,Zofwan,Seshan,Debfokei,Walchoyepo,Tupugitak,Zugmezeklam,Xello,Sudmun,Lulung,Numoglam,Sosing,Yoshan,Vydamat,Kosing,Mulam,Zewupo,Rynzudufu,Chuhez,Lohoi,Mapmiweshan,Gowilung,Rynnad,Yududukei,Tispashan,Mamun,Lohopo,Napgol,Metak,Kinigkei,Zagnomun,Pokei,Zowan,Duwfgnilung,Rynbchwlhug,Rynpe,Lahetak,Rynsakidi,Nutdseflung,Tehoi,Mudodemun,Zobolahoi,Bizpletatak,Nubichalung,Vyselung,Putite,Xelpeno,Zayiti,Zahilung,Finufkei,Mimun,Hahoshan,Bekipo,Nuksylelung"
      },
      {
        name: "Mongolian",
        i: 31,
        min: 5,
        max: 12,
        d: "aou",
        m: 0.3,
        b: "Vyhichu,Nuuatal,Chunaran,Uinaran,Neginikhan,Uuchsmzerden,Demakzoerden,Hobdagol,Begemgol,Gisukhur,Qohozobiye,Tudchamateng,Yezuduerden,Chusuu,Huyeteng,Tibahuntal,Tagahutal,Yosuu,Mabalg,Sital,Xelnihiuat,Yacheso,Xelzorahi,Qomisuu,Vychibuuorho,Dokuerden,Mikadekhur,Madnakhan,Zamukhur,Chasuu,Bumor,Yihanemor,Tomuhekhur,Hodmemzomor,Rachchihogol,Gochsuu,Xelga,Zakebalg,Zarumbi,Mabmima,Tunaran,Dagenkhur,Buhrdineteng,Nierden,Xelchegyasna,Mubalg,Taerden,Mirikukhan,Zaham,Yotal,Terdeyoerden,Timagsuu,Renukhur,Neddebateng,Vyreerden,Zachamkihech,Kuteng,Tameyikhur,Tarutekhan,Zeucheyo,Rutteng,Qomouekyeto,Hudubalg,Sotal,Vytara,Sattal,Gorhikhur,Subihokhur,Husumiteng,Zesibekhur,Nebuyherusuu,Nomenotal,Chetal,Chermor,Higedatal,Kiuagol,Zimor,Dobyokhur,Zagakubalg,Butamor,Bodizibalg,Nuhuokhur,Baruredmor,Zuzomor,Uodeyetmor,Bustocherden,Uoygol,Dugbalg,Suteng,Gisuu,Zayokhan,Tiuigok,Kohemor,Zukhan,Xeluenihu,Xeltuma,Hamor,Hudogol,Zagos,Zehadohimor,Kubsabgeztal,Uudosuu,Kotisuu,Zachadige,Kakugkhur,Zerikhan,Kosaerden,Subalg,Sigoydizbalg,Vyueya,Gunchkuerden,Basakkhur,Vychokrig,Qohuzi,Merrtachumor,Gouoymor,Koyudisuu,Nobubeerden,Zaboyu,Yochegierden,Yukinomor,Nasdazonaran,Dimuhuyabalg,Tigol,Koziugamor,Zadizunu,Nurzaztegol,Rebalg,Mochteng,Nadedikmor,Rynchonuh,Duzunaran,Rynuichuch,Betogol,Kemotaztal,Rabierden,Chobalg,Chinyobalg,Saschimetal,Nukurusuu,Rynasozhucha,Masyaybalg,Uauibalg,Gierden,Rigouidmor,Dasakhur,Yomor,Xelnumozketu,Rouodo,Uekunukhur,Matomor,Diteng,Hegital,Hubosisahgol,Uamamotal,Sanaran,Vyzisuu,Bateerden,Sumor,Gizukhan,Vybenzozgu,Tuhhototbalg,Qonchchnuyez,Yonaran,Uoyugol,Souateng,Dosibobbu,Gogol,Kizunuteng,Uichiteng,Duhome,Ruketital,Teusuu,Vymunaran,Qoresi,Sikhur,Ryndoyta,Menaran,Uanrosdakhur,Qomenaran,Yenaran,Mauegdatal,Chayudokosuu,Uahyituhteng,Titeng,Rynnoz,Nachngoerden,Nemor,Chogisuu,Reyteng,Tenotezkhan,Chikonaran,Zanaran,Minnaran,Qosimor,Vyyoche,Bakabnikhan,Qoyirihre,Vytado,Cheuo"
      },
      // fantasy bases by Dopu:
      {
        name: "Human Generic",
        i: 32,
        min: 6,
        max: 11,
        d: "peolst",
        m: 0,
        b: "Vulahold,Xelgihabot,Fakorewatch,Bromtsohold,Lulowatch,Sahaven,Zakirmu,Wulrboreach,Sohumoor,Tiluthold,Brorustone,Selzustone,Rynfarest,Cochabr,Cecrest,Ryncuvode,Cutnbbrfall,Briport,Nofall,Togate,Bribfbrhven,Kekimatrest,Xelwovezo,Vybrobrhuzi,Kitureach,Wangostone,Babrcwhaven,Vybemoor,Zawuvowac,Dodegoport,Malinohaven,Hofall,Bubrestone,Cekozport,Baglbrmhven,Qocodport,Zafostone,Mazhumoor,Zamahwatch,Rovungate,Qowefall,Dasgate,Qovurrest,Fodufall,Zustone,Ribrneport,Xelmibo,Brebrnbrrch,Rynbdtbltuv,Wengavurest,Roduwetgew,Costone,Vygemori,Deldcoreach,Xelftdodudu,Qobuwport,Noriport,Bezovumoor,Sutmanerest,Bakthnreach,Brabcuwatch,Zabrkzwatch,Xelwili,Vysubo,Vawozafo,Xeldestone,Ralezahold,Camoor,Lodfall,Gisigate,Cofall,Zaport,Rynlomoor,Mukbrceport,Xelwet,Rynzeda,Zaruzhubre,Mifustone,Hihold,Kobrefall,Vybrireach,Brihbrreach,Ciwatch,Cacciwatch,Ledoga,Vovesoreach,Tadhgzdgate,Lonntkhaven,Nedhbrrport,Tazgitafall,Qozulifi,Revuchold,Bradfistone,Gibutigate,Cinadhold,Qomuheta,Wiwegate,Hizrest,Defiwatch,Huvgmireach,Vymakhaven,Fireach,Vufinuwatch,Xelkafolom,Qofostone,Devzdakrest,Wifufall,Xelglebrisi,Giburumoor,Sasehurest,Zehaven,Babrest,Zacureach,Sefuhold,Vysuna,Kiwhold,Rukshvigate,Xelhumoor,Qobrozha,Risoregate,Warest,Brasomoor,Vygivuluh,Nuzobiwatch,Browbrddhve,Hasehaven,Divorest,Rynborest,Hedkahaven,Wevafall,Vyzeport,Wuzustone,Zazoce,Rictvbrwtch,Kihaven,Lotomoor,Rebrikerest,Vungate,Dagustone,Larewuhaven,Tiranfall,Docbrrstone,Simcutfall,Robehaven,Rynbufbro,Kuluhahold,Qohizeri,Cikbrikhold,Nogotwatch,Rizbabram,Ryncure,Viport,Rikavub,Zerilerest,Ribistone,Rilezegate,Qogige,Xelgot,Rynluca,Xelkufafab,Zockeviport,Wefikrest,Cebvohaven,Bratntkrach,Mevgate,Hihgate,Rynkuku,Zuflustone,Brubrgmvnrc,Tefnnowatch,Vycotasheme,Bruddsefall,Kudwsmumoor,Xelvehold,Rynvahaven,Defdefall,Wehimvurest,Zawetostone,Mawidfall,Dubrowigate,Werest,Havimoor,Towowatch,Kefbruport,Vysureach,Torest,Vygorest,Gizsbestone,Tuhzugfall,Germrastone,Hinbrsihold,Nefereach,Zistone,Cihold,Renostone,Zarekwute,Rynviwomce,Hawport,Molate,Tahogate,Qozozenale,Zanefud,Rynbebo,Zasuport,Fiwratagate,Brurofafall,Zomoor,Bokgewurest,Vozorurest,Megate,Zotiwatch"
      },
      {
        name: "Elven",
        i: 33,
        min: 6,
        max: 12,
        d: "lenmsrg",
        m: 0,
        b: "Rynthu,Simthuthil,Zizuthavael,Yothil,Synesysyl,Yimirriel,Vyyimelona,Razmonezowen,Zysylmir,Virayymir,Thanomulze,Lymanor,Melyuzi,Muvunsysael,Zollerliriel,Sasevyr,Thaziththil,Vymothumysyl,Thoromlith,Yulwen,Rovumalith,Zamivyr,Theleveneth,Zosaanor,Yuvnathyneth,Yothytheanor,Thomir,Vysyl,Rynzaro,Syvrthazuvyr,Lorlith,Mylosyl,Ryzysanor,Thaael,Zusalith,Linilith,Xelsimir,Sovyrwen,Yesyllith,Luloael,Thevyr,Mezinisyl,Mayeyosyl,Thymnymir,Zylyael,Mumlarevneth,Zisvuriel,Leanor,Qosylith,Rymnozvelith,Yiriel,Lalayvusanor,Savymael,Menuseyael,Lomriel,Rynyyorneth,Newenthil,Sarimo,Layyroyneth,Qolyyril,Voriel,Yezrzvuthael,Yenewen,Rermthlathil,Suanor,Rynrolur,Xelvaz,Thuvyr,Xelrymir,Thymvyr,Qomayeluvi,Yyvyyovyr,Muyuriel,Rynneyossuz,Rynzosesy,Yosithvyr,Vyzewen,Xelthi,Nyrizyael,Qonuthe,Qonasazeve,Zizanor,Zathirivor,Maslizawen,Zizinyrlith,Vesemir,Rulwen,Vevuwen,Nimimuthywen,Mineth,Vizysyl,Nuthythriel,Luliwen,Sisevimir,Yethariel,Thilezovsyl,Zivresyl,Zamusi,Mizurvothil,Qorylith,Mothesalmir,Yywenlith,Xelvirili,Nythvoriel,Zathalen,Nothoraythil,Symwen,Rynsiyuvy,Zumthuanor,Sisosyl,Xelthusas,Ramazu,Mymuyvivyr,Qorythil,Veronnaneth,Niliwen,Rynyilith,Yyrlymethil,Qoluyili,Manlovyr,Thyrsulith,Vyvanuthzo,Vythilyles,Thunaza,Thothil,Sozelith,Lemirmalith,Yuyyvzythi,Lawenriel,Solith,Zazythil,Moyisyl,Zuloael,Vayezlo,Xelvaly,Notheanor,Vyvyrse,Zanesyl,Yunnivavuael,Ryzyivyiriel,Zynmyriel,Xellythi,Xelmozu,Lewenanor,Rynlenayy,Vyvoyomir,Qothoyu,Lenilothosyl,Zuyuvuro,Morvuyyruvyr,Muyulomir,Xelruriel,Nosynmavyr,Yyvevomi,Lunmusasyl,Myythmosymir,Zymmolnuwen,Ratheyymsel,Reyyvsyl,Thymulwen,Yesanor,Qonoloyyo,Xelyelemo,Thynlith,Yeaelanor,Lyluthilriel,Ryvoneth,Thizolesiwen,Namoyyrurvyr,Zusazaneth,Qomyyey,Ruriel,Zuyuththusyl,Lelazmaael,Syziael,Menyruyrimir,Zayulamry,Myneth,Munmyruael,Luththoael,Yewenwen,Lunymyael,Nisvruyalith,Niyethmevyr,Vezyvyr,Thyneth,Vyruye,Sozlthrnesyl,Ryzazaz,Qothusonav,Momnathysyl,Rinimviwen,Selvylith,Thyanor,Nyanor,Zivyrsyl,Savyrneth,Lulewen,Qonothuzli,Qozoramulno,Luzizorlith,Xelmanath,Yanvvthrneth,Zathiyo,Vonuthitha,Nosinuyriel,Lovyr,Yymmysyl,Masoszavyr,Moneth,Munythzeael,Zalyvymys,Salerenethil,Nyysuthesyl,Thymumir,Sorsysolymir"
      },
      {
        name: "Dark Elven",
        i: 34,
        min: 6,
        max: 14,
        d: "nrslamg",
        m: 0.2,
        b: "Xethar,Thysyl,Zudlerorkimorn,Zaruzi,Vesyl,Zodrimorn,Sikesrarevyr,Rekudrin,Nudyrismaxil,Zixxil,Kozorkhal,Xelkudrulydid,Zakali,Lyrmorn,Sesduvyr,Rynmirethi,Sedrkurunthar,Kynkudrin,Zosyldrin,Moxedaxil,Vivyrdrin,Lithivazeneth,Nokkhal,Droralomzor,Lexananeth,Thizuvamorn,Kurusyl,Kisodrvyr,Lylvoridravyr,Rizeth,Nonuskhal,Disekzor,Kukekxylu,Vysamedexnox,Nylalydxil,Vazsykzevon,Larodradrin,Sexkydkhal,Xelderulna,Thazunakodrin,Sethar,Xellam,Dyluvuzeth,Rythyzor,Mermenezor,Xadrovo,Rovyrvyr,Xelkudrodi,Mulivyr,Darykomi,Lyrdrin,Vyrodrin,Xudrseneth,Rynmothika,Zadrev,Ryzduthxil,Qoxikhal,Zazadadre,Radrin,Qonasdro,Dyzorsyl,Zurozeth,Thythnmkvkneth,Munedramorn,Qomeron,Zamymyni,Sesylzeth,Xelmodrin,Nevzor,Qothathar,Xelkokzozadre,Drysyl,Druduraxil,Xellokakisyd,Dadesamorn,Qodozin,Rarmorn,Qosuxeth,Rynmykyksax,Mathyneth,Sakolilthar,Zyxilthar,Zadekhal,Xelryvy,Zuxilmorn,Kurdrin,Nerilvyr,Xyvuthadrin,Dekadrydrin,Kothmorn,Zanizeth,Sokhal,Livynozeth,Thuthiksevyr,Xydzykthi,Vydruszor,Rekosdekhal,Sunedrvixil,Sozzexethnavyr,Valexuzithar,Dexazeth,Dymumorn,Ladroryzizeth,Vydaxil,Xeldidrin,Vusuthar,Sonevudrin,Ryntheko,Movimneth,Lolusdrekzor,Xydrin,Thedryviluxvyr,Kymykuxil,Zavylulekdedr,Thadrvudovyr,Lomodryxekhal,Mivyrzeth,Remethuxil,Drothuxil,Zaroneth,Syvorinon,Qozeri,Zasokhal,Kyxozuxkyvyr,Qokothu,Thothyxil,Selurrimorn,Saxydrin,Nudrsixxil,Vedekdruvzeth,Xikomysyl,Donythudrin,Rylldrndrvzeth,Xelsarrazvy,Thinozor,Xelzithar,Qodyxneth,Zathulkidryd,Thumosynomorn,Kythusesyxil,Zathyxi,Thezynudrin,Zalrythunuvyr,Myrmedrasyl,Thuzythzivyr,Thodsyl,Xelduk,Lisaxkezeth,Zelotho,Drervaksesyl,Xathmorn,Dyzekhal,Thyxokkensyl,Voluthar,Kodonkilneth,Dokzeth,Xidrin,Vyniznirithar,Zexluxyvyr,Vonydrin,Madrvedzurvyr,Thivnisyl,Vysusa,Sathsimuthar,Xukhal,Drethuxil,Nysyzor,Rimyneth,Lisyldrin,Kodxdrumurmorn,Kothizor,Thavdravvisxil,Xelmydruno,Nykhal,Rathmusyl,Xinilsuthar,Vythezor,Ludthosedrin,Qonamorn,Xineth,Symumorn,Xyxaleneth,Drexevxil,Zaluvolkodal,Lalekhal,Drikhal,Xelkezeth,Vykasyl,Dyzmokhal,Kazusdethar,Lyxxizeth,Muzorzeth,Dyvethimuthar,Thudamorn,Sovmulneth,Thyzkunnothar,Lelodrin,Minnumorn,Thozmassyl,Nudryxlodrin"
      },
      {
        name: "Dwarven",
        i: 35,
        min: 4,
        max: 11,
        d: "dk",
        m: 0,
        b: "Skogredelv,Rynkid,Mivokorhold,Gedelv,Grimitagrim,Vubogrund,Skobar,Kukrrskokar,Ravkadogi,Gremkar,Nidskgrgrnd,Rukskugrund,Qovatekrotu,Zukaz,Tornkrtfrge,Divkaz,Vobdun,Mikstone,Zekaz,Rogskuforge,Vugrndforge,Tohold,Nostone,Gratokar,Negrobar,Grozuradun,Zavekinidun,Rynke,Rynkimi,Tudun,Vykrtburusk,Skinatudelv,Gaforge,Begrim,Skugidvobar,Nukokikar,Veskoga,Vestone,Krumedelv,Vyti,Zuvitogrim,Vikaz,Dadoforge,Zamodi,Vozenobar,Rakforge,Kokbztskkaz,Viru,Grazvaforge,Dustone,Skibaben,Votkaz,Skutzkrzskf,Tuberogrim,Rynnkigrisk,Viforge,Qovotigi,Mihold,Grigrehold,Zudelv,Rukrvogrund,Bigrim,Kigrtibar,Xelrumtogev,Rumirukaz,Gredun,Skekgra,Zudikragrim,Nokdogrdun,Qodukrgro,Zagumbibar,Tastone,Skikskskrmk,Vibokrukaz,Tiskubforge,Skonkrbbgri,Vikktmdabar,Didun,Kruggrngrnd,Dakevmadelv,Degrund,Gigrim,Gebezigkar,Zavugi,Grumgskstne,Xelmamam,Kruskahold,Midtotgrund,Krezukar,Nunrzegrund,Dotngrgrund,Krekstone,Skakrrnfrge,Skoromokar,Xelkrizobo,Nuzztundelv,Keforge,Vezskktstne,Zikrkrgrund,Rynvere,Navobudun,Giva,Zorukar,Zonegavi,Kramnedun,Vytaski,Ditvadugrim,Vakaz,Gukaz,Vytikrurka,Tuskudelv,Tahold,Gruntehold,Viku,Xelbumama,Rogradgrund,Qonekredask,Gretggrstne,Zaduti,Dotarbavokr,Kristone,Rirsknskdlv,Kraforge,Gronikrodun,Vymomu,Girgrkrmfrg,Nekrruforge,Rero,Zizokrukar,Grozive,Ramodelv,Krudebar,Grahold,Zegegrim,Gukeforge,Zatoskot,Bindamdelv,Vanzaskukar,Begrund,Rakrgkrgdlv,Mutugribar,Vykrukrane,Vebekar,Gabar,Ruskgridelv,Rikreze,Krogradelv,Vugruskvo,Krivrabo,Nevzustone,Gustone,Krugrim,Kranedbar,Vegrim,Mehold,Rynkranone,Zavugrogr,Gegrkrozokr,Rynzoskar,Zabugrdelv,Bigri,Nozigrund,Dagrim,Ryntonu,Gezudelv,Merugrund,Rizbiskor,Gegrund,Moforge,Gekogrstone,Grabigrim,Zanskunakev,Xelninkra,Radurevabar,Dokar,Nibiz,Grevibgrund,Zedelv,Vykredu,Qoskeskizni,Zagrirogu,Tozimadbar,Boskakar,Grorkzstone"
      },
      {
        name: "Goblin",
        i: 36,
        min: 4,
        max: 9,
        d: "eag",
        m: 0,
        b: "Bemuk,Kragash,Skarkskrg,Bamznsnak,Krigzog,Vysezazza,Krontik,Minsnak,Zosgrntik,Riknrgrot,Sisksetik,Komnumuk,Nibzug,Vytimamne,Tuskinob,Bakrmuk,Pebomuk,Puskbrtik,Minzzkrzu,Zaka,Zizug,Rarzug,Skomuk,Tamuk,Monnob,Sokrsnak,Gusorizog,Grogkrzog,Zikamezog,Potik,Grimmuk,Namo,Memezug,Krunob,Nagtbizug,Kotgash,Qosap,Gaso,Renob,Sugrot,Nikrptgsn,Sekresnak,Tekergash,Sukrgash,Sunkgrmuk,Xelmetab,Zakibekre,Mabgramuk,Rotsnsnak,Sartik,Zugrot,Skotik,Mopnob,Tibmuk,Botunu,Kakkrotik,Zikpbsnak,Mepasnak,Zobog,Zumuk,Zazepo,Xelkakana,Ninkrgash,Vybube,Nutanob,Supi,Vykraska,Grozog,Goskrtzug,Pekrskgmu,Gukregru,Skakrrgno,Xelse,Ressskkgs,Skuskrzug,Tosbagash,Gitumatik,Toskkkrib,Skunsknob,Somuk,Skibog,Rekksgash,Zebsogrot,Kemzog,Tonogutik,Tagrasnak,Riski,Kerzigash,Roskkskgr,Bagrot,Rikrib,Mizegrot,Zobzubog,Bizbog,Torsugash,Rumotezug,Zuktgbnob,Kanisezug,Rynnomez,Babskpskz,Topegebog,Qobsknkra,Vyzgrzisk,Migazug,Gripe,Bakrkgash,Nikrtuzog,Sakrib,Tukrsgash"
      },
      {
        name: "Orc",
        i: 37,
        min: 4,
        max: 8,
        d: "gzrcu",
        m: 0,
        b: "Tigrom,Meko,Reghzrng,Dokkrruk,Rigshkds,Krazkgzu,Tikkrgng,Domunar,Boze,Shamkmok,Ragash,Ghukrkrr,Tokrktmo,Mokrag,Nethok,Doruk,Zaghshdi,Vyghodo,Raghkruk,Batkkrag,Ryntzghi,Ghagkrzu,Nimord,Niruk,Nughrzug,Vyte,Krukrdsh,Kithok,Zarugun,Dotshnar,Mekrtmgh,Genogrom,Kumok,Nekshzug,Zakariro,Bodkgash,Moghmord,Zagrom,Krikrkrm,Zegash,Rynnun,Gudkrdgm,Domord,Mighgash,Dudush,Buzug,Shugdush,Tomok,Nugshtho,Kodkrdgs,Krimord,Rynne,Nothok,Rozkggsh,Kertshmr,Kitdinar,Ghobkrrm,Ghiddush,Krodush,Nogrom,Ruruk,Gazbkrru,Bushddsh,Zamgzshe,Vyteddi,Zadida,Gebenzug,Xelkghze,Zunar,Shozug,Tigash,Sharghgm,Mukthok,Shortkrz,Vygonuda,Xelgmura,Nishmgmr,Zuruk,Ghushggr,Kugkkrag,Dishgdsh,Nigrom,Kidmgash,Kridghkr,Ghotkrag,Shukrdam,Ruzekrag,Dimord,Ghanmzug,Bizkrkrz,Gonkgrom,Bishego,Tikizug,Konar,Gozug,Xelmeni,Qoki,Bukakrag,Xelghekr,Mumord,Meghgash,Dadmdush,Budathok,Ghitdkkr,Bibothok,Xelmok,Ryngkrze,Rakrag,Kebkrag,Dazug,Kanghgsh,Bunogrom,Gummdush,Nogthok,Rynshu,Tamord,Shadush,Kretmord,Dekogash,Megmizug,Krunar,Zemkrdna,Gunodush,Nogimok,Bezbunar,Zigumord,Kongeruk,Xelkro,Gigash,Keghdzzu,Qokraku,Kannthok,Qomikazi,Zanbaghu,Bagtumok,Zemuruk,Gabma,Batmizug,Kazug,Bizigrom,Tinu,Vykokba,Krugash,Ketmisha,Ghakbruk,Gumudush,Zutidush,Krurghds,Ghatgrom,Nughuruk,Vyru,Gamord,Krezkrag,Gudush,Ritghmrd,Qoteka,Zanozba,Tubdrzug,Gakshkbk,Shottzru,Meghnbdz,Shutnosh,Tutmord,Ghuthok,Rughngro,Xelziti,Vygi,Nembgrom,Komak,Nugzonar,Rimok,Zughngsh,Goghbzug,Besha,Dogdkkra,Mata,Babdkrth,Doghkrag,Xelgi,Dukrag,Migash,Kanar,Ryngha,Dekrag,Tushtmok,Donrkrag,Detngruk,Shuthok,Tiknbkra,Shonzdmz,Dedbmord,Kunimord,Nagmtnar,Qona,Bogrom,Ghakghmo,Qokrbagi,Shubgash,Rokrag,Qome"
      },
      {
        name: "Giant",
        i: 38,
        min: 5,
        max: 10,
        d: "kdtng",
        m: 0,
        b: "Vivitor,Vyhoterved,Magrim,Zanogrim,Qoteb,Sovebharn,Rynbeni,Vinghavold,Zamovald,Rikivold,Kihhnugrom,Dotometor,Ruvkbeharn,Vakagtor,Nusabtor,Bahavadorn,Vyreko,Giverok,Birerorok,Nobodrok,Hidnnhumur,Qotesbu,Digvald,Dasturok,Mekotor,Qonevosoge,Zatitino,Gevudorn,Ryntoka,Tivald,Tasudorn,Nodorn,Megrom,Suruvald,Bobur,Heboharn,Nadorn,Rynve,Gubur,Gahuruvald,Novevimur,Gadomob,Domasuvald,Rynsurke,Mumovold,Sarirok,Zanosu,Rirok,Nagstovald,Norasekmur,Hugrim,Vovald,Zasadbi,Tidamtor,Tuhbigrok,Rohbghabur,Movold,Qosabu,Vutrbvubur,Vubharn,Dusvold,Gugrim,Domur,Rorok,Regrom,Niretor,Qohetor,Kudkegrom,Hisharn,Rirshigbur,Sormehator,Rynnumu,Gunabih,Rynnuvebtu,Higrim,Ryndebdeke,Tonekavold,Tabur,Rynherdu,Bernbkmvld,Mamdorn,Tokmgadorn,Sugdavbur,Rynboma,Zabinaro,Qosivald,Qonhrihhim,Bunvald,Roharn,Kovald,Nonosvold,Xeltetde,Dudurok,Bigmtdgrom,Mirmotor,Gibur,Vykator,Gudorn,Vodugidorn,Rortrevald,Verevbur,Nivrok,Duharn,Vinevrok,Tihsviharn,Kumodberok,Garok,Butor,Nogrruvald,Gikomiharn,Dimur,Bohitor,Gagrim,Temur,Xeldovbe,Govurok,Dasogtor,Hinino,Qosen,Bavold,Settvkgrom,Kiramur,Nisbhovold,Vytese,Modgbovold,Todorn,Sedorn,Subbirator,Hivugrim,Gukutor,Rynni,Hugoribur,Danator,Gudetudorn,Kemonharn,Setor,Sobetodorn,Tabamovald,Memusitor,Renvold,Vybiv,Dedorn,Tegotu,Sorurmimur,Kusokgrom,Dortarok,Dosgudorn,Qohutu,Nangrom,Devsevurok,Dahedorn,Kuharn,Rasogodorn,Guhrssibur,Bosigrok,Dunhnudorn,Ruharn,Zasogegi,Mungrim,Nehegrom,Vybemokhu,Hubtor,Raguhorok,Rogrom,Gekevald,Vatvold,Rongrom,Viggbigrim,Horvmovold,Visekamur,Ryngame,Roruvald,Roregrim,Tasbur,Rynkah,Bimutor,Rynmut,Nenrok,Simubur,Moribur,Degigrim,Kiknivebur,Higiddotor,Zanita,Darok,Vymusisis,Bonevald,Naktridorn,Kemurharn,Romur,Ryngumi,Tavuvnator,Varorok,Taharn,Gabnhudorn,Vahtor,Mivradvald,Beterok,Vyduvald,Mivold"
      },
      {
        name: "Draconic",
        i: 39,
        min: 6,
        max: 14,
        d: "aliuszrox",
        m: 0,
        b: "Qodrymuvly,Zarukrekran,Ragmadamyr,Vedrvthilyskal,Gagykre,Nethyr,Naxkrorthoskal,Vyzothmudrysal,Gyllukyzixan,Zanexyle,Zaremyr,Qoryvy,Mudrak,Xukrgidrax,Rydrak,Manokesh,Zythdananathyr,Krukudurax,Zesikir,Zimdrikrathyr,Kraldrulivdrak,Sethkramyr,Nokesh,Rynvizorn,Thagdrgokrkesh,Vokvor,Xokyvor,Dyvordrak,Drykaskal,Kuthyr,Krathadrak,Vysevor,Rodrak,Zadyskra,Xelmynyziza,Lugozlavor,Gudrruvyr,Zisxuvyr,Rimuxan,Drixan,Ryngykesh,Kothonykrurax,Ryndryg,Vykrkrumyr,Xelximugge,Gozugavyr,Xellaxan,Thukuvyr,Qoladrorkre,Driluthesli,Qosyzorn,Rydrymizyxan,Noruxikrathyr,Dexanskal,Kruzorn,Vanurax,Kemthilexan,Zakrerax,Kudoxekrxuvyr,Gelydrak,Thadaxi,Sisezvor,Gixanxan,Mikesxyxan,Mithuvskal,Rynthema,Nythyr,Zadryxule,Suraxxan,Nosvigixan,Xeldregguzzage,Losorax,Zeldryskal,Thithakuvor,Gagidynokzorn,Gokezkromazorn,Rethasivezorn,Moxdndkydrkesh,Drimyr,Drodukakaskesh,Vyxmakrgothith,Zathivu,Veneza,Sydrusydxerax,Ryndoxalygo,Zarodrlemyr,Vynilixan,Morxan,Vyxanskal,Vymilimuxrax,Qodrethyr,Kygavor,Kykizorn,Dranozorn,Vydryskal,Qorekesh,Qoxivoxkrydi,Drykrymamyr,Qokerax,Drigykesh,Sikregurax,Qogelom,Thikesh,Daskal,Ryngidrudrthy,Xigagadrorax,Qonyry,Ladanxexan,Rynvokidrodmy,Nenexan,Lurdaskesh,Zanikruzik,Lathyr,Gorumoxan,Drydrukesh,Kravdesithdrak,Kavordrak,Xikmyr,Symyrzorn,Lezedrak,Qogeveni,Lemyrdrak,Drykidrydekesh,Ryzorn,Virkesh,Gumithyr,Likesh,Gagothiskal,Nokthykuvyr,Rethilomevyr,Gexonzorn,Musokesh,Zekrvudovor,Vyragko,Krykrakremyr,Kavezosivyr,Zyrdrakygdrak,Ryndozukrumu,Rivamylxan,Masvyr,Sixanzorn,Vamuthyskal,Zithzolikesh,Ryzykesh,Gazorn,Rynlorede,Vyvyrmyr,Dismyr,Vazyxythyr,Zydolazxan,Zaliznekkry,Ryngenigmosa,Gosyvlytho,Degekizerax,Drudyruvvyr,Sazvexoxan,Modrothyr,Xelsixan,Zolylydrudrak,Kymynrax,Ryxanxan,Thisilmovdrak,Kalrax,Gekimyr,Gikvikrmevor,Xydrlixukarax,Drysodrdrimyr,Nivvyxdrak,Zukruvor,Xyldrak,Lanenadrak,Navordrak,Ramyrmyr,Thivor,Dumdrthalikesh,Kevamyr,Romrevyr,Krazidrrax,Qogidrykru,Nysokdryvor,Suthedekvoskal,Kurmyr,Krethogyzuthyr,Druvuxekzorn,Modurrax,Nuzegokesh,Zamydy,Kythothyr,Ryxsevyr,Dradrlonuthyr,Gukesh,Nodromezorn,Kymgixthyr,Gyvyrzorn,Kridrekuthskal,Kraraxan,Zanuzora,Myveskal,Xozorn,Vevyskal,Vyselskal,Kyxvor,Xelzorn,Nurlothyr,Simyrrax,Vyluxudavthar,Vovyrskal,Xelthigdotho,Vykesh,Larovexan,Zigodrmegzorn,Dythikesh"
      },
      {
        name: "Arachnid",
        i: 40,
        min: 4,
        max: 10,
        d: "erlsk",
        m: 0,
        b: "Tinuzhar,Chomsklsil,Riryr,Zatyny,Syven,Rezchuzhar,Mexysmosil,Xezemarach,Xelzy,Vyzak,Rynsilniza,Mytrkliven,Rynsexsu,Tulathra,Skixiarach,Siszneneth,Nichchthra,Nytrithra,Xelnu,Tumnyxil,Masaarach,Syttmyneth,Qosoruke,Zothra,Zixskanweb,Nyven,Ruzutosil,Qone,Chothchven,Skaskit,Xelso,Skothnmsil,Zicha,Ninzskskit,Meluxil,Kythsil,Qocha,Toskskit,Nezhar,Skysiarach,Rynmchello,Memazaweb,Sychaskit,Tazsskthra,Qocho,Niarach,Kaxexil,Lytenythra,Mukeskit,Skichtthzh,Cheluneth,Kyrytusil,Ryntana,Thamaarach,Keketh,Zyliweb,Thineth,Rynkskaski,Qozicha,Liroarach,Kiza,Sommisyweb,Komketh,Kisksarach,Xelmysu,Sythmtrxil,Vytise,Qozsochket,Vyzozalim,Charoskit,Texnesil,Charilaven,Suven,Meleven,Rynthyko,Xelmasiny,Sytarach,Nasksskzha,Thezekosil,Matsktusil,Ryxalozweb,Tuthuneth,Kuskrzketh,Mochzyneth,Thyxil,Lireweb,Toketh,Xitiriketh,Roluarach,Xaven,Zesixi,Zyrskzzhar,Skyrtrskth,Chosil,Xelkom,Myskozysil,Skelis,Xonyskit,Tizthntkth,Vyneskux,Qosuxa,Mazyny,Xosil,Xelththata,Zisil,Qoxuna,Rynzo,Xelxet,Xelnuzchu,Loxikzoweb,Xelska,Skisil,Kizchskthr,Sothaketh,Nasitweb,Xelmy,Qochu,Munykoneth,Xelxuma,Thukarach,Nyrzhar,Zixil,Seskit,Kallokskit,Kyarach,Xelchzeski,Nylnanzhar,Thamthoven,Chatzuketh,Tornskxzha,Xunlykoxil,Zazsineth,Zuarach,Zatatukux,Chytsil,Xasearach,Liskit,Namskoketh,Zixreketh,Thazzchxil,Lanyxetho,Zithkzxxil,Thoketh,Skarzhar,Tetoarach,Qoskuk,Zuneth,Xusil,Menytaskit,Tezyzathra,Kathzuskit,Nottmarach,Mochskit,Qochy,Loxsklrach,Nonysil,Zaketh,Siskit,Xazhar,Thosnu,Symoru,Ziskit,Sochskythi,Rynsaluny,Lyxchithu,Texozuven,Muthrkaxil,Xelnzlecho,Xelluzith,Xiarach,Skysxesil,Chuskarach,Zanakathra,Syraluxil,Skusko,Mizhar,Zyskit,Rochonsil,Xytxineth,Lumchsthra,Toslkarach,Nutitaneth,Ruskmskven,Kuchkzxkth,Rynchmsare,Xelzerily,Skyven,Zetskit,Chamxil,Qoty,Skythtchsk,Rathra,Zaxasym,Skilxthrrc,Kurithskit,Skethra,Skimetven,Qothi,Sumy,Xitchkeven,Kusil,Noven,Rynnemychu,Rochsoketh,Nuarach,Siskven,Xelxykethe,Kaweb,Nasmzkneth,Michkmuxil,Skoslarach,Laneth,Zamchzxuch,Thuven,Marzhar"
      },
      {
        name: "Serpents",
        i: 41,
        min: 5,
        max: 11,
        d: "slrk",
        m: 0,
        b: "Sishhishthe,Voxnaga,Nizar,Lanhzusmora,Hithshohiss,Rathxy,Rismuvess,Viheluzha,Qomoshymli,Lezsushhiss,Mihiss,Lisilovess,Xelviravu,Tharothil,Vizthil,Narusalvess,Rashnaga,Lihxthovess,Zezar,Qosahiss,Mivess,Hylozar,Myshhxhvnga,Syshizyzha,Rynzylvi,Qozimora,Sherazha,Lynavihiss,Vinmazar,Huthmvshemo,Thanuvonaga,Xivess,Nomora,Hyhexexan,Huxamora,Shunvvxthil,Xellishone,Xelvhmnrith,Xelrave,Rynly,Zamosxa,Shysorsiss,Xetheszar,Xurezha,Misezha,Xelvasuxi,Hirisiss,Hehexlozar,Zazar,Vyzuliho,Thorxonexan,Hyshuhezha,Zonhmammora,Monuzhosath,Hyshhiss,Rerivess,Lethil,Lumora,Ximozumhiss,Hathil,Xenesath,Vyvzha,Shemimora,Shyxan,Hythil,Sethil,Vyninso,Zathil,Xyxmshumora,Zythil,Vuthil,Zaluvu,Nyhahuthil,Rythmxesath,Zoshizha,Shunethmora,Renevess,Rulushzar,Qozazomo,Riraxythil,Xuhiss,Xelvexnivu,Raxalsiss,Nenhxshhiss,Hevess,Vyrezar,Mozothil,Lehorozar,Senamora,Rynza,Vyhuseshna,Henaga,Ryxuzar,Xaxan,Shoxan,Mexylevess,Vamoshthil,Nirasath,Mohinethil,Rimezar,Vuxthhsnaga,Thuvusiss,Qovula,Sushvxehiss,Rusiss,Hushnlyhiss,Thohulihiss,Thyththnaga,Nuxenthil,Synranaga,Thathimora,Thimxnevess,Zavyrinaxe,Sexahyna,Rynvyxusho,Muhahythil,Melxuzevess,Xevess,Vosishoxan,Hahhlvithil,Mizuzha,Thyshamora,Nussiss,Rosath,Xysshursath,Zarehma,Xelvaxeme,Vihynaga,Xomohuxan,Sazha,Huvess,Xehyluthil,Rozinuzha,Shahnsshzmr,Mothil,Shuzemora,Rixan,Nuxan,Nalazimora,Zasohsem,Hyszmlyhiss,Rynshmmshon,Shuvhshrnga,Shuvemsiss,Myzar,Myshus,Zezha,Vyseli,Thiththmvss,Vymisazo,Navesath,Qotha,Qosezha,Vyxareramy,Sezar,Shesemora,Xanyxan,Homrzshsiss,Xisizar,Thixzththil,Shuhiss,Ranaga,Rorsiss,Thovthlnaga,Husiss,Qormynyshre,Ryzthalnish,Vevemisath,Qoruvra,Shyronvess,Zanexaze,Xizemshezar,Hothozoszha,Xelshythxy,Thovess,Roxan,Mythlthsiss,Roxyxovvess,Narixethil,Zushthisiss,Nunshxruzha,Thaxshsthzh,Qoryvess,Shushomora,Sashnllrnga,Xellsemoreh,Qothama,Hishuvezha,Xeltha,Mirzha,Ramshshvhss,Qonithil,Shezha,Xoxovess,Xelshuvev,Lolnuthil,Muraxan,Xysath,Hashoxan,Mashzshmshv"
      },
      // additional by Avengium:
      {
        name: "Levantine",
        i: 42,
        min: 4,
        max: 12,
        d: "ankprs",
        m: 0,
        b: "Kaqezebyam,Lubumeyedor,Saqram,Kaqir,Hanahr,Kitamar,Xelsalzig,Zaqosigesmu,Notamar,Memiqir,Tesyikotamar,Nehhasela,Bonahr,Husela,Kohenuyam,Notzalim,Tamkadesh,Masibuzalim,Zakarutal,Xelqu,Denon,Luzram,Tidor,Haram,Ruyador,Guqasela,Yihuluqsela,Vyrogu,Nidor,Royam,Lusatdor,Lisubotamar,Bugnqanunahr,Sokidiro,Vyliguki,Kotkadmesela,Hulayanahr,Qozblozotram,Yohuqsela,Reram,Hiyokzalim,Kebtetamar,Lisiqir,Bogkadesh,Niyurukadesh,Kire,Kukenahr,Gidzi,Kelizsoznahr,Qoqoray,Xelko,Xelniyeksa,Dohuqzubeth,Gazikadesh,Rynbahomay,Suytuzuyram,Qumsmikadesh,Qoqay,Toyznahubeth,Sunibede,Gerozalim,Zugizalim,Qogemu,Naqir,Xeltyibasyeh,Zasagu,Romeguram,Xeldanutar,Boyezalim,Haqenahr,Qobi,Qolilo,Yosunonahr,Gosognahr,Tarasa,Lizotqiyam,Gusihetamar,Luyireznahr,Zilada,Vyqo,Yogugezalim,Qohe,Yobiysela,Yohetyoguyam,Robzmsmkdesh,Keskgzkadesh,Beram,Laheguknahr,Biydiram,Zayi,Mubssizhoyam,Lalagabiyam,Mitador,Qimeb,Lamluzalim,Tesanahr,Netaqir,Buyoratudor,Rematobqir,Gihyibeth,Hukurdor,Xelsibo,Katamar,Qumothudor,Didor,Soyyesorram,Nihhohoyam,Xelnolomin,Kugeqir,Rereram,Raqodotebeth,Zuzqatho,Vydigizi,Qeryomdor,Zikadesh,Koydesela,Laznittamar,Qokhehtesela,Gimayasela,Lobeth,Manahr,Zuyezindor,Dukitsela,Yiqir,Xelhkhhensom,Suhsela,Lequram,Doleyam,Qigessayam,Qodidasu,Koguzalim,Vyyosbaqur,Konulozroram,Zalozuki,Muyumenahr,Hogemoqir,Kiyam,Qodughim,Nigohayam,Nizkadesh,Deqir,Dubbeth,Sokadesh,Susela,Yuzkihqir,Zamo,Qenizalim,Yumayyam,Qoqe,Qeqaqir,Hulokyunahr,Huryam,Rasekadesh,Taqakadesh,Suzosesela,Runzalim,Xelgamiho,Xelbaldo,Quhasqir,Yiksela,Vyqodozyosa,Rynzaghay,Demerozalim,Mumkadesh,Qoliyhiqi,Nunesela,Bubsana,Balayudor,Motllkrzalim,Nozalim,Boginahr,Mesoybe,Dikzubazalim,Desrzokzalim,Mozkiqir,Ruram,Serikadesh,Meganunahr,Hanzalim,Kodequnodor,Dinahr,Nuklszkadesh,Tuklzqizalim,Qegonozalim,Katobeqyam,Hiqbador,Bokomabunahr,Bezezdador,Hiram,Debeth,Vytutub,Yotagqir,Dokadesh,Hizummelbeth,Reqtnaqesela,Sisonahr,Nulayeram,Nulesela,Xeltmahozlaq,Zaleg,Xellodotlu,Yatamar,Nohbiqbeth,Qoyam"
      }
    ];
  }
}

window.Names = new NamesGenerator();
