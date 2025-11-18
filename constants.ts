// Fix: Replaced the incorrect content of constants.ts with the correct constant definitions.
// The original file had a circular dependency and duplicated type definitions.
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'KES'] as const;

export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CAD: '$',
  AUD: '$',
  KES: 'KSh',
};

export const COLORS = [
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff8042',
  '#0088fe',
  '#00c49f',
  '#ffbb28',
  '#ff82a9',
  '#a0eade',
  '#d0bdf4',
  '#f7caca',
  '#f7d794',
];

export const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investment',
  'Gift',
  'Savings Withdrawal',
  'Other',
];

export const EXPENSE_CATEGORIES = [
  'Food',
  'Housing',
  'Transport',
  'Utilities',
  'Entertainment',
  'Health',
  'Shopping',
  'Education',
  'Savings Contribution',
  'Other',
];

export const SECURITY_QUESTIONS = [
  "What was your first pet's name?",
  "In what city were you born?",
  "What is your mother's maiden name?",
  "What was the name of your elementary school?",
  "What is your favorite book?",
  "What was the model of your first car?",
];