import type { NameBase } from ".";

export const hungarian: NameBase = {
  id: "hungarian",
  name: "Hungarian",
  length: [6, 13],
  // biome-ignore format: a corpus reads as one line
  places: { names: ["Aba", "Abadszalok", "Adony", "Ajak", "Albertirsa", "Alsozsolca", "Aszod", "Babolna", "Bacsalmas", "Baktaloranthaza", "Balassagyarmat", "Balatonalmadi", "Balatonboglar", "Balkany", "Balmazujvaros", "Barcs", "Bataszek", "Batonyterenye", "Battonya", "Bekes", "Berettyoujfalu", "Berhida", "Biatorbagy", "Bicske", "Biharkeresztes", "Bodajk", "Boly", "Bonyhad", "Budakalasz", "Budakeszi", "Celldomolk", "Csakvar", "Csenger", "Csongrad", "Csorna", "Csorvas", "Csurgo", "Dabas", "Demecser", "Derecske", "Devavanya", "Devecser", "Dombovar", "Dombrad", "Dunafoldvar", "Dunaharaszti", "Dunavarsany", "Dunavecse", "Edeleny", "Elek", "Emod", "Encs", "Enying", "Ercsi", "Fegyvernek", "Fehergyarmat", "Felsozsolca", "Fertoszentmiklos", "Fonyod", "Fot", "Fuzesabony", "Fuzesgyarmat", "Gardony", "God", "Gyal", "Gyomaendrod", "Gyomro", "Hajdudorog", "Hajduhadhaz", "Hajdusamson", "Hajduszoboszlo", "Halasztelek", "Harkany", "Hatvan", "Heves", "Heviz", "Ibrany", "Isaszeg", "Izsak", "Janoshalma", "Janossomorja", "Jaszapati", "Jaszarokszallas", "Jaszfenyszaru", "Jaszkiser", "Kaba", "Kalocsa", "Kapuvar", "Karcag", "Kecel", "Kemecse", "Kenderes", "Kerekegyhaza", "Keszthely", "Kisber", "Kiskunmajsa", "Kistarcsa", "Kistelek", "Kisujszallas", "Kisvarda", "Komadi", "Komarom", "Komlo", "Kormend", "Korosladany", "Koszeg", "Kozarmisleny", "Kunhegyes", "Kunszentmarton", "Kunszentmiklos", "Labatlan", "Lajosmizse", "Lenti", "Letavertes", "Letenye", "Lorinci", "Maglod", "Mako", "Mandok", "Marcali", "Martonvasar", "Mateszalka", "Melykut", "Mezobereny", "Mezocsat", "Mezohegyes", "Mezokeresztes", "Mezokovesd", "Mezotur", "Mindszent", "Mohacs", "Monor", "Mor", "Morahalom", "Nadudvar", "Nagyatad", "Nagyecsed", "Nagyhalasz", "Nagykallo", "Nagykoros", "Nagymaros", "Nyekladhaza", "Nyergesujfalu", "Nyirbator", "Nyirmada", "Nyirtelek", "Ocsa", "Orkeny", "Oroszlany", "Paks", "Pannonhalma", "Paszto", "Pecel", "Pecsvarad", "Pilisvorosvar", "Polgar", "Polgardi", "Pomaz", "Puspokladany", "Pusztaszabolcs", "Putnok", "Racalmas", "Rackeve", "Rakamaz", "Rakoczifalva", "Sajoszent", "Sandorfalva", "Sarbogard", "Sarkad", "Sarospatak", "Sarvar", "Satoraljaujhely", "Siklos", "Simontornya", "Soltvadkert", "Sumeg", "Szabadszallas", "Szarvas", "Szazhalombatta", "Szecseny", "Szeghalom", "Szentgotthard", "Szentlorinc", "Szerencs", "Szigethalom", "Szigetvar", "Szikszo", "Tab", "Tamasi", "Tapioszele", "Tapolca", "Teglas", "Tet", "Tiszafoldvar", "Tiszafured", "Tiszakecske", "Tiszalok", "Tiszaujvaros", "Tiszavasvari", "Tokaj", "Tokol", "Tompa", "Torokbalint", "Torokszentmiklos", "Totkomlos", "Tura", "Turkeve", "Ujkigyos", "ujszasz", "Vamospercs", "Varpalota", "Vasarosnameny", "Vasvar", "Vecses", "Veresegyhaz", "Verpelet", "Veszto", "Zahony", "Zalaszentgrot", "Zirc", "Zsambek"] },
  rules: [{ match: "(.)\\1+", replace: "$1" }],
  lexicon: {
    land: [
      { form: "orszag", weight: 4, position: "last" },
      { form: "ia", weight: 6, position: "last" }
    ]
  }
};
