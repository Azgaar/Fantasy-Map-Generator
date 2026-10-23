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
  id: "Bahasa Indonesia",
  ja: "日本語",
  uk: "Українська",
  zh: "简体中文",
  "zh-TW": "繁體中文",
  tr: "Türkçe",
  ko: "한국어",
  cs: "Čeština",
  hu: "Magyar",
  sv: "Svenska",
  da: "Dansk",
  ro: "Română",
  vi: "Tiếng Việt",
  th: "ไทย",
  el: "Ελληνικά",
  bg: "Български",
  hi: "हिन्दी",
  bn: "বাংলা",
  be: "Беларуская"
} as const;

export type Language = keyof typeof LANGUAGES;
export const LANGUAGE_CODES = Object.keys(LANGUAGES) as [Language, ...Language[]];

export const isLanguage = (code: unknown): code is Language =>
  typeof code === "string" && Object.hasOwn(LANGUAGES, code);
