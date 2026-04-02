import i18next, { type TOptions } from "i18next";
import i18nextHTTPBackend from "i18next-http-backend";
import { isVowel } from "../utils";

function initTooltips() {
  for (const tip of document.querySelectorAll("[data-tip]")) {
    tip.setAttribute(
      "data-original-tip",
      tip.getAttribute("data-tip") as string,
    );
  }
}

function updateLabels() {
  for (const label of document.querySelectorAll("[data-html]")) {
    const vars: TOptions = {
      interpolation: { escapeValue: false },
    };
    for (const attr of label.attributes) {
      if (attr.name.startsWith("data-var-")) {
        vars[attr.name.slice(9)] = attr.value;
      }
    }
    const translation = i18next.t(
      label.getAttribute("data-html") as string,
      vars,
    );
    if (translation) label.innerHTML = translation;
  }
  for (const label of document.querySelectorAll("[data-text]")) {
    const translation = i18next.t(label.getAttribute("data-text") as string);
    if (translation) label.textContent = translation;
  }
  for (const tip of document.querySelectorAll("[data-original-tip]")) {
    const translation = i18next.t(
      tip.getAttribute("data-original-tip") as string,
    );
    if (translation) tip.setAttribute("data-tip", translation);
  }
}

function addFormatters() {
  i18next.services.formatter?.add("link", (value, _lng, options) => {
    return `<a href="${value}" target="_blank">${options.text}</a>`;
  });
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
      fallbackLng: "en",
      backend: {
        loadPath: "locales/{{lng}}/lang.json",
      },
      keySeparator: "::",
      nsSeparator: false,
      returnEmptyString: false,
    },
    () => {
      addFormatters();
      initTooltips();
      updateLabels();
    },
  );
};

window.changeLocale = () => {
  i18next.changeLanguage(options.language, updateLabels);
};
