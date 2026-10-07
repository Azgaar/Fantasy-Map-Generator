import { afterEach, describe, expect, it } from "vitest";
import { Catalog, t } from "./i18n";

const ENGLISH = {
  "{{count}} burgs_one": "{{count}} burg",
  "{{count}} burgs_other": "{{count}} burgs",
  "about.intro": "FMG is an open source tool"
};

const RUSSIAN = {
  Rivers: "Реки",
  Close_distance: "Близко",
  "{{count}} burgs_one": "{{count}} город",
  "{{count}} burgs_few": "{{count}} города",
  "{{count}} burgs_many": "{{count}} городов",
  "{{layer}}: click to toggle": "{{layer}}: нажмите, чтобы переключить",
  Empty: ""
};

afterEach(() => Catalog.use("en", {}));

describe("t", () => {
  it("returns the English key itself when nothing is loaded", () => {
    expect(t("Rivers")).toBe("Rivers");
    expect(Catalog.language).toBe("en");
  });

  it("translates through the active language, then English, then the key", () => {
    Catalog.use("ru", RUSSIAN, ENGLISH);
    expect(t("Rivers")).toBe("Реки");
    expect(t("about.intro")).toBe("FMG is an open source tool");
    expect(t("Lakes")).toBe("Lakes");
  });

  it("treats an empty translation as missing", () => {
    Catalog.use("ru", RUSSIAN, ENGLISH);
    expect(t("Empty")).toBe("Empty");
  });

  it("picks the meaning by context, an untranslated one staying English rather than taking another meaning", () => {
    Catalog.use("ru", { ...RUSSIAN, Close: "Закрыть" }, { ...ENGLISH, Close_button: "Close" });
    expect(t("Close", { context: "distance" })).toBe("Близко");
    expect(t("Close", { context: "button" })).toBe("Close");
  });

  it("chooses the language's plural form and fills the count", () => {
    Catalog.use("ru", RUSSIAN, ENGLISH);
    expect(t("{{count}} burgs", { count: 1 })).toBe("1 город");
    expect(t("{{count}} burgs", { count: 3 })).toBe("3 города");
    expect(t("{{count}} burgs", { count: 11 })).toBe("11 городов");
    expect(t("{{count}} burgs", { count: 21 })).toBe("21 город");
  });

  it("falls back to English plurals chosen by English rules", () => {
    Catalog.use("ru", {}, ENGLISH);
    expect(t("{{count}} burgs", { count: 1 })).toBe("1 burg");
    expect(t("{{count}} burgs", { count: 3 })).toBe("3 burgs");
  });

  it("escapes interpolated values and leaves unknown placeholders alone", () => {
    Catalog.use("ru", RUSSIAN, ENGLISH);
    expect(t("{{layer}}: click to toggle", { layer: "<b>Реки</b>" })).toBe(
      "&lt;b&gt;Реки&lt;/b&gt;: нажмите, чтобы переключить"
    );
    expect(t("{{layer}}: click to toggle")).toBe("{{layer}}: нажмите, чтобы переключить");
  });

  it("loads a shipped language from its locale file", async () => {
    await Catalog.load("ru");
    expect(Catalog.language).toBe("ru");
    expect(t("Rivers")).toBe("Реки");
  });
});
