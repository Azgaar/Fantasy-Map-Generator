import type { WrittenNameBase } from "@/types/names";

// Malay words that head a name and stand apart, then Javanese and Sundanese ones that join what follows
const SPACED =
  "pesanggrahan|padepokan|pangkalan|pelabuhan|kepulauan|kadipaten|pertapan|seberang|jembatan|tambangan|benteng|labuhan|keramat|lembah|kampung|pesisir|tanjung|babakan|barisan|simpang|lumbung|tanggul|kedaton|pantai|benua|negeri|nagari|gunung|sungai|bengawan|bukit|gosong|beting|puncak|ngarai|jurang|tebing|genting|kincir|kilang|menara|pondok|dangau|warung|cabang|perigi|telaga|tasik|danau|pulau|teluk|kuala|muara|labuan|lubuk|kolam|padang|ladang|sawah|kebun|hutan|rimba|taman|candi|pasar|pekan|bandar|rantau|pasir|ujung|titi|desa|dusun|dukuh|lembur|talang|rumah|balai|rawa|paya|sumur|lurah|curug|coban|lata|batang|medan|sarang|tanduk|tangga|istana|kraton|gapura|pintu|tembok|pagar|gurun|gumuk|punden|makam|kubur|kepala|hulu|mata|kelok|tungku|pandean|galian|pangonan|banjar|kayu|pohon|jalan|kubu|kuta|kota|batu|situ|ranu|gili|nusa|tanah|bumi|tatar|ranah|alas|biara|mandala|pura|gua|goa|air|aik|way|tambang";
const FUSED =
  "karang|kedung|banyu|wana|kali|sumber|sendang|tegal|tirta|marga|arga|watu|umbul|kebon|tambak|pager|lebak|leuwi|lawang|bale|cadas|ci";
const ENDINGS =
  "pura|puri|karta|kerta|rejo|harjo|sari|mulya|mukti|jaya|agung|asri|mekar|wangi|negara|nagara|loka|buana|dwipa|mandala";

export const malay: WrittenNameBase = {
  id: "malay",
  description: "Places of Malaya and the Indies, in Malay and Javanese words",
  length: [4, 13],

  places: {
    names: [
      "Surabaya",
      "Surakarta",
      "Yogyakarta",
      "Semarang",
      "Salatiga",
      "Magelang",
      "Purworejo",
      "Purwokerto",
      "Purbalingga",
      "Banjarnegara",
      "Wonosobo",
      "Wonogiri",
      "Kebumen",
      "Cilacap",
      "Banyumas",
      "Tegal",
      "Brebes",
      "Pemalang",
      "Pekalongan",
      "Batang",
      "Kendal",
      "Demak",
      "Kudus",
      "Jepara",
      "Pati",
      "Rembang",
      "Blora",
      "Grobogan",
      "Purwodadi",
      "Sragen",
      "Karanganyar",
      "Sukoharjo",
      "Klaten",
      "Boyolali",
      "Temanggung",
      "Wonosari",
      "Bantul",
      "Sleman",
      "Wates",
      "Imogiri",
      "Kartasura",
      "Madiun",
      "Magetan",
      "Ngawi",
      "Ponorogo",
      "Pacitan",
      "Trenggalek",
      "Tulungagung",
      "Blitar",
      "Kediri",
      "Nganjuk",
      "Jombang",
      "Mojokerto",
      "Sidoarjo",
      "Gresik",
      "Lamongan",
      "Tuban",
      "Bojonegoro",
      "Malang",
      "Pasuruan",
      "Probolinggo",
      "Lumajang",
      "Jember",
      "Bondowoso",
      "Situbondo",
      "Banyuwangi",
      "Bangkalan",
      "Sampang",
      "Pamekasan",
      "Sumenep",
      "Singasari",
      "Majapahit",
      "Trowulan",
      "Kepanjen",
      "Lawang",
      "Tumapel",
      "Blambangan",
      "Daha",
      "Jenggala",
      "Panjalu",
      "Pajang",
      "Mataram",
      "Medang",
      "Pakuan",
      "Pajajaran",
      "Bogor",
      "Cianjur",
      "Sukabumi",
      "Bandung",
      "Garut",
      "Tasikmalaya",
      "Ciamis",
      "Banjar",
      "Kuningan",
      "Cirebon",
      "Indramayu",
      "Majalengka",
      "Sumedang",
      "Subang",
      "Purwakarta",
      "Karawang",
      "Bekasi",
      "Depok",
      "Cimahi",
      "Lembang",
      "Cipanas",
      "Cisarua",
      "Cibadak",
      "Cikajang",
      "Cibatu",
      "Ciwidey",
      "Banten",
      "Serang",
      "Pandeglang",
      "Rangkasbitung",
      "Lebak",
      "Tangerang",
      "Cilegon",
      "Jayakarta",
      "Kalapa",
      "Denpasar",
      "Singaraja",
      "Tabanan",
      "Gianyar",
      "Klungkung",
      "Bangli",
      "Karangasem",
      "Negara",
      "Ubud",
      "Gelgel",
      "Sanur",
      "Kuta",
      "Selong",
      "Praya",
      "Narmada",
      "Ampenan",
      "Sumbawa",
      "Bima",
      "Dompu",
      "Palembang",
      "Jambi",
      "Padang",
      "Bukittinggi",
      "Payakumbuh",
      "Pariaman",
      "Solok",
      "Sawahlunto",
      "Pagaruyung",
      "Batusangkar",
      "Medan",
      "Binjai",
      "Langkat",
      "Siantar",
      "Sibolga",
      "Barus",
      "Tarutung",
      "Balige",
      "Samosir",
      "Siak",
      "Bengkalis",
      "Pekanbaru",
      "Kampar",
      "Rengat",
      "Tembilahan",
      "Bangkinang",
      "Bengkulu",
      "Curup",
      "Manna",
      "Lahat",
      "Pagaralam",
      "Prabumulih",
      "Baturaja",
      "Kayuagung",
      "Sekayu",
      "Kotabumi",
      "Kalianda",
      "Liwa",
      "Krui",
      "Pangkalpinang",
      "Mentok",
      "Sungailiat",
      "Tanjungpinang",
      "Takengon",
      "Singkil",
      "Pontianak",
      "Sambas",
      "Singkawang",
      "Mempawah",
      "Sanggau",
      "Sintang",
      "Ketapang",
      "Sukadana",
      "Banjarmasin",
      "Martapura",
      "Amuntai",
      "Kandangan",
      "Rantau",
      "Barabai",
      "Pelaihari",
      "Sampit",
      "Kumai",
      "Tenggarong",
      "Samarinda",
      "Balikpapan",
      "Kutai",
      "Berau",
      "Bulungan",
      "Tarakan",
      "Paser",
      "Kuching",
      "Sarikei",
      "Sibu",
      "Mukah",
      "Miri",
      "Bintulu",
      "Brunei",
      "Sandakan",
      "Tawau",
      "Papar",
      "Keningau",
      "Kudat",
      "Melaka",
      "Johor",
      "Muar",
      "Pagoh",
      "Kluang",
      "Segamat",
      "Pekan",
      "Kuantan",
      "Temerloh",
      "Jerantut",
      "Raub",
      "Bentong",
      "Kelantan",
      "Kedah",
      "Perlis",
      "Kangar",
      "Arau",
      "Langkawi",
      "Perak",
      "Gopeng",
      "Lumut",
      "Manjung",
      "Selangor",
      "Klang",
      "Langat",
      "Kajang",
      "Seremban",
      "Rembau",
      "Jelebu",
      "Jempol",
      "Terengganu",
      "Marang",
      "Dungun",
      "Besut",
      "Kemaman",
      "Temasik",
      "Singapura",
      "Makassar",
      "Gowa",
      "Tallo",
      "Bone",
      "Wajo",
      "Soppeng",
      "Sidenreng",
      "Luwu",
      "Palopo",
      "Pinrang",
      "Enrekang",
      "Maros",
      "Bulukumba",
      "Bantaeng",
      "Jeneponto",
      "Takalar",
      "Sinjai",
      "Majene",
      "Mamuju",
      "Kendari",
      "Buton",
      "Kolaka",
      "Palu",
      "Donggala",
      "Poso",
      "Gorontalo",
      "Manado"
    ]
  },
  waters: {
    mode: "pick",
    names: [
      "Musi",
      "Kapuas",
      "Barito",
      "Mahakam",
      "Rokan",
      "Siak",
      "Kampar",
      "Indragiri",
      "Asahan",
      "Serayu",
      "Citarum",
      "Brantas",
      "Progo",
      "Opak",
      "Oyo",
      "Cimanuk",
      "Ciliwung",
      "Cisadane",
      "Cimandiri",
      "Citanduy",
      "Lematang",
      "Ogan",
      "Komering",
      "Rawas",
      "Lakitan",
      "Pahang",
      "Perak",
      "Kelantan",
      "Muar",
      "Rajang",
      "Baram",
      "Lupar",
      "Kayan",
      "Sesayap",
      "Kahayan",
      "Katingan",
      "Mentaya",
      "Sampit",
      "Seruyan",
      "Melawi",
      "Sambas",
      "Walanae",
      "Saddang",
      "Poso",
      "Toba",
      "Maninjau",
      "Singkarak",
      "Kerinci",
      "Matano",
      "Towuti",
      "Tempe",
      "Ranau",
      "Tondano",
      "Bratan",
      "Buyan",
      "Limboto",
      "Tuntang",
      "Lusi",
      "Semangka",
      "Mesuji",
      "Batanghari",
      "Pemali",
      "Comal",
      "Bogowonto",
      "Elo",
      "Langat",
      "Selangor",
      "Segama",
      "Padas",
      "Barumun",
      "Tamiang"
    ]
  },
  people: {
    male: {
      mode: "pick",
      names: [
        "Hayam",
        "Gajah",
        "Arok",
        "Wijaya",
        "Kertanegara",
        "Ametung",
        "Tohjaya",
        "Ranggawuni",
        "Jayanegara",
        "Jayakatwang",
        "Airlangga",
        "Sindok",
        "Dharmawangsa",
        "Jayabaya",
        "Kertajaya",
        "Raden",
        "Patah",
        "Unus",
        "Trenggana",
        "Hadiwijaya",
        "Senapati",
        "Amangkurat",
        "Mangkubumi",
        "Diponegoro",
        "Trunojoyo",
        "Surapati",
        "Sanjaya",
        "Panangkaran",
        "Balaputra",
        "Samaratungga",
        "Balitung",
        "Daksa",
        "Purnawarman",
        "Mulawarman",
        "Kudungga",
        "Aswawarman",
        "Siliwangi",
        "Wastukancana",
        "Linggabuana",
        "Hasanuddin",
        "Fatahillah",
        "Parameswara",
        "Iskandar",
        "Mansur",
        "Mahmud",
        "Muzaffar",
        "Alauddin",
        "Tuah",
        "Jebat",
        "Kasturi",
        "Lekir",
        "Adityawarman",
        "Perpatih",
        "Badang",
        "Palakka",
        "Bonang",
        "Kalijaga",
        "Muria",
        "Panji",
        "Damarwulan",
        "Jaka",
        "Bandung",
        "Mahesa",
        "Rangga",
        "Lawe",
        "Nambi",
        "Sora",
        "Imam",
        "Megat"
      ]
    },
    female: {
      mode: "pick",
      names: [
        "Tribhuwana",
        "Gayatri",
        "Dedes",
        "Suhita",
        "Pramodawardhani",
        "Sima",
        "Kalinyamat",
        "Dayang",
        "Purbasari",
        "Purbararang",
        "Citraresmi",
        "Pitaloka",
        "Saraswati",
        "Ratna",
        "Larasati",
        "Srikandi",
        "Sinta",
        "Arimbi",
        "Anjasmara",
        "Candrakirana",
        "Kilisuci",
        "Sekartaji",
        "Jonggrang",
        "Mendut",
        "Malahayati",
        "Safiatuddin",
        "Saadong",
        "Siti",
        "Zubaidah",
        "Fatimah",
        "Wulan",
        "Kemuning",
        "Kenanga",
        "Cempaka",
        "Intan",
        "Nilam",
        "Sulastri",
        "Retno",
        "Rukmini",
        "Ningrum",
        "Dewi"
      ]
    }
  },
  rules: [
    { match: "([^g])\\1+", replace: "$1" },
    { match: `^(?=[^ ]{15,}$)(${FUSED})\\+`, replace: "$1 ", at: "join" },
    // what stands at the place leads: Bukit Kencana, Gunung Wijaya
    { match: `^(?!(?:${SPACED}|${FUSED})\\+)([a-z]+)\\+(${SPACED}|${FUSED})$`, replace: "$2+$1", at: "join" },
    // a Javanese or Sundanese head takes the describing word of its own tongue: Banyuireng, Cibeureum
    String.raw`
\+maha$ => +raya | join
\+purwa$ => +lama | join
\+(?:sri|suka)$ => +indah | join
\+sida$ => +rahayu | join
\+candra$ => +bulan | join
\+(?:sekar|kusuma)$ => +bunga | join
\+prabu$ => +raja | join
\+sela$ => +batu | join
\+dwi$ => +dua | join
\+tri$ => +tiga | join
\+panca$ => +lima | join
\+sapta$ => +tujuh | join
\+dasa$ => +sepuluh | join
^ci\+hitam$ => ci+hideung | join
^ci\+putih$ => ci+bodas | join
^ci\+merah$ => ci+beureum | join
^ci\+besar$ => ci+gede | join
^ci\+kecil$ => ci+leutik | join
^ci\+baru$ => ci+anyar | join
^ci\+manis$ => ci+amis | join
^ci\+dingin$ => ci+tiis | join
^ci\+hijau$ => ci+hejo | join
^ci\+jernih$ => ci+herang | join
^ci\+ikan$ => ci+lauk | join
^ci\+dalam$ => ci+jero | join`,
    ...Object.entries({
      hitam: "ireng",
      merah: "abang",
      besar: "gede",
      kecil: "cilik",
      baru: "anyar",
      tua: "lawas",
      lama: "lawas",
      tinggi: "luhur",
      utara: "lor",
      selatan: "kidul",
      timur: "wetan",
      barat: "kulon",
      hijau: "ijo",
      dalam: "jero",
      garam: "uyah",
      api: "geni",
      manis: "legi"
    }).map(([malay, javanese]) => ({
      match: `^((?!ci)(?:${FUSED}))\\+${malay}$`,
      replace: `$1+${javanese}`,
      at: "join" as const
    })),
    { match: `(?<=(?:${SPACED}|${FUSED})\\+)kerta$`, replace: "makmur", at: "join" },
    // Javanese o for a: Purworejo, but Purwakarta
    {
      match: "(purw|kert|tirt|wan|marg|arg|jay|raj|sid|wijay)a\\+(?=(?:rejo|harjo|mulya)$)",
      replace: "$1o+",
      at: "join"
    },
    { match: "(?<=o\\+)mulya$", replace: "mulyo", at: "join" },
    { match: `(?<=^|\\+)(${SPACED})\\+(?!(?:${ENDINGS})$)`, replace: "$1 ", at: "join" }, // Bukit Tinggi, but Bukitsari
    { match: "([aeiou])\\+\\1", replace: "$1", at: "join" },
    { match: "^(?!ci\\+|banyu\\+a)([a-z]+[aeiou])\\+(?=[aeiou])", replace: "$1 ", at: "join" },
    { match: "(?<=[aeiou])\\+(?=[aeiou])", replace: "", at: "join" },
    { match: "^((?!desa|dusun|pulau)[a-z]{4,6}) (?=[^aeiou][a-z]{3,5}$)", replace: "$1", chance: 0.45 } // Pekanbaru, Bukittinggi
  ],

  // two layers: a Malay noun with what describes it after, mostly apart (bukit, +tinggi: Bukit Tinggi), and a Javanese
  // or Sanskrit compound in one word, its describing word first (suka+, +rejo: Sukarejo)
  lexicon: `
# settlements
city: +pura 7, +karta 7, +puri, kota+ 8, bandar+ 5, kuta+ 2
town: +harjo 4, +agung 3, +sari 3, +jaya 3, +mulya 2, pekan+ 5, kota+ 3, bandar+ 3, pasar+ 2, banjar+ 2
village: +rejo 5, +sari 5, +mulya 3, +mukti 2, +mekar 2, +asri 2, +wangi 1, kampung+ 9, desa+ 4, nagari+ 2, banjar+ 2
hamlet: +rejo 3, +sari 3, +asri 2, dusun+ 6, dukuh+ 5, kampung+ 3, talang+ 3, lembur+ 2, babakan+ 2

# places
home: rumah 2, pondok 4
farm: ladang 4, kebun 4, tegal 3
hall: balai 4, bale 3
field: sawah 5, ladang 4, tegal 5
wood: hutan 4, rimba 4, alas 3, wana 4
hill: bukit 8, gunung 2, +giri 3
ford: seberang 5, +sabrang 2
fort: benteng 4, kubu 4, kuta 3, Benteng
bridge: titi 4, jembatan 4, +kreteg 2
harbour: labuhan 5, labuan 4, pelabuhan 3
valley: lembah 5, lebak 5
market: pasar 8, pekan 4
castle: kuta 4, benteng 2, istana 2, kraton 2, kedaton 2, Kedaton
mouth: muara 8, kuala 8
mount: gunung 8, arga 3, +giri 3
shore: pantai 6
island: pulau 10, nusa 4, gili 2
lake: danau 6, telaga 4, situ 3, tasik 3, ranu 2
haven: teluk 4, labuan 4, labuhan 2
marsh: rawa 6, paya 4
spring: sumber 6, sendang 3, umbul 3, Pancuran 2
meadow: padang 6, tegal 2, +ombo
grove: kebon 4, kayu 2, kebun 2
bank: tebing 3, rantau 3
mill: kilang 3, kincir 3
bay: teluk 8
cape: tanjung 9, ujung 3
cliff: tebing 5, cadas 2
tower: menara 5
ridge: bukit 4, barisan 1
pass: genting 5
heath: tegal 4, padang 3
pool: lubuk 6, kedung 6, kolam 3, leuwi 2
well: sumur 5, perigi 4
camp: kubu 4, pondok 3
mine: tambang 3, Tambangan
quarry: galian 3, cadas 2
temple: candi 8, pura+ 3, Candi 2
abbey: padepokan 3, biara 4, mandala+ 2, Pesantren 2, Padepokan 2
river: sungai 8, kali 5, batang 4, ci+ 4, air 3, way 2, bengawan
brook: kali 5, ci+ 6, air 4, sungai 3, aik 2
water: air 6, banyu 5, ci+ 4, tirta 3, aik 2, way 2
keep: kuta 3, kubu 3, benteng 2
hold: kubu 3, benteng 3
watch: menara 2, Paninjauan 2, Peninjauan 2, Panenjoan
rest: pesanggrahan 3, Pesanggrahan 2, Persinggahan
end: ujung 5
landing: pangkalan 5, Pangkalan 2
gate: lawang 4, gapura 3, pintu 2
wall: pagar 4, kuta 2, tembok 2
rock: batu 8, karang 4, watu 4
crag: karang 4, batu 3, cadas 2
fell: gunung 3, bukit 2
run: kali 4, air 3, ci+ 3
falls: curug 5, coban 3, lata 2
garden: taman 6, kebun 2
hedge: pagar 4, pager 3
den: sarang 3
nest: sarang 4
hearth: tungku 2
court: kraton 3, kedaton 3, istana 2, Keraton 2
horn: tanduk 3
head: hulu 5, kepala 2
eye: mata 3
point: ujung 5, tanjung 3
reef: karang 5, gosong 3
sands: pasir 8, gosong 2
dune: gumuk 4, beting 2
waste: gurun 3, padang
fen: rawa 4, paya 4
glade: tegal 2, padang 2
glen: lembah 3, lebak 4
hollow: lebak 3, lurah 3
gorge: ngarai 4, jurang 4
peak: puncak 6
spire: puncak
cave: gua 5, goa 3
forge: pandean 3, Pandaan
barrow: gumuk 3, punden 2
grave: makam 2, kubur 2, Pasarean
shrine: keramat 4, punden 3, pura+ 2
hermitage: pertapan 4, Pertapan
crossing: simpang 5, seberang 3
ferry: tambangan 4, Tambangan 2, Penyeberangan
fork: simpang 5, cabang 4
bend: rantau 5, kelok 3
beacon: menara
square: medan 4, Alun-Alun
inn: pesanggrahan 2, warung 3
barn: lumbung 5
pasture: pangonan 3, padang 3
lodge: pondok 5, dangau 3
tarn: telaga 4, ranu 3, situ 3
tree: kayu 4, pohon 3
way: marga 4, jalan 2
dike: tambak 4, tanggul 4
stair: tangga 3

# modifiers
new: +baru 10, +anyar 5, Baru 6, Anyar 2
old: +lama 6, +tua 5, purwa+ 6, Lama 4, Tua 3
great: +besar 4, +gede 3, +agung 4, +raya 4, maha+ 2, Besar 3, Agung 2, Raya 2
little: +kecil 6, +cilik 3, +kecik 2, Kecil 4, Cilik 2
long: +panjang 7, +dawa 2
broad: +lebar 4, +luas 2
deep: +dalam 5
high: +tinggi 8, +luhur 3
low: +rendah 4, +lebak 2
upper: +hulu 5, +girang 3, +atas 2, Hulu 4, Atas 2, Girang 2
lower: +hilir 5, +ilir 2, +bawah 2, Hilir 4, Bawah 2
middle: +tengah 7, Tengah 4
north: +utara 5, +lor 4, +kaler 2, Utara 5, Lor 3
south: +selatan 5, +kidul 5, Selatan 5, Kidul 4
east: +timur 5, +wetan 4, Timur 5, Wetan 3
west: +barat 5, +kulon 4, Barat 5, Kulon 3
black: +hitam 8, +ireng 2
white: +putih 9
red: +merah 8, +abang 2
green: +hijau 5, +ijo 2, +hejo
golden: +emas 4, kencana 5, +mas 2
grey: +kelabu 4
blue: +biru 6
dark: +gelap 4, +peteng 2
bright: +terang 5, +caya 2, surya+
yellow: +kuning 5
pale: +pucat 2
crimson: +merah 3
oak: jati 7, meranti 2
pine: cemara 5
birch: randu 5, kapuk 2
ash: bungur 3, ketapang 3
elm: angsana 3, sengon 2
willow: waru 4, dadap 3
thorn: +duri 5
reed: pandan 5, gelagah 3
rose: mawar 4
apple: jambu 4, mangga 3, maja 4
pear: langsat 3, duku 2
cherry: duku 2, manggis 3
hazel: kemiri 5
alder: +bakau 3, +nipah 3
beech: meranti 4
rowan: kenari 4
maple: surian 3
linden: beringin 4, waringin 4
poplar: randu 3
aspen: kapuk 2
spruce: cemara
cedar: gaharu 3, suren 2
yew: ulin 3
holly: soka 2
ivy: +sirih 4
heather: +lalang 3
nettle: +jelatang 2
flower: bunga 4, kembang 4, sekar+ 5, kusuma+ 3, melati 2, cempaka 3
leaf: daun 3
grass: +rumput 3, +lalang 2
mushroom: +jamur 3
berry: buni 3
wolf: +serigala 3
bear: +beruang 5
eagle: elang 4, rajawali 2, garuda 2
griffin: garuda 5
hawk: elang 4
deer: rusa 5, kijang 4, kidang 2, menjangan 2
horse: kuda 6, jaran 3
ox: +kerbau 4, lembu 3, kebo 3, +sapi 2
bison: banteng 5
sheep: domba 3
ram: domba 2
goat: +kambing 5, +wedus
fox: +musang 4
boar: +celeng 3, +bagong 2, +babi 2
raven: +gagak 5
crow: +gagak 5
swan: angsa 5
goose: angsa 3
crane: bangau 4
stork: bangau 5
heron: +kuntul 4
duck: +itik 5, +bebek 3
dove: merpati 5, dara 2
gull: +camar 5
lark: murai 2
nightingale: murai 4
owl: +pungguk 3
rooster: +ayam 4, +jago 3
fish: ikan 5
eel: +belut 3
pike: +gabus 3
salmon: +semah 2
crab: +ketam 4, +kepiting 2
whale: +paus 3
seal: +duyung 3
otter: +berang 3
toad: +kodok 3, +katak 3
lizard: +biawak 4
serpent: ular 6
dragon: naga 7
lion: singa 7
lynx: macan 4
cat: macan 4, kucing 2
hound: +anjing 4
hare: kancil 4, pelanduk 2
badger: +landak 3
rat: +tikus 3
bat: +kalong 4
bee: lebah 3, tawon 3
kraken: +gurita 2
camel: +unta 2
stone: +batu 10, +watu 2, sela+ 3
iron: +besi 5, wesi+
copper: +tembaga 3
bronze: +perunggu 2
silver: perak 4
gold: +emas 5, kencana 5, +mas 2
salt: +garam 5
sand: +pasir 6
clay: +lempung 3, +liat 2
chalk: +kapur 5
mud: +lumpur 5
coal: +arang 3
tin: +timah 5
steel: +waja 2
marble: +pualam 3
crystal: intan 4
glass: +kaca 2
amber: +ambar 2
pearl: mutiara 5
cold: +dingin 5
warm: +panas 4, +hangat 2
dry: +kering 5, +asat 2
wet: +basah 3
wind: +angin 5, bayu 3
mist: +kabut 4, +pedut
snow: +salju 2
frost: +embun 3
storm: +badai 3, +ribut 2
thunder: guntur 5, +petir
rain: +hujan 4
cloud: +awan 3, mega 3
sky: +langit 4
quiet: +sunyi 3, +sepi 3
wild: +liar 3
fair: +indah 5, +permai 4, sri+ 4, suka+ 6
holy: +suci 4, +keramat 3, sri+ 2
free: +merdeka 2
king: +raja 8, raja+ 4, prabu+ 2
queen: +ratu 5, +putri 2
lord: +tuan 3, +gusti 2, +adipati 2
priest: +resi 3, +pendeta 3, +imam 2
monk: +wiku 3, +biksu 2
merchant: +saudagar 4
hunter: +pemburu 3
fisher: +nelayan 4
smith: +pandai 3, +empu 3
shepherd: +gembala 4
weaver: +tenun 2
archer: +pemanah 2
carpenter: +tukang 2
summer: +kemarau 2
dusk: +senja 4
dawn: +fajar 5
night: +malam 3
sun: surya 5, +matahari 2
moon: +bulan 5, candra+ 4, wulan 2
star: +bintang 5, kartika 2, lintang 2
shadow: +bayang 3
fire: +api 5
ember: +bara 4
cinder: +abu 3
smoke: +asap 3
blood: +darah 3
bone: +tulang 3
skull: +tengkorak 2
dust: +debu 2
honey: madu 5
milk: +susu
wine: +tuak 3
wheat: padi 6
barley: jelai 3
rye: jali 2
hay: +jerami 3
flax: rami 3
pea: +kacang 3
last: +akhir 2
far: +jauh 4
lone: +tunggal 6
lost: +hilang 4
hidden: +sembunyi 3
broken: +pecah 4, +patah 3, +belah 2
burnt: +bakar 4, +hangus 3
drowned: +karam 4, +tenggelam 2
bitter: +pahit 4
sweet: +manis 6, wangi+ 2
hard: +keras 3
strong: +kuat 3, +sakti 2
sharp: +tajam 3
dread: +ngeri 2
grim: +seram 2
merry: suka+ 8, +riang 2
weeping: +tangis 3
whispering: +bisik 2
haunted: +angker 3
sleeping: +tidur 3
wandering: +kelana 3
singing: +tembang 3
crooked: +bengkok 4
barren: +gundul 4, +tandus 2
bleak: +gersang 2
proud: +megah 3
rich: +makmur 3, +subur 3, kerta+ 4
poor: +miskin 2
cursed: +kutuk
blessed: +rahayu 4, +berkah 2, sida+ 4
narrow: +sempit 4
steep: +curam 3, +terjal 2
flat: +datar 5, +rata 4
round: +bulat 3, +bunder 3
swift: +deras 4
clear: +jernih 4, +bening 4
true: +setia 3
dead: +mati 5
lucky: +untung 4, sida+ 4
dun: +sawo
lady: +nyai 2, +dayang 3
maiden: +putri 4, +gadis 2, +perawan
widow: +janda 3
knight: satria 4
warrior: satria 3, +hulubalang 2
warden: +penjaga 2
hermit: +pertapa 4
pilgrim: +musafir 3
witch: +dukun 3
giant: +raksasa 4
ghost: +hantu 4
god: dewa 4, dewata 4, batara 3
devil: +setan 3, +iblis
thief: +maling 4
robber: +penyamun 3, +rampok 2
raider: +lanun 3
sailor: +pelaut 2
elder: +datuk 4, +penghulu 3
orphan: +yatim 2
friend: +kawan 2
sword: +keris 4, +pedang 3
axe: +kapak 3
hammer: +palu 2
arrow: +panah 4
bell: +genta 4
harp: +kecapi 2
cup: +cawan 2
wheel: +roda 2
ring: +cincin 2
candle: +pelita 3
anchor: +sauh 3
sail: +layar 4
boat: +perahu 4, +sampan 2
ship: +kapal 3, +jung 3
feast: +kenduri 2
treasure: +mustika 4, +permata 3
feather: +bulu 2
wing: +sayap 2
peace: +damai 3, +sentosa 3
glory: jaya+ 5, +mulia 3
love: +kasih 3, +asih 2
victory: jaya+ 4, wijaya+ 4
wonder: +ajaib 2

# numerals
two: +dua 5, dwi+
three: +tiga 5, tri+ 2
five: +lima 5, panca+
seven: +tujuh 5, +pitu 2, sapta+
nine: +sembilan 4, +sanga 2
ten: +sepuluh 3, dasa+
hundred: +seratus 3, +satus 2
thousand: +seribu 5, +sewu 3

# lands
land: tanah+ 6, bumi+ 4, +negara 6, +buana 2, ranah+ 2, tatar+ 2
country: negeri+ 5, +nagara 2
realm: +loka 2, benua+ 2
domain: kadipaten+ 2
coast: pesisir+ 4, pantai+
isles: nusa+ 6, +dwipa 4, kepulauan+
`,
  settled: 0.72,
  patterns: {
    feature: { weight: 10 },
    "modifier-generic": { weight: 45, templates: "{generic}{modifier} 5, {modifier}{generic} 7" },
    "owner-generic": { weight: 20, female: 0.12, templates: "{root}{generic} 4, {generic}{root} 4" },
    "generic-of": {
      weight: 14,
      templates: "{generic}{root} 3, kuala {root} 2, muara {root} 2, hulu {root}, {root}{generic}"
    },
    compound: { weight: 10, templates: "{generic}{modifier} 5, {settlement}{generic}{modifier}, {modifier}{generic}" },
    relative: { weight: 6, templates: "{root} {modifier}" },
    "root-land": { templates: "{root}{generic} 5, {generic}{root} 4" },
    "modifier-land": { templates: "{generic}{modifier} 5, {modifier}{generic} 4" }
  }
};
