// Translation module
"use strict";

void function() {
  window.lang = "en"; // default language

  if (localStorage.getItem("lang")) window.lang = localStorage.getItem("lang");
  else {
    const isSupported = ln => ["ru"].includes(ln); // list of supported languages with at least 50% support
    const browserLang = navigator.language.split("-")[0];
    if (isSupported(browserLang)) window.lang = browserLang;
  }

  selectLanguage.value = window.lang;
  if (window.lang === "en") return; // no need to translate
  initiateTranslation();
  
  async function initiateTranslation() {
    const loaded = await loadTranslation();
    if (!loaded) {
      tip(`Cannot load ${window.lang} translation, check files in lang folder`, false, "error", 4000);
      window.lang == "en"; // set to default value
      return false;
    }

    function loadTranslation() {
      return new Promise(resolve => {
        const script = document.createElement('script');
        script.src = `lang/lang-${window.lang}.js`
        document.head.append(script);
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
      });
    }

    if (translation["titleFull"]) document.title = translation["titleFull"];

    void function translateDOM() {
      const tTags = Array.from(document.getElementsByTagName("t"));
      tTags.forEach(t => {
        const id = t.dataset.t;
        const text = translation[id];
        if (!text) return;
        t.innerHTML = text;
      });
    }()

  }

}()

function translate(id, originalEn) {
  const text = translation[id];
  return text ? text : originalEn;
}