import type { NameBase } from ".";

export const amazigh: NameBase = {
  id: "amazigh",
  name: "Amazigh",
  length: [4, 10],
  // biome-ignore format: a corpus reads as one line
  places: { names: ["Abkhouch", "Adrar", "Aeraysh", "Afrag", "Agadir", "Agelmam", "Aghmat", "Agrakal", "Agulmam", "Ahaggar", "Ait Baha", "Ajdir", "Akka", "Almou", "Amegdul", "Amizmiz", "Amknas", "Amlil", "Amurakush", "Anfa", "Annaba", "Aousja", "Arbat", "Arfud", "Argoub", "Arif", "Asfi", "Asfru", "Ashawen", "Assamer", "Assif", "Awlluz", "Ayt Melel", "Azaghar", "Azila", "Azilal", "Azmour", "Azro", "Azrou", "Beccar", "Beja", "Bennour", "Benslimane", "Berkane", "Berrechid", "Bizerte", "Bjaed", "Bouayach", "Boudenib", "Boufrah", "Bouskoura", "Boutferda", "Darallouch", "Dar Bouazza", "Darchaabane", "Dcheira", "Demnat", "Denden", "Djebel", "Djedeida", "Drargua", "Elhusima", "Essaouira", "Ezzahra", "Fas", "Fnideq", "Ghezeze", "Goubellat", "Grisaffen", "Guelmim", "Guercif", "Hammamet", "Harrouda", "Hdifa", "Hoceima", "Houara", "Idhan", "Idurar", "Ifendassen", "Ifoghas", "Ifrane", "Ighoud", "Ikbir", "Imilchil", "Imzuren", "Inezgane", "Irherm", "Izoughar", "Jendouba", "Kacem", "Kelibia", "Kenitra", "Kerrando", "Khalidia", "Khemisset", "Khenifra", "Khouribga", "Khourigba", "Kidal", "Korba", "Korbous", "Lahraouyine", "Larache", "Leyun", "Lqliaa", "Manouba", "Martil", "Mazagan", "Mcherga", "Mdiq", "Megrine", "Mellal", "Melloul", "Midelt", "Misur", "Mohammedia", "Mornag", "Mrirt", "Nabeul", "Nadhour", "Nador", "Nawaksut", "Nefza", "Ouarzazate", "Ouazzane", "Oued Zem", "Oujda", "Ouladteima", "Qsentina", "Rades", "Rafraf", "Safi", "Sefrou", "Sejnane", "Settat", "Sijilmassa", "Skhirat", "Slimane", "Somaa", "Sraghna", "Susa", "Tabarka", "Tadrart", "Taferka", "Tafilalt", "Tafrawt", "Tafza", "Tagbalut", "Tagerdayt", "Taghzut", "Takelsa", "Taliouine", "Tanja", "Tantan", "Taourirt", "Targuist", "Taroudant", "Tarudant", "Tasfelalayt", "Tassort", "Tata", "Tattiwin", "Tawnat", "Taza", "Tazagurt", "Tazerka", "Tazizawt", "Taznakht", "Tebourba", "Teboursouk", "Temara", "Testour", "Tetouan", "Tibeskert", "Tifelt", "Tijdit", "Tinariwen", "Tinduf", "Tinja", "Tittawan", "Tiznit", "Toubkal", "Trables", "Tubqal", "Tunes", "Ultasila", "Urup", "Wagguten", "Wararni", "Warzazat", "Watlas", "Wehran", "Wejda", "Xamida", "Yedder", "Youssoufia", "Zaghouan", "Zahret", "Zemmour", "Zriba"] },
  rules: [{ match: "([^s])\\1+", replace: "$1" }],
  lexicon: {
    land: [
      { form: "a", weight: 8, position: "last" },
      { form: "ia", weight: 2, position: "last" }
    ]
  }
};
