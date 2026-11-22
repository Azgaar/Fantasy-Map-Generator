import type { NameBase } from ".";

export const arabic: NameBase = {
  id: "arabic",
  name: "Arabic",
  length: [4, 9],
  // biome-ignore format: a corpus reads as one line
  places: { names: ["Abha", "Ajman", "Alabar", "Alarjam", "Alashraf", "Alawali", "Albawadi", "Albirk", "Aldhabiyah", "Alduwaid", "Alfareeq", "Algayed", "Alhazim", "Alhrateem", "Alhudaydah", "Alhuwaya", "Aljahra", "Aljubail", "Alkhafah", "Alkhalas", "Alkhawaneej", "Alkhen", "Alkhobar", "Alkhuznah", "Allisafah", "Almshaykh", "Almurjan", "Almuwayh", "Almuzaylif", "Alnaheem", "Alnashifah", "Alqah", "Alqouz", "Alqurayyat", "Alradha", "Alraqmiah", "Alsadyah", "Alsafa", "Alshagab", "Alshuqaiq", "Alsilaa", "Althafeer", "Alwasqah", "Amaq", "Amran", "Annaseem", "Aqbiyah", "Arafat", "Arar", "Ardah", "Asfan", "Ashayrah", "Askar", "Ayaar", "Aziziyah", "Baesh", "Bahrah", "Balhaf", "Banizayd", "Bidiyah", "Bisha", "Biyatah", "Buqhayq", "Burayda", "Dafiyat", "Damad", "Dammam", "Dariyah", "Dhafar", "Dhahran", "Dhalkut", "Dhurma", "Dibab", "Doha", "Dukhan", "Duwaibah", "Enaker", "Fadhla", "Fahaheel", "Fanateer", "Farasan", "Fardah", "Fujairah", "Ghalilah", "Ghar", "Ghizlan", "Ghomgyah", "Ghran", "Hadiyah", "Haffah", "Hajanbah", "Hajrah", "Haqqaq", "Haradh", "Hasar", "Hawiyah", "Hebaa", "Hefar", "Hijal", "Husnah", "Huwailat", "Huwaitah", "Irqah", "Isharah", "Ithrah", "Jamalah", "Jarab", "Jareef", "Jazan", "Jeddah", "Jiblah", "Jihanah", "Jilah", "Jizan", "Joraibah", "Juban", "Jumeirah", "Kamaran", "Keyad", "Khab", "Khaiybar", "Khasab", "Khathirah", "Khawarah", "Khulais", "Kumzar", "Limah", "Linah", "Madrak", "Mahab", "Mahalah", "Makhtar", "Mashwar", "Masirah", "Masliyah", "Mastabah", "Mazhar", "Medina", "Meeqat", "Mirbah", "Mokhtara", "Muharraq", "Muladdah", "Musaykah", "Mushayrif", "Musrah", "Mussafah", "Nafhan", "Najran", "Nakhab", "Nizwa", "Oman", "Qadah", "Qalhat", "Qamrah", "Qasam", "Qosmah", "Qurain", "Quriyat", "Qurwa", "Radaa", "Rafha", "Rahlah", "Rakamah", "Rasheedah", "Rasmadrakah", "Risabah", "Rustaq", "Ryadh", "Sabtaljarah", "Sadah", "Safinah", "Saham", "Saihat", "Salalah", "Salmiya", "Shabwah", "Shalim", "Shaqra", "Sharjah", "Sharurah", "Shatifiyah", "Shidah", "Shihar", "Shoqra", "Shuwaq", "Sibah", "Sihmah", "Sinaw", "Sirwah", "Sohar", "Suhailah", "Sulaibiya", "Sunbah", "Tabuk", "Taif", "Taqah", "Tarif", "Tharban", "Thuqbah", "Thuwal", "Tubarjal", "Turaif", "Turbah", "Tuwaiq", "Ubar", "Umaljerem", "Urayarah", "Urwah", "Wabrah", "Warbah", "Yabreen", "Yadamah", "Yafur", "Yarim", "Yemen", "Yiyallah", "Zabid", "Zahwah", "Zallaq", "Zinjibar", "Zulumah"] },
  // biome-ignore format: a corpus reads as one line
  people: { male: { mode: "pick", names: ["Muhammad", "Ahmad", "Ali", "Umar", "Uthman", "Hasan", "Husayn", "Khalid", "Hamza", "Abbas", "Harun", "Mamun", "Mutasim", "Mansur", "Mahdi", "Hadi", "Amin", "Walid", "Sulayman", "Hisham", "Yazid", "Marwan", "Muawiya", "Abdallah", "Abdulmalik", "Abdulrahman", "Ibrahim", "Ismail", "Ishaq", "Yaqub", "Yusuf", "Musa", "Isa", "Dawud", "Zakariya", "Yahya", "Salih", "Tariq", "Saladin", "Nuruddin", "Baybars", "Qutuz", "Qalawun", "Zayd", "Zubayr", "Talha", "Saad", "Bilal", "Anas", "Jafar", "Hashim", "Idris", "Karim", "Rashid", "Salim", "Faysal", "Nasir", "Mahmud", "Jamal", "Kamal"] }, female: { mode: "pick", names: ["Fatima", "Aisha", "Khadija", "Zaynab", "Maryam", "Ruqayya", "Hafsa", "Safiyya", "Sumayya", "Asma", "Layla", "Salma", "Zubayda", "Khayzuran", "Shajar", "Rabia", "Nafisa", "Amina", "Halima", "Hind", "Jamila", "Karima", "Latifa", "Nadia", "Rania", "Samira", "Yasmin", "Zahra", "Noor", "Lubna"] } },
  rules: [
    { match: "([^ae])\\1+", replace: "$1" },
    { match: "^al (?=[aeiou])", replace: "al", at: "join" }
  ],
  lexicon: {
    land: [
      { form: "a", weight: 8, position: "last" },
      { form: "ia", weight: 2, position: "last" }
    ]
  },
  patterns: {
    "root-land": {
      templates: [
        { parts: "{root}{generic}", weight: 6 },
        { parts: "al {root}{generic}", weight: 4 }
      ]
    }
  }
};
