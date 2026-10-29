/** The named culture sets the user picks from: how many cultures each holds and how often it is rolled */
export const CULTURE_SETS: Record<string, { name: string; max: number; probability: number }> = {
  world: { name: "All-world", max: 32, probability: 10 },
  european: { name: "European", max: 15, probability: 10 },
  oriental: { name: "Oriental", max: 13, probability: 2 },
  english: { name: "English", max: 10, probability: 5 },
  antique: { name: "Antique", max: 10, probability: 3 },
  highFantasy: { name: "High Fantasy", max: 17, probability: 11 },
  darkFantasy: { name: "Dark Fantasy", max: 18, probability: 3 },
  random: { name: "Random", max: 100, probability: 1 },
  astralTrek: { name: "AstralTrek", max: 100, probability: 5 },
  astralJammer: { name: "AstralJammer", max: 100, probability: 4 },
  grimdark: { name: "Grimdark", max: 100, probability: 3 },
  rpgFantasy: { name: "RPG Fantasy", max: 100, probability: 4 }
};
