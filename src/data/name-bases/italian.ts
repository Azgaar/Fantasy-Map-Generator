import type { NameBase } from ".";

export const italian: NameBase = {
  id: "italian",
  name: "Italian",
  length: [5, 12],
  // biome-ignore format: a corpus reads as one line
  places: { names: ["Accumoli", "Acquafondata", "Acquapendente", "Acuto", "Affile", "Agosta", "Alatri", "Albano", "Allumiere", "Alvito", "Amaseno", "Amatrice", "Anagni", "Anguillara", "Anticoli", "Antrodoco", "Anzio", "Aprilia", "Aquino", "Arcinazzo", "Ariccia", "Arpino", "Arsoli", "Ausonia", "Bagnoregio", "Bassiano", "Bellegra", "Belmonte", "Bolsena", "Bomarzo", "Borgorose", "Boville", "Bracciano", "Broccostella", "Calcata", "Camerata", "Campagnano", "Campoli", "Canale", "Canino", "Cantalice", "Cantalupo", "Capranica", "Caprarola", "Carbognano", "Casalattico", "Casalvieri", "Castelforte", "Castelnuovo", "Castiglione", "Castro", "Castrocielo", "Ceccano", "Celleno", "Cellere", "Cerreto", "Cervara", "Cerveteri", "Ciampino", "Ciciliano", "Cittaducale", "Cittareale", "Civita", "Civitella", "Colfelice", "Colleferro", "Collepardo", "Colonna", "Concerviano", "Configni", "Contigliano", "Cori", "Cottanello", "Esperia", "Faleria", "Farnese", "Ferentino", "Fiamignano", "Filacciano", "Fiuggi", "Fiumicino", "Fondi", "Fontana", "Fonte", "Fontechiari", "Formia", "Frascati", "Frasso", "Frosinone", "Fumone", "Gaeta", "Gallese", "Gavignano", "Genazzano", "Giuliano", "Gorga", "Gradoli", "Grottaferrata", "Grotte", "Guarcino", "Guidonia", "Ischia", "Isola", "Labico", "Labro", "Ladispoli", "Latera", "Lenola", "Leonessa", "Licenza", "Longone", "Lubriano", "Maenza", "Magliano", "Marano", "Marcellina", "Marcetelli", "Marino", "Mazzano", "Mentana", "Micigliano", "Minturno", "Montalto", "Montasola", "Montebuono", "Monteflavio", "Montelanico", "Monteleone", "Montenero", "Monterosi", "Moricone", "Morlupo", "Nazzano", "Nemi", "Nerola", "Nespolo", "Nettuno", "Norma", "Olevano", "Onano", "Oriolo", "Orte", "Orvinio", "Paganico", "Paliano", "Palombara", "Patrica", "Pescorocchiano", "Petrella", "Piansano", "Picinisco", "Pico", "Piedimonte", "Piglio", "Pignataro", "Poggio", "Poli", "Pomezia", "Pontecorvo", "Pontinia", "Ponzano", "Posta", "Pozzaglia", "Priverno", "Proceno", "Rignano", "Riofreddo", "Ripi", "Rivodutri", "Rocca", "Roccagorga", "Roccantica", "Roccasecca", "Roiate", "Ronciglione", "Roviano", "Salisano", "Sambuci", "Santa", "Santini", "Scandriglia", "Segni", "Selci", "Sermoneta", "Serrone", "Settefrati", "Sezze", "Sgurgola", "Sonnino", "Sora", "Soriano", "Sperlonga", "Spigno", "Subiaco", "Supino", "Sutri", "Tarano", "Tarquinia", "Terelle", "Terracina", "Tivoli", "Toffia", "Tolfa", "Torrice", "Torricella", "Trevi", "Trevignano", "Trivigliano", "Turania", "Tuscania", "Valentano", "Vallecorsa", "Vallemaio", "Vallepietra", "Vallerano", "Vasanello", "Vejano", "Velletri", "Ventotene", "Veroli", "Vetralla", "Vicalvi", "Vico", "Vicovaro", "Vignanello", "Viterbo", "Viticuso", "Vitorchiano", "Vivaro", "Zagarolo"] },
  rules: [{ match: "([^cltr])\\1+", replace: "$1" }],
  lexicon: {
    land: [
      { form: "terra", weight: 3, position: "last" },
      { form: "ia", weight: 97, position: "last" }
    ]
  }
};
