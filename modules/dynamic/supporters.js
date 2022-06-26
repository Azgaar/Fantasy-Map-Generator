import {capitalize} from "/src/utils/stringUtils";

const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);

const format = rawList =>
  rawList
    .replace(/(?:\r\n|\r|\n)/g, "")
    .split(",")
    .map(name => capitalize(name.trim()))
    .sort();

export const supporters = format(`
  Aaron Meyer,Ahmad Amerih,AstralJacks,aymeric,Billy Dean Goehring,Branndon Edwards,Chase Mayers,Curt Flood,cyninge,Dino Princip,
  E.M. White,es,Fondue,Fritjof Olsson,Gatsu,Johan Fröberg,Jonathan Moore,Joseph Miranda,Kate,KC138,Luke Nelson,Markus Finster,Massimo Vella,Mikey,
  Nathan Mitchell,Paavi1,Pat,Ryan Westcott,Sasquatch,Shawn Spencer,Sizz_TV,Timothée CALLET,UTG community,Vlad Tomash,Wil Sisney,William Merriott,
  Xariun,Gun Metal Games,Scott Marner,Spencer Sherman,Valerii Matskevych,Alloyed Clavicle,Stewart Walsh,Ruthlyn Mollett (Javan),Benjamin Mair-Pratt,
  Diagonath,Alexander Thomas,Ashley Wilson-Savoury,William Henry,Preston Brooks,JOSHUA QUALTIERI,Hilton Williams,Katharina Haase,Hisham Bedri,
  Ian arless,Karnat,Bird,Kevin,Jessica Thomas,Steve Hyatt,Logicspren,Alfred García,Jonathan Killstring,John Ackley,Invad3r233,Norbert Žigmund,Jennifer,
  PoliticsBuff,_gfx_,Maggie,Connor McMartin,Jared McDaris,BlastWind,Franc Casanova Ferrer,Dead & Devil,Michael Carmody,Valerie Elise,naikibens220,
  Jordon Phillips,William Pucs,The Dungeon Masters,Brady R Rathbun,J,Shadow,Matthew Tiffany,Huw Williams,Joseph Hamilton,FlippantFeline,Tamashi Toh,
  kms,Stephen Herron,MidnightMoon,Whakomatic x,Barished,Aaron bateson,Brice Moss,Diklyquill,PatronUser,Michael Greiner,Steven Bennett,Jacob Harrington,
  Miguel C.,Reya C.,Giant Monster Games,Noirbard,Brian Drennen,Ben Craigie,Alex Smolin,Endwords,Joshua E Goodwin,SirTobit ,Allen S. Rout,Allen Bull Bear,
  Pippa Mitchell,R K,G0atfather,Ryan Lege,Caner Oleas Pekgönenç,Bradley Edwards,Tertiary ,Austin Miller,Jesse Holmes,Jan Dvořák,Marten F,Erin D. Smale,
  Maxwell Hill,Drunken_Legends,rob bee,Jesse Holmes,YYako,Detocroix,Anoplexian,Hannah,Paul,Sandra Krohn,Lucid,Richard Keating,Allen Varney,Rick Falkvinge,
  Seth Fusion,Adam Butler,Gus,StroboWolf,Sadie Blackthorne,Zewen Senpai,Dell McKnight,Oneiris,Darinius Dragonclaw Studios,Christopher Whitney,Rhodes HvZ,
  Jeppe Skov Jensen,María Martín López,Martin Seeger,Annie Rishor,Aram Sabatés,MadNomadMedia,Eric Foley,Vito Martono,James H. Anthony,Kevin Cossutta,
  Thirty-OneR,ThatGuyGW,Dee Chiu,MontyBoosh,Achillain,Jaden,SashaTK,Steve Johnson,Pierrick Bertrand,Jared Kennedy,Dylan Devenny,Kyle Robertson,
  Andrew Rostaing,Daniel Gill,Char,Jack,Barna Csíkos,Ian Rousseau,Nicholas Grabstas,Tom Van Orden jr,Bryan Brake,Akylos,Riley Seaman,MaxOliver,Evan-DiLeo,
  Alex Debus,Joshua Vaught,Kyle S,Eric Moore,Dean Dunakin,Uniquenameosaurus,WarWizardGames,Chance Mena,Jan Ka,Miguel Alejandro,Dalton Clark,Simon Drapeau,
  Radovan Zapletal,Jmmat6,Justa Badge,Blargh Blarghmoomoo,Vanessa Anjos,Grant A. Murray,Akirsop,Rikard Wolff,Jake Fish,teco 47,Antiroo,Jakob Siegel,
  Guilherme Aguiar,Jarno Hallikainen,Justin Mcclain,Kristin Chernoff,Rowland Kingman,Esther Busch,Grayson McClead,Austin,Hakon the Viking,Chad Riley,
  Cooper Counts,Patrick Jones,Clonetone,PlayByMail.Net,Brad Wardell,Lance Saba,Egoensis,Brea Richards,Tiber,Chris Bloom,Maxim Lowe,Aquelion,
  Page One Project,Spencer Morris,Paul Ingram,Dust Bunny,Adrian Wright,Eric Alexander Cartaya,GameNight,Thomas Mortensen Hansen,Zklaus,Drinarius,
  Ed Wright,Lon Varnadore,Crys Cain,Heaven N Lee,Jeffrey Henning,Lazer Elf,Jordan Bellah,Alex Beard,Kass Frisson,Petro Lombaard,Emanuel Pietri,Rox,
  PinkEvil,Gavin Madrigal,Martin Lorber,Prince of Morgoth,Jaryd Armstrong,Andrew Pirkola,ThyHolyDevil,Gary Smith,Tyshaun Wise,Ethan Cook,Jon Stroman,
  Nobody679,良义 金,Chris Gray,Phoenix Boatwright,Mackenzie,Milo Cohen,Jason Matthew Wuerfel,Rasmus Legêne,Andrew Hines,Wexxler,Espen Sæverud,Binks,
  Dominick Ormsby,Linn Browning,Václav Švec,Alan Buehne,George J.Lekkas,Alexandre Boivin,Tommy Mayfield,Skylar Mangum-Turner,Karen Blythe,Stefan Gugerel,
  Mike Conley,Xavier privé,Hope You're Well,Mark Sprietsma,Robert Landry,Nick Mowry,steve hall,Markell,Josh Wren,Neutrix,BLRageQuit,Rocky,
  Dario Spadavecchia,Bas Kroot,John Patrick Callahan Jr,Alexandra Vesey,D,Exp1nt,james,Braxton Istace,w,Rurikid,AntiBlock,Redsauz,BigE0021,
  Jonathan Williams,ojacid .,Brian Wilson,A Patreon of the Ahts,Shubham Jakhotiya,www15o,Jan Bundesmann,Angelique Badger,Joshua Xiong,Moist mongol,
  Frank Fewkes,jason baldrick,Game Master Pro,Andrew Kircher,Preston Mitchell,Chris Kohut,Emarandzeb,Trentin Bergeron,Damon Gallaty,Pleaseworkforonce,
  Jordan,William Markus,Sidr Dim,Alexander Whittaker,The Next Level,Patrick Valverde,Markus Peham,Daniel Cooper,the Beagles of Neorbus,Marley Moule,
  Maximilian Schielke,Johnathan Xavier Hutchinson,Ele,Rita,Randy Ross,John Wick,RedSpaz,cameron cannon,Ian Grau-Fay,Kyle Barrett,Charlotte Wiland,
  David Kaul,E. Jason Davis,Cyberate,Atenfox,Sea Wolf,Holly Loveless,Roekai,Alden Z,angel carrillo,Sam Spoerle,S A Rudy,Bird Law Expert,Mira Cyr,
  Aaron Blair,Neyimadd,RLKZ1022,DerWolf,Kenji Yamada,Zion,Robert Rinne,Actual_Dio,Kyarou
`);
