import type { NameBase } from ".";

export const portuguese: NameBase = {
  id: "portuguese",
  name: "Portuguese",
  length: [5, 11],
  // biome-ignore format: a corpus reads as one line
  places: { names: ["Abrigada", "Afonsoeiro", "Agueda", "Aguilada", "Alagoas", "Alagoinhas", "Albufeira", "Alcanhoes", "Alcobaca", "Alcoutim", "Aldoar", "Alenquer", "Alfeizerao", "Algarve", "Almada", "Almagreira", "Almeirim", "Alpalhao", "Alpedrinha", "Alvorada", "Amieira", "Anapolis", "Apelacao", "Aranhas", "Arganil", "Armacao", "Assenceira", "Aveiro", "Avelar", "Balsas", "Barcarena", "Barreiras", "Barretos", "Batalha", "Beira", "Benavente", "Betim", "Braga", "Braganca", "Brasilia", "Brejo", "Cabeceiras", "Cabedelo", "Cachoeiras", "Cadafais", "Calhandriz", "Calheta", "Caminha", "Campinas", "Canidelo", "Canoas", "Capinha", "Carmoes", "Cartaxo", "Carvalhal", "Carvoeiro", "Cascavel", "Castanhal", "Caxias", "Chapadinha", "Chaves", "Cocais", "Coentral", "Coimbra", "Comporta", "Conde", "Coqueirinho", "Coruche", "Damaia", "Dourados", "Enxames", "Ericeira", "Ervidel", "Escalhao", "Esmoriz", "Espinhal", "Estela", "Estoril", "Eunapolis", "Evora", "Famalicao", "Fanhoes", "Faro", "Fatima", "Felgueiras", "Ferreira", "Figueira", "Flecheiras", "Florianopolis", "Fornalhas", "Fortaleza", "Freiria", "Freixeira", "Fronteira", "Fundao", "Gracas", "Gradil", "Grainho", "Gralheira", "Guimaraes", "Horta", "Ilhavo", "Ilheus", "Lages", "Lagos", "Laranjeiras", "Lavacolhos", "Leiria", "Limoeiro", "Linhares", "Lisboa", "Lomba", "Lorvao", "Lourical", "Lourinha", "Luziania", "Macedo", "Machava", "Malveira", "Marinhais", "Maxial", "Mealhada", "Milharado", "Mira", "Mirandela", "Mogadouro", "Montalegre", "Mourao", "Nespereira", "Nilopolis", "Obidos", "Odemira", "Odivelas", "Oeiras", "Oleiros", "Olhalvo", "Olinda", "Olival", "Oliveira", "Oliveirinha", "Palheiros", "Palmeira", "Palmital", "Pampilhosa", "Pantanal", "Paradinha", "Parelheiros", "Pedrosinho", "Pegoes", "Penafiel", "Peniche", "Pinhao", "Pinheiro", "Pombal", "Pontal", "Pontinha", "Portel", "Portimao", "Quarteira", "Queluz", "Ramalhal", "Reboleira", "Recife", "Redinha", "Ribadouro", "Ribeira", "Ribeirao", "Rosais", "Sabugal", "Sacavem", "Sagres", "Sandim", "Sangalhos", "Santarem", "Santos", "Sarilhos", "Seixas", "Seixezelo", "Seixo", "Silvares", "Silveira", "Sinhaem", "Sintra", "Sobral", "Sobralinho", "Tabuaco", "Tabuleiro", "Taveiro", "Teixoso", "Telhado", "Telheiro", "Tomar", "Torreira", "Trancoso", "Troviscal", "Vagos", "Varzea", "Velas", "Viamao", "Viana", "Vidigal", "Vidigueira", "Vidual", "Vilamar", "Vimeiro", "Vinhais", "Vitoria"] },
  rules: [{ match: "(.)\\1+", replace: "$1" }],
  lexicon: {
    land: [
      { form: "terra", weight: 3, position: "last" },
      { form: "ia", weight: 97, position: "last" }
    ]
  }
};
