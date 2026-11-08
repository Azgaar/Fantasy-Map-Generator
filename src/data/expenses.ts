/** What a state spends its taxes on, buying goods during the economy run */
export const EXPENSES = ["court", "administration", "infrastructure", "military"] as const;
export type Expense = (typeof EXPENSES)[number];

export const noExpenses = (): Record<Expense, number> => ({
  court: 0,
  administration: 0,
  infrastructure: 0,
  military: 0
});
