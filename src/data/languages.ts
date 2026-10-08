/** The interface languages the app ships, each by its own name; a locale file `src/locales/<code>.json` backs each */
export const LANGUAGES = {
  en: "English",
  ru: "Русский",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  af: "Afrikaans",
  pl: "Polski",
  it: "Italiano",
  pt: "Português (Portugal)",
  "pt-BR": "Português (Brasil)",
  nl: "Nederlands",
  ja: "日本語",
  uk: "Українська",
  zh: "简体中文"
} as const;

export type Language = keyof typeof LANGUAGES;
export const LANGUAGE_CODES = Object.keys(LANGUAGES) as [Language, ...Language[]];

export const isLanguage = (code: unknown): code is Language =>
  typeof code === "string" && Object.hasOwn(LANGUAGES, code);
