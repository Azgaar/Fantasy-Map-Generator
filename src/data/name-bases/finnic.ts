import type { NameBase } from ".";

export const finnic: NameBase = {
  id: "finnic",
  name: "Finnic",
  length: [5, 11],
  // biome-ignore format: a corpus reads as one line
  places: { names: ["Aanekoski", "Ahlainen", "Aholanvaara", "Ahtari", "Aijala", "Akaa", "Alajarvi", "Antsla", "Aspo", "Bennas", "Bjorkoby", "Elva", "Emasalo", "Espoo", "Esse", "Evitskog", "Forssa", "Haapamaki", "Haapavesi", "Haapsalu", "Hameenlinna", "Hanko", "Harjavalta", "Hattuvaara", "Hautajarvi", "Havumaki", "Heinola", "Hetta", "Hinkabole", "Hirmula", "Hossa", "Huittinen", "Husula", "Hyryla", "Hyvinkaa", "Ikaalinen", "Iskmo", "Itakoski", "Jamsa", "Jarvenpaa", "Jeppo", "Jioesuu", "Jiogeva", "Joensuu", "Jokikyla", "Jungsund", "Jyvaskyla", "Kaamasmukka", "Kajaani", "Kalajoki", "Kallaste", "Kankaanpaa", "Karkku", "Karpankyla", "Kaskinen", "Kasnas", "Kauhajoki", "Kauhava", "Kauniainen", "Kauvatsa", "Kehra", "Kellokoski", "Kelottijarvi", "Kemi", "Kemijarvi", "Kerava", "Keuruu", "Kiljava", "Kiuruvesi", "Kivesjarvi", "Kiviioli", "Kivisuo", "Klaukkala", "Klovskog", "Kohtlajarve", "Kokemaki", "Kokkola", "Kolho", "Koskue", "Kotka", "Kouva", "Kaupunki", "Kuhmo", "Kunda", "Kuopio", "Kuressaare", "Kurikka", "Kuusamo", "Kylmalankyla", "Lahti", "Laitila", "Lankipohja", "Lansikyla", "Lapua", "Laurila", "Lautiosaari", "Lempaala", "Lepsama", "Liedakkala", "Lieksa", "Littoinen", "Lohja", "Loimaa", "Loksa", "Loviisa", "Malmi", "Mantta", "Matasvaara", "Maula", "Miiluranta", "Mioisakula", "Munapirtti", "Mustvee", "Muurahainen", "Naantali", "Nappa", "Narpio", "Niinimaa", "Niinisalo", "Nikkila", "Nilsia", "Nivala", "Nokia", "Nummela", "Nuorgam", "Nuvvus", "Obbnas", "Oitti", "Ojakkala", "Onninen", "Orimattila", "Orivesi", "Otanmaki", "Otava", "Otepaa", "Oulainen", "Oulu", "Paavola", "Paide", "Paimio", "Pakankyla", "Paldiski", "Parainen", "Parkumaki", "Parola", "Perttula", "Pieksamaki", "Pioltsamaa", "Piolva", "Pohjavaara", "Porhola", "Porrasa", "Porvoo", "Pudasjarvi", "Purmo", "Pyhajarvi", "Raahe", "Raasepori", "Raisio", "Rajamaki", "Rakvere", "Rapina", "Rapla", "Rauma", "Rautio", "Reposaari", "Riihimaki", "Rovaniemi", "Roykka", "Ruonala", "Ruottala", "Rutalahti", "Saarijarvi", "Salo", "Sastamala", "Saue", "Savonlinna", "Seinajoki", "Sillamae", "Siuntio", "Sompujarvi", "Suonenjoki", "Suurejaani", "Syrjantaka", "Tamsalu", "Tapa", "Temmes", "Tiorva", "Tormasenvaara", "Tornio", "Tottijarvi", "Tulppio", "Turenki", "Turi", "Tuukkala", "Tuurala", "Tuuri", "Tuuski", "Tuusniemi", "Ulvila", "Unari", "Upinniemi", "Utti", "Uusikaupunki", "Vaaksy", "Vaalimaa", "Vaarinmaja", "Vaasa", "Vainikkala", "Valga", "Valkeakoski", "Vantaa", "Varkaus", "Vehkapera", "Vehmasmaki", "Vieki", "Vierumaki", "Viitasaari", "Viljandi", "Vilppula", "Viohma", "Vioru", "Virrat", "Ylike", "Ylivieska", "Ylojarvi"] },
  rules: [{ match: "([^akiut])\\1+", replace: "$1" }],
  lexicon: {
    land: [
      { form: "maa", weight: 35, position: "last" },
      { form: "ia", weight: 65, position: "last" }
    ]
  }
};
