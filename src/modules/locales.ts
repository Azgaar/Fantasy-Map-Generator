import i18next from "i18next";
import i18nextHTTPBackend from "i18next-http-backend";
import { isVowel } from "../utils";

function updateLabels() {
  for (const label of document.querySelectorAll("[data-html]")) {
    const translation = i18next.t(label.getAttribute("data-html") as string);
    if (translation) label.innerHTML = translation;
  }
  for (const label of document.querySelectorAll("[data-text]")) {
    const translation = i18next.t(label.getAttribute("data-text") as string);
    if (translation) label.textContent = translation;
  }
  for (const tip of document.querySelectorAll("[data-tip]")) {
    const translation = i18next.t(tip.getAttribute("data-tip") as string);
    if (translation) tip.setAttribute("data-tip", translation);
  }
}

function addFormatters() {
  i18next.services.formatter?.add("gender", (value, lng, options) => {
    if (lng !== "fr") return value;
    else if (options.gender === "feminine") {
      return value.endsWith("en") ? `${value}ne` : `${value}e`;
    } else return value;
  });

  i18next.services.formatter?.add("of", (value, lng) => {
    if (lng !== "fr") return value;
    else if (isVowel(value[0].toLowerCase())) return `d'${value}`;
    else return `de ${value}`;
  });

  i18next.services.formatter?.add("the", (value, lng, options) => {
    if (lng !== "fr") return value;
    else if (isVowel(value[0].toLowerCase())) return `L'${value}`;
    else if (options.gender === "feminine") return `La ${value}`;
    else return `Le ${value}`;
  });
}

window.initLocale = async () => {
  await i18next.use(i18nextHTTPBackend).init(
    {
      lng: options.language,
      backend: {
        loadPath: "locales/{{lng}}/lang.json",
      },
    },
    () => {
      addFormatters();
      updateLabels();
    },
  );
};
