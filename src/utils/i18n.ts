// Interface text catalog: strings keyed by their English text, i18next v4 JSON shape. See docs/prd/translation.md
import { escapeHtml } from "./stringUtils";

export type Strings = Record<string, string>;

export interface TranslateOptions {
  /** disambiguates the same English text with different meanings: "Close" + "button" */
  context?: string;
  /** picks the plural form and fills `{{count}}` */
  count?: number;
  /** values for the other placeholders: `{{name}}` is HTML-escaped, `{{- name}}` inserted as is (markup, or a text-only sink) */
  [value: string]: string | number | null | undefined;
}

const loaders = import.meta.glob<Strings>("../locales/*.json", { import: "default" });
const loadStrings = (code: string): Promise<Strings> => loaders[`../locales/${code}.json`]?.() ?? Promise.resolve({});

const ENGLISH_PLURALS = new Intl.PluralRules("en");

let language = "en";
let active: Strings = {};
let english: Strings = {};
let plurals = ENGLISH_PLURALS;

export const Catalog = {
  /** The language the interface is shown in */
  get language(): string {
    return language;
  },

  /** Load a language's strings with the English ones behind them; resolves before any `t()` that should see them */
  async load(code: string): Promise<void> {
    const [en, strings] = await Promise.all([loadStrings("en"), code === "en" ? {} : loadStrings(code)]);
    this.use(code, strings, en);
  },

  /** Put already loaded strings to use */
  use(code: string, strings: Strings, en: Strings = {}): void {
    language = code;
    active = strings;
    english = en;
    plurals = new Intl.PluralRules(code);
  }
};

/** Translate interface text written in English; untranslated text falls back to English */
export function t(key: string, options: TranslateOptions = {}): string {
  const { context, count, ...values } = options;
  const base = context ? `${key}_${context}` : key;
  const text = lookup(active, base, count, plurals) ?? lookup(english, base, count, ENGLISH_PLURALS) ?? key;
  return interpolate(text, count === undefined ? values : { ...values, count });
}

function lookup(strings: Strings, base: string, count: number | undefined, rules: Intl.PluralRules) {
  const plural = count === undefined ? "" : strings[`${base}_${rules.select(count)}`] || strings[`${base}_other`];
  return plural || strings[base] || undefined;
}

function interpolate(text: string, values: Record<string, string | number | null | undefined>): string {
  return text.replace(/{{\s*(-)?\s*(\w+)\s*}}/g, (placeholder, raw: string | undefined, name: string) => {
    const value = values[name];
    if (value === undefined) return placeholder;
    if (value === null) return "";
    return raw ? String(value) : escapeHtml(String(value));
  });
}

const CJK_END = /[\u3000-\u9fff\uff00-\uffef]$/; // CJK text ends a sentence with 。 and joins the next one without a space
const TERMINATED = /[.!?…:。！？：]$/;

/** Join translated sentences into one text, each sentence a catalog string of its own: `sentences(t("Name"), t("Click to change"))` */
export function sentences(...parts: string[]): string {
  return parts.reduce((text, part) => {
    if (!TERMINATED.test(text)) text += CJK_END.test(text) ? "。" : ".";
    return text + (CJK_END.test(text) ? "" : " ") + part;
  });
}
