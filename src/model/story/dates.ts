// Event dates as text: "120", "120-03", "120-03-14", "120-03-14T10:00"; the year a plain whole number, negative before the era.
// The only code that reads or writes that text. See docs/prd/events.md#dates
import { Catalog, t } from "@/utils/i18n";

export interface DateParts {
  year: number;
  month?: number; // 1–12
  day?: number;
  hour?: number;
  minute?: number;
}

type DateStyle = "short" | "long" | "brief";

const PATTERN = /^(-?\d+)(?:-(\d{2})(?:-(\d{2})(?:T(\d{2}):(\d{2}))?)?)?$/;
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // the common calendar, no leap day
const DAYS_BEFORE = MONTH_DAYS.map((_, month) => MONTH_DAYS.slice(0, month).reduce((a, b) => a + b, 0));
const YEAR_DAYS = 365;

const pad = (value: number) => String(value).padStart(2, "0");

/** How many parts are known: 1 the year, 2 the month, 3 the day, 4 the time */
const precision = (parts: DateParts): number =>
  parts.hour !== undefined ? 4 : parts.day !== undefined ? 3 : parts.month !== undefined ? 2 : 1;

/** Parts as numbers to compare, missing ones as the first */
const key = (parts: DateParts, depth = 4): number[] =>
  [parts.year, parts.month ?? 1, parts.day ?? 1, (parts.hour ?? 0) * 60 + (parts.minute ?? 0)].slice(0, depth);

const dayNumber = ({ year, month = 1, day = 1 }: DateParts): number => year * YEAR_DAYS + DAYS_BEFORE[month - 1] + day;

class DatesModule {
  private readonly months = new Map<string, string[]>(); // by language and width, worded once

  /** The parts of a date, or null when the text is not one */
  parse(date: string | undefined): DateParts | null {
    const match = typeof date === "string" ? PATTERN.exec(date) : null;
    if (!match) return null;
    const [year, month, day, hour, minute] = match.slice(1).map(part => (part === undefined ? undefined : +part));
    const parts: DateParts = { year: year! };
    if (month !== undefined) parts.month = month;
    if (day !== undefined) parts.day = day;
    if (hour !== undefined) Object.assign(parts, { hour, minute });
    return this.isValid(parts) ? parts : null;
  }

  /** The parts of a date; throws a readable error when the text is not one */
  require(date: string): DateParts {
    const parts = this.parse(date);
    if (!parts) throw new Error(`"${date}" is not a date: write a year such as 120, or 120-03-14, or 120-03-14T10:00`);
    return parts;
  }

  /** The text of the parts, as exact as they are given: a day needs a month, a time a day */
  write(parts: DateParts): string {
    let text = String(Math.trunc(parts.year));
    if (parts.month === undefined) return text;
    text += `-${pad(parts.month)}`;
    if (parts.day === undefined) return text;
    text += `-${pad(parts.day)}`;
    if (parts.hour === undefined) return text;
    return `${text}T${pad(parts.hour)}:${pad(parts.minute ?? 0)}`;
  }

  isValid(parts: DateParts): boolean {
    const { year, month, day, hour, minute } = parts;
    if (!Number.isSafeInteger(year)) return false;
    if (month === undefined) return day === undefined && hour === undefined;
    if (!Number.isInteger(month) || month < 1 || month > 12) return false;
    if (day === undefined) return hour === undefined;
    if (!Number.isInteger(day) || day < 1 || day > MONTH_DAYS[month - 1]) return false;
    if (hour === undefined) return minute === undefined;
    return Number.isInteger(hour) && hour >= 0 && hour < 24 && Number.isInteger(minute) && minute! >= 0 && minute! < 60;
  }

  /** A year alone */
  ofYear(year: number): string {
    return String(Math.round(year));
  }

  year(date: string): number {
    return this.require(date).year;
  }

  /** Negative when a comes first; missing parts count as the first */
  compare(a: string, b: string): number {
    return this.compareKeys(key(this.require(a)), key(this.require(b)));
  }

  /** As `compare`, but only as exactly as the less exact of the two */
  compareLoosely(a: string, b: string): number {
    const [pa, pb] = [this.require(a), this.require(b)];
    const depth = Math.min(precision(pa), precision(pb));
    return this.compareKeys(key(pa, depth), key(pb, depth));
  }

  /** The same date some years later; the month, day and time stay */
  shift(date: string, years: number): string {
    const parts = this.require(date);
    return this.write({ ...parts, year: parts.year + years });
  }

  /** A day of the year, counted from 0, as its month and day */
  ofDay(day: number): Required<Pick<DateParts, "month" | "day">> {
    const index = ((Math.floor(day) % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS;
    const month = DAYS_BEFORE.findLastIndex(before => before <= index);
    return { month: month + 1, day: index - DAYS_BEFORE[month] + 1 };
  }

  /** A date given to the minute, some minutes later */
  addMinutes(date: string, minutes: number): string {
    const parts = this.require(date);
    if (parts.hour === undefined) throw new Error(`"${date}" gives no time to add minutes to`);
    const total = (dayNumber(parts) - 1) * 1440 + parts.hour * 60 + (parts.minute ?? 0) + Math.round(minutes);
    const days = Math.floor(total / 1440);
    const year = Math.floor(days / YEAR_DAYS);
    const rest = total - days * 1440;
    return this.write({ year, ...this.ofDay(days - year * YEAR_DAYS), hour: Math.floor(rest / 60), minute: rest % 60 });
  }

  /** Minutes from one date to another, both given to the minute; null when either gives no time */
  minutesBetween(start: string, end: string): number | null {
    const [from, to] = [this.require(start), this.require(end)];
    if (precision(from) < 4 || precision(to) < 4) return null;
    return (dayNumber(to) - dayNumber(from)) * 1440 + key(to)[3] - key(from)[3];
  }

  /** The day of the year a date falls on, counted from 0; missing parts count as the first */
  dayOfYear(date: string): number {
    const { month = 1, day = 1 } = this.require(date);
    return DAYS_BEFORE[month - 1] + day - 1;
  }

  /** Whether the date gives a day */
  hasDay(date: string): boolean {
    return precision(this.require(date)) >= 3;
  }

  /** The length from start to end, worded: in days, months or years when both give a day, else in years;
   * under a day in hours or minutes when both give a time */
  formatLength(start: string, end: string): string {
    const [from, to] = [this.require(start), this.require(end)];
    if (precision(from) >= 3 && precision(to) >= 3) {
      const days = dayNumber(to) - dayNumber(from);
      const minutes = this.minutesBetween(start, end);
      if (minutes !== null && minutes < 1440) {
        if (minutes >= 60) return t("{{count}} hours", { count: Math.floor(minutes / 60) });
        return t("{{count}} minutes", { count: Math.max(minutes, 1) });
      }
      if (days >= YEAR_DAYS) return t("{{count}} years", { count: Math.floor(days / YEAR_DAYS) });
      if (days >= 30) return t("{{count}} months", { count: Math.floor(days / 30) });
      return t("{{count}} days", { count: Math.max(days, 1) });
    }
    const years = to.year - from.year;
    return years > 0 ? t("{{count}} years", { count: years }) : t("under a year");
  }

  /** "14 March 120 WE, 10:00": as exact as it was given; a year before the era as "45 BWE".
   * "long" names the era in full: "45 before Winter Era". "brief", for tables: "14 Mar 120", no time, the era only before it.
   * Generated map text passes "en": what enters the map stays English */
  format(date: string, style: DateStyle = "short", language = Catalog.language): string {
    const parts = this.parse(date);
    if (!parts) return date;
    const brief = style === "brief";
    const day = parts.day === undefined ? "" : `${parts.day} `;
    const month = parts.month === undefined ? "" : `${this.monthName(parts.month, language, brief)} `;
    const time = parts.hour === undefined || brief ? "" : `, ${pad(parts.hour)}:${pad(parts.minute ?? 0)}`;
    return `${day}${month}${this.wordYear(parts.year, style, language)}${time}`;
  }

  /** "117 – 120", "117 –" while it goes on, one date when it happened at one time; the day once when it began and
   * ended on it: "14 March 120 WE, 10:00 – 10:40" */
  formatRange(start: string, end?: string, style: DateStyle = "short"): string {
    if (end === undefined) return `${this.format(start, style)} –`;
    if (end === start) return this.format(start, style);
    const [from, to] = [this.require(start), this.require(end)];
    const sameDay = precision(from) === 4 && precision(to) === 4 && dayNumber(from) === dayNumber(to);
    if (sameDay) return `${this.format(start, style)} – ${pad(to.hour!)}:${pad(to.minute ?? 0)}`;
    return `${this.format(start, style)} – ${this.format(end, style)}`;
  }

  /** The month's name, in the interface's language unless another is given, worded by the browser for an ordinary year */
  monthName(month: number, language = Catalog.language, short = false): string {
    const key = `${language}:${short}`;
    if (!this.months.has(key)) {
      const format = new Intl.DateTimeFormat(language, { month: short ? "short" : "long", timeZone: "UTC" });
      this.months.set(
        key,
        MONTH_DAYS.map((_, i) => format.format(Date.UTC(2001, i, 1)))
      );
    }
    return this.months.get(key)![month - 1];
  }

  /** A number to sort dates by, missing parts as the first */
  sortKey(date: string): number {
    const [year, month, day, minutes] = key(this.require(date));
    return ((year * 13 + month) * 32 + day) * 1440 + minutes;
  }

  /** Days in a month of the common calendar */
  monthDays(month: number): number {
    return MONTH_DAYS[month - 1] ?? 31;
  }

  private wordYear(year: number, style: DateStyle, language: string): string {
    const { era, eraShort } = options.map.lore.calendar;
    if (year >= 0) return style === "brief" ? String(year) : `${year} ${style === "long" ? era : eraShort}`;
    if (style !== "long") return `${-year} B${eraShort}`;
    return language === "en" ? `${-year} before ${era}` : t("{{year}} before {{era}}", { year: -year, era });
  }

  private compareKeys(a: number[], b: number[]): number {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
    return 0;
  }
}

export const Dates = new DatesModule();
