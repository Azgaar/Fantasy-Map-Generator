// Colors and tones every economy view shares

export const ECONOMY_COLORS = {
  positive: "#1b7a43", // money gained: income, surpluses, exports; the .positive class in index.css
  negative: "#a34a14", // money paid out: costs, deficits, imports; the .negative class in index.css
  spent: "var(--header)", // a share of a state's taxes its expenses spend
  pocketed: "#b4b4b4", // the part officials pocket
  empty: "#e8e8e8"
};

/** Badge colors by kind, [background, text]: where goods come from and what a burg did with them */
export const BADGE_COLORS = {
  local: ["#d9e7f5", "#346"],
  buy: ["#f5d9d6", "#a33"],
  mfg: ["#f8e7bf", "#b67a00"],
  sell: ["#dff0e2", "#2f8a46"],
  keep: ["#e6e0f2", "#5a4a8a"],
  need: ["#e4e4e4", "#555"]
} as const;

/** The tone class of an amount: positive for a gain, negative for a loss */
export const tone = (value: number) => (value >= 0 ? "positive" : "negative");

/** CSS background for a share of the taxes on a 0–100% track: the part spent, the part officials pocket grayed, the rest empty */
export function budgetBackground(share: number, corruption: number, color = ECONOMY_COLORS.spent): string {
  const kept = (share * (100 - corruption)) / 100;
  const { pocketed, empty } = ECONOMY_COLORS;
  return `linear-gradient(to right, ${color} 0 ${kept}%, ${pocketed} ${kept}% ${share}%, ${empty} ${share}% 100%)`;
}
