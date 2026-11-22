import type { NameBase } from ".";

export const castillian: NameBase = {
  id: "castillian",
  name: "Castillian",
  length: [5, 11],
  // biome-ignore format: a corpus reads as one line
  places: { names: ["Ajofrin", "Alameda", "Alaminos", "Albares", "Albarreal", "Albendiego", "Alcanizo", "Alcaudete", "Alcolea", "Aldea", "Aldeanueva", "Algar", "Algora", "Alhondiga", "Almadrones", "Almendral", "Alovera", "Anguita", "Arbancon", "Argecilla", "Arges", "Arroyo", "Atanzon", "Atienza", "Azuqueca", "Baides", "Banos", "Bargas", "Barriopedro", "Belvis", "Berninches", "Brihuega", "Buenaventura", "Burgos", "Burguillos", "Bustares", "Cabanillas", "Calzada", "Camarena", "Campillo", "Cantalojas", "Cardiel", "Carmena", "Casas", "Castejon", "Castellar", "Castilforte", "Castillo", "Castilnuevo", "Cazalegas", "Centenera", "Cervera", "Checa", "Chozas", "Chueca", "Cifuentes", "Cincovillas", "Ciruelas", "Cogollor", "Cogolludo", "Consuegra", "Copernal", "Corral", "Cuerva", "Domingo", "Dosbarrios", "Driebes", "Duron", "Escalona", "Escalonilla", "Escamilla", "Escopete", "Espinosa", "Esplegares", "Esquivias", "Estables", "Estriegana", "Fontanar", "Fuembellida", "Fuensalida", "Fuentelsaz", "Gajanejos", "Galvez", "Gascuena", "Gerindote", "Guadamur", "Heras", "Herreria", "Herreruela", "Hinojosa", "Hita", "Hombrados", "Hontanar", "Hormigos", "Huecas", "Huerta", "Humanes", "Illana", "Illescas", "Iniestola", "Irueste", "Jadraque", "Jirueque", "Lagartera", "Ledanca", "Lillo", "Lominchar", "Loranca", "Lucillos", "Luzaga", "Luzon", "Madrid", "Magan", "Malaga", "Malpica", "Manzanar", "Maqueda", "Masegoso", "Matillas", "Medranda", "Megina", "Mejorada", "Millana", "Milmarcos", "Mirabueno", "Miralrio", "Mocejon", "Mochales", "Molina", "Mondejar", "Montarron", "Mora", "Moratilla", "Morenilla", "Navas", "Negredo", "Noblejas", "Numancia", "Nuno", "Ocana", "Ocentejo", "Olias", "Olmeda", "Ontigola", "Orea", "Orgaz", "Oropesa", "Otero", "Palma", "Pardos", "Paredes", "Penalver", "Pepino", "Peralejos", "Pinilla", "Pioz", "Piqueras", "Portillo", "Poveda", "Pozo", "Pradena", "Prados", "Puebla", "Puerto", "Quero", "Quintanar", "Rebollosa", "Retamoso", "Riba", "Riofrio", "Robledo", "Romanillos", "Romanones", "Rueda", "Salmeron", "Santiuste", "Santo", "Sauca", "Segura", "Selas", "Semillas", "Sesena", "Setiles", "Sevilla", "Siguenza", "Solanillos", "Somolinos", "Sonseca", "Sotillo", "Talavera", "Taravilla", "Tembleque", "Tendilla", "Tierzo", "Torralba", "Torre", "Torrejon", "Torrijos", "Tortola", "Tortuera", "Totanes", "Trillo", "Uceda", "Ugena", "Urda", "Utande", "Valdesotos", "Valhermoso", "Valtablado", "Valverde", "Velada", "Viana", "Yebra", "Yuncos", "Yunquera", "Zaorejas", "Zarzuela", "Zorita"] },
  rules: [{ match: "([^lr])\\1+", replace: "$1" }],
  lexicon: {
    land: [
      { form: "terra", weight: 3, position: "last" },
      { form: "ia", weight: 97, position: "last" }
    ]
  }
};
