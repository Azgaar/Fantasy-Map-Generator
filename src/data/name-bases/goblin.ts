import type { NameBase } from ".";

export const goblin: NameBase = {
  id: "goblin",
  name: "Goblin",
  length: [4, 9],
  // biome-ignore format: a corpus reads as one line
  places: { names: ["Asinx", "Bhiagielt", "Biokvish", "Blix", "Blus", "Bratliaq", "Breshass", "Bridvelb", "Brybsil", "Bugbig", "Buyagh", "Cel", "Chalk", "Chiafzia", "Chox", "Cielb", "Cosvil", "Crekork", "Crild", "Croibieq", "Diervaq", "Dobruing", "Driord", "Eebligz", "Een", "Enissee", "Esz", "Far", "Felhob", "Froihiofz", "Fruict", "Fygsee", "Gagablin", "Gigganqi", "Givzieqee", "Glamzofs", "Glernaahx", "Gneabs", "Gnoklig", "Gobbledak", "gobbok", "Gobbrin", "Heszai", "Hiszils", "Hobgar", "Honk", "Iahzaarm", "Ialsirt", "Ilm", "Ish", "Jasheafta", "Joimtoilm", "Kass", "Katmelt", "Kleabtong", "Kleardeek", "Klilm", "Kluirm", "Kuipuinx", "Moft", "Mogg", "Nilbog", "Oimzoishai", "Onq", "Ozbiard", "Paas", "Phax", "Phigheldai", "Preang", "Prolkeh", "Pyreazzi", "Qeerags", "Qosx", "Rekx", "Shaxi", "Sios", "Slehzit", "Slofboif", "Slukex", "Srefs", "Srurd", "Stiaggaltia", "Stiolx", "Stioskurt", "Stroir", "Strytzakt", "Stuikvact", "Styrzangai", "Suirx", "Swaxi", "Taxai", "Thelt", "Thresxea", "Thult", "Traglila", "Treaq", "Ulb", "Ulm", "Utha", "Utiarm", "Veekz", "Vohniots", "Vreagaald", "Watvielx", "Wrogdilk", "Wruilt", "Xurx", "Ziggek", "Zriokots"] },
  rules: [{ match: "([^eag])\\1+", replace: "$1" }],
  patterns: { "root-land": { weight: 0 }, "modifier-land": { weight: 0 } }
};
