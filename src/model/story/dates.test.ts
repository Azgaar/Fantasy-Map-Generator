import { beforeEach, describe, expect, it } from "vitest";
import { Dates } from "./dates";

beforeEach(() => {
  globalThis.options = { map: { lore: { calendar: { year: 120, era: "Winter Era", eraShort: "WE" } } } } as any;
});

describe("Dates", () => {
  it("reads every form and writes it back unchanged", () => {
    for (const date of ["120", "120-03", "120-03-14", "120-03-14T10:00", "-45", "0", "34", "10123-03-14"])
      expect(Dates.write(Dates.parse(date)!)).toBe(date);
    expect(Dates.parse("-45")).toEqual({ year: -45 });
    expect(Dates.parse("120-3")).toBeNull();
    expect(Dates.parse("0120")).toEqual({ year: 120 });
  });

  it("refuses dates the calendar has not", () => {
    expect(Dates.parse("120-02-29")).toBeNull();
    expect(Dates.parse("120-13")).toBeNull();
    expect(Dates.parse("120-04-31")).toBeNull();
    expect(Dates.parse("120-03-14T24:00")).toBeNull();
    expect(Dates.parse("March 120")).toBeNull();
  });

  it("orders across forms, missing parts as the first", () => {
    const sorted = ["120-03-14T10:00", "-45", "120", "99", "120-01-01", "120-03", "10123"].sort(
      Dates.compare.bind(Dates)
    );
    expect(sorted).toEqual(["-45", "99", "120", "120-01-01", "120-03", "120-03-14T10:00", "10123"]);
    expect(Dates.compare("120", "120-01-01T00:00")).toBe(0);
  });

  it("compares an end with its start at the less exact of the two", () => {
    expect(Dates.compareLoosely("120", "120-03-01")).toBe(0);
    expect(Dates.compareLoosely("120-02", "120-03-01")).toBeLessThan(0);
    expect(Dates.compareLoosely("119", "120-03-01")).toBeLessThan(0);
  });

  it("shifts by years and keeps the month, day and time", () => {
    expect(Dates.shift("120-03-14T10:00", 300)).toBe("420-03-14T10:00");
    expect(Dates.shift("20", -50)).toBe("-30");
  });

  it("gives lengths in days, months or years, never zero years", () => {
    expect(Dates.formatLength("120-03-01", "120-04-10")).toBe("1 month");
    expect(Dates.formatLength("120-03-01", "120-03-11")).toBe("10 days");
    expect(Dates.formatLength("120-03-01", "123-03-02")).toBe("3 years");
    expect(Dates.formatLength("120", "120")).toBe("under a year");
    expect(Dates.formatLength("117", "120-05-01")).toBe("3 years");
  });

  it("adds minutes over midnight and the new year, and words lengths under a day", () => {
    expect(Dates.ofDay(0)).toEqual({ month: 1, day: 1 });
    expect(Dates.ofDay(364)).toEqual({ month: 12, day: 31 });
    expect(Dates.ofDay(59)).toEqual({ month: 3, day: 1 });
    expect(Dates.addMinutes("120-03-14T09:00", 95)).toBe("120-03-14T10:35");
    expect(Dates.addMinutes("120-12-31T23:30", 45)).toBe("121-01-01T00:15");
    expect(Dates.addMinutes("-1-12-31T23:30", 45)).toBe("0-01-01T00:15");
    expect(Dates.formatLength("120-03-14T09:00", "120-03-14T09:40")).toBe("40 minutes");
    expect(Dates.formatLength("120-03-14T22:00", "120-03-15T01:10")).toBe("3 hours");
    expect(Dates.formatLength("120-03-14T09:00", "120-03-16T09:00")).toBe("2 days");
    expect(Dates.minutesBetween("120-03-14T22:00", "120-03-15T01:10")).toBe(190);
    expect(Dates.minutesBetween("120-03-14", "120-03-15T01:10")).toBeNull();
    expect(Dates.dayOfYear("120")).toBe(0);
    expect(Dates.dayOfYear("120-03-01T10:00")).toBe(59);
  });

  it("words the day once for a range within it", () => {
    expect(Dates.formatRange("120-03-14T10:00", "120-03-14T10:40")).toBe("14 March 120 WE, 10:00 – 10:40");
    expect(Dates.formatRange("120-03-14T23:00", "120-03-15T01:00")).toBe(
      "14 March 120 WE, 23:00 – 15 March 120 WE, 01:00"
    );
    expect(Dates.formatRange("-45", "-38", "long")).toBe("45 before Winter Era – 38 before Winter Era");
  });

  it("words a date as exactly as it was given", () => {
    expect(Dates.format("120")).toBe("120 WE");
    expect(Dates.format("120-03")).toBe("March 120 WE");
    expect(Dates.format("120-03-14T10:00")).toBe("14 March 120 WE, 10:00");
    expect(Dates.formatRange("117")).toBe("117 WE –");
    expect(Dates.formatRange("117", "120")).toBe("117 WE – 120 WE");
  });

  it("words a year before the era by the era, not with a minus", () => {
    expect(Dates.format("-45")).toBe("45 BWE");
    expect(Dates.format("-45", "long")).toBe("45 before Winter Era");
    expect(Dates.format("-45-03-14", "brief")).toBe("14 Mar 45 BWE");
    expect(Dates.format("120-03-14T10:00", "brief")).toBe("14 Mar 120");
    expect(Dates.format("120-03-14T10:00", "long")).toBe("14 March 120 Winter Era, 10:00");
    expect(Dates.format("0")).toBe("0 WE");
  });
});
