// helper finctions to work with fonts

async function addFonts(url) {
  $("head").append('<link rel="stylesheet" type="text/css" href="' + url + '">');
  try {
    const resp = await fetch(url);
    const text = await resp.text();
    let s = document.createElement("style");
    s.innerHTML = text;
    document.head.appendChild(s);
    let styleSheet = Array.prototype.filter.call(document.styleSheets, sS => sS.ownerNode === s)[0];
    let FontRule = rule_1 => {
      let family = rule_1.style.getPropertyValue("font-family");
      let font = family.replace(/['"]+/g, "").replace(/ /g, "+");
      let weight = rule_1.style.getPropertyValue("font-weight");
      if (weight && weight !== "400") font += ":" + weight;
      if (fonts.indexOf(font) == -1) {
        fonts.push(font);
        fetched++;
      }
    };
    let fetched = 0;
    for (let r of styleSheet.cssRules) {
      FontRule(r);
    }
    document.head.removeChild(s);
    return fetched;
  } catch (err) {
    return ERROR && console.error(err);
  }
}

function loadUsedFonts() {
  const fontsInUse = getFontsList(svg);
  const fontsToLoad = fontsInUse.filter(font => !fonts.includes(font));
  if (fontsToLoad?.length) {
    const url = "https://fonts.googleapis.com/css?family=" + fontsToLoad.join("|");
    addFonts(url);
  }
}

function getFontsList(svg) {
  const fontsInUse = [];

  svg.selectAll("#labels > g").each(function () {
    if (!this.hasChildNodes()) return;
    const font = this.dataset.font;
    if (font) fontsInUse.push(font);
  });
  if (legend?.node()?.hasChildNodes()) fontsInUse.push(legend.attr("data-font"));

  return [...new Set(fontsInUse)];
}

function convertFontToDataURI(url) {
  if (!url) return Promise.resolve();
  return fetch(url)
    .then(resp => resp.text())
    .then(text => {
      const style = document.createElement("style");
      style.innerHTML = text;
      document.head.appendChild(style);

      const styleSheet = document.styleSheets.find(sheet => sheet.ownerNode === style);

      const FontRule = rule => {
        const src = rule.style.getPropertyValue("src");
        const url = src ? src.split("url(")[1].split(")")[0] : "";
        return {rule, src, url: url.substring(url.length - 1, 1)};
      };
      const fontProms = [];

      for (const rule of styleSheet.cssRules) {
        let fR = FontRule(rule);
        if (!fR.url) continue;

        fontProms.push(
          fetch(fR.url)
            .then(resp => resp.blob())
            .then(blob => {
              return new Promise(resolve => {
                let f = new FileReader();
                f.onload = e => resolve(f.result);
                f.readAsDataURL(blob);
              });
            })
            .then(dataURL => fR.rule.cssText.replace(fR.url, dataURL))
        );
      }

      document.head.removeChild(style); // clean up
      return Promise.all(fontProms); // wait for all this has been done
    });
}

// fetch default fonts if not done before
function loadDefaultFonts() {
  if (!$('link[href="fonts.css"]').length) {
    $("head").append('<link rel="stylesheet" type="text/css" href="fonts.css">');
    const fontsToAdd = ["Amatic+SC:700", "IM+Fell+English", "Great+Vibes", "MedievalSharp", "Metamorphous", "Nova+Script", "Uncial+Antiqua", "Underdog", "Caesar+Dressing", "Bitter", "Yellowtail", "Montez", "Shadows+Into+Light", "Fredericka+the+Great", "Orbitron", "Dancing+Script:700", "Architects+Daughter", "Kaushan+Script", "Gloria+Hallelujah", "Satisfy", "Comfortaa:700", "Cinzel"];
    fontsToAdd.forEach(function (f) {
      if (fonts.indexOf(f) === -1) fonts.push(f);
    });
    updateFontOptions();
  }
}

function fetchFonts(url) {
  return new Promise((resolve, reject) => {
    if (url === "") return tip("Use a direct link to any @font-face declaration or just font name to fetch from Google Fonts");

    if (url.indexOf("http") === -1) {
      url = url.replace(url.charAt(0), url.charAt(0).toUpperCase()).split(" ").join("+");
      url = "https://fonts.googleapis.com/css?family=" + url;
    }

    addFonts(url).then(fetched => {
      if (fetched === undefined) return tip("Cannot fetch font for this value!", false, "error");
      if (fetched === 0) return tip("Already in the fonts list!", false, "error");

      updateFontOptions();
      if (fetched === 1) {
        tip("Font " + fonts[fonts.length - 1] + " is fetched");
      } else if (fetched > 1) {
        tip(fetched + " fonts are added to the list");
      }
      resolve(fetched);
    });
  });
}

// Update font list for Label and Burg Editors
function updateFontOptions() {
  styleSelectFont.innerHTML = "";
  for (let i = 0; i < fonts.length; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    const font = fonts[i].split(":")[0].replace(/\+/g, " ");
    opt.style.fontFamily = opt.innerHTML = font;
    styleSelectFont.add(opt);
  }
}
