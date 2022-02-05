"use strict";

const fonts = [
  {family: "Arial"},
  {family: "Times New Roman"},
  {family: "Georgia"},
  {family: "Garamond"},
  {family: "Lucida Sans Unicode"},
  {family: "Courier New"},
  {family: "Verdana"},
  {family: "Impact"},
  {family: "Comic Sans MS"},
  {family: "Papyrus"},
  {
    family: "Almendra SC",
    src: "url(https://fonts.gstatic.com/s/almendrasc/v13/Iure6Yx284eebowr7hbyTaZOrLQ.woff2)",
    unicodeRange:
      "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"
  },
  {
    family: "Amatic SC",
    src: "url(https://fonts.gstatic.com/s/amaticsc/v11/TUZ3zwprpvBS1izr_vOMscGKfrUC.woff2)",
    unicodeRange:
      "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"
  },
  {
    family: "Architects Daughter",
    src: "url(https://fonts.gstatic.com/s/architectsdaughter/v8/RXTgOOQ9AAtaVOHxx0IUBM3t7GjCYufj5TXV5VnA2p8.woff2)",
    unicodeRange: "U+0000-00FF, U+0131, U+0152-0153, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2212, U+2215"
  },
  {
    family: "Bitter",
    src: "url(https://fonts.gstatic.com/s/bitter/v12/zfs6I-5mjWQ3nxqccMoL2A.woff2)",
    unicodeRange: "U+0000-00FF, U+0131, U+0152-0153, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2212, U+2215"
  },
  {
    family: "Caesar Dressing",
    src: "url(https://fonts.gstatic.com/s/caesardressing/v6/yYLx0hLa3vawqtwdswbotmK4vrRHdrz7.woff2)",
    unicodeRange:
      "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"
  },
  {
    family: "Cinzel",
    src: "url(https://fonts.gstatic.com/s/cinzel/v7/zOdksD_UUTk1LJF9z4tURA.woff2)",
    unicodeRange: "U+0000-00FF, U+0131, U+0152-0153, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2212, U+2215"
  },
  {
    family: "Dancing Script",
    src: "url(https://fonts.gstatic.com/s/dancingscript/v9/KGBfwabt0ZRLA5W1ywjowUHdOuSHeh0r6jGTOGdAKHA.woff2)",
    unicodeRange: "U+0000-00FF, U+0131, U+0152-0153, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2212, U+2215"
  },
  {
    family: "Fredericka the Great",
    src: "url(https://fonts.gstatic.com/s/frederickathegreat/v6/9Bt33CxNwt7aOctW2xjbCstzwVKsIBVV--Sjxbc.woff2)",
    unicodeRange:
      "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"
  },
  {
    family: "Gloria Hallelujah",
    src: "url(https://fonts.gstatic.com/s/gloriahallelujah/v9/CA1k7SlXcY5kvI81M_R28cNDay8z-hHR7F16xrcXsJw.woff2)",
    unicodeRange: "U+0000-00FF, U+0131, U+0152-0153, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2212, U+2215"
  },
  {
    family: "Great Vibes",
    src: "url(https://fonts.gstatic.com/s/greatvibes/v5/6q1c0ofG6NKsEhAc2eh-3Y4P5ICox8Kq3LLUNMylGO4.woff2)",
    unicodeRange: "U+0000-00FF, U+0131, U+0152-0153, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2212, U+2215"
  },
  {
    family: "IM Fell English",
    src: "url(https://fonts.gstatic.com/s/imfellenglish/v7/xwIisCqGFi8pff-oa9uSVAkYLEKE0CJQa8tfZYc_plY.woff2)",
    unicodeRange: "U+0000-00FF, U+0131, U+0152-0153, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2212, U+2215"
  },
  {
    family: "Kaushan Script",
    src: "url(https://fonts.gstatic.com/s/kaushanscript/v6/qx1LSqts-NtiKcLw4N03IEd0sm1ffa_JvZxsF_BEwQk.woff2)",
    unicodeRange: "U+0000-00FF, U+0131, U+0152-0153, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2212, U+2215"
  },
  {
    family: "MedievalSharp",
    src: "url(https://fonts.gstatic.com/s/medievalsharp/v9/EvOJzAlL3oU5AQl2mP5KdgptMqhwMg.woff2)",
    unicodeRange:
      "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"
  },
  {
    family: "Metamorphous",
    src: "url(https://fonts.gstatic.com/s/metamorphous/v7/Wnz8HA03aAXcC39ZEX5y133EOyqs.woff2)",
    unicodeRange:
      "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"
  },
  {
    family: "Montez",
    src: "url(https://fonts.gstatic.com/s/montez/v8/aq8el3-0osHIcFK6bXAPkw.woff2)",
    unicodeRange: "U+0000-00FF, U+0131, U+0152-0153, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2212, U+2215"
  },
  {
    family: "Nova Script",
    src: "url(https://fonts.gstatic.com/s/novascript/v10/7Au7p_IpkSWSTWaFWkumvlQKGFw.woff2)",
    unicodeRange:
      "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"
  },
  {
    family: "Orbitron",
    src: "url(https://fonts.gstatic.com/s/orbitron/v9/HmnHiRzvcnQr8CjBje6GQvesZW2xOQ-xsNqO47m55DA.woff2)",
    unicodeRange: "U+0000-00FF, U+0131, U+0152-0153, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2212, U+2215"
  },
  {
    family: "Satisfy",
    src: "url(https://fonts.gstatic.com/s/satisfy/v8/2OzALGYfHwQjkPYWELy-cw.woff2)",
    unicodeRange: "U+0000-00FF, U+0131, U+0152-0153, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2212, U+2215"
  },
  {
    family: "Shadows Into Light",
    src: "url(https://fonts.gstatic.com/s/shadowsintolight/v7/clhLqOv7MXn459PTh0gXYFK2TSYBz0eNcHnp4YqE4Ts.woff2)",
    unicodeRange: "U+0000-00FF, U+0131, U+0152-0153, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2212, U+2215"
  },
  {
    family: "Uncial Antiqua",
    src: "url(https://fonts.gstatic.com/s/uncialantiqua/v5/N0bM2S5WOex4OUbESzoESK-i-MfWQZQ.woff2)",
    unicodeRange:
      "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"
  },
  {
    family: "Underdog",
    src: "url(https://fonts.gstatic.com/s/underdog/v6/CHygV-jCElj7diMroWSlWV8.woff2)",
    unicodeRange:
      "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"
  },
  {
    family: "Yellowtail",
    src: "url(https://fonts.gstatic.com/s/yellowtail/v8/GcIHC9QEwVkrA19LJU1qlPk_vArhqVIZ0nv9q090hN8.woff2)",
    unicodeRange: "U+0000-00FF, U+0131, U+0152-0153, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2212, U+2215"
  }
];

declareDefaultFonts(); // execute once on load

function declareFont(font) {
  const {family, src, ...rest} = font;
  if (!src) return;

  const fontFace = new FontFace(family, src, {...rest, display: "block"});
  document.fonts.add(fontFace);
  addFontOption(family);
}

function declareDefaultFonts() {
  fonts.forEach(font => {
    if (font.src) declareFont(font);
    else addFontOption(font.family);
  });
}

function getUsedFonts(svg) {
  const usedFontFamilies = new Set();

  const labelGroups = svg.querySelectorAll("#labels g");
  for (const labelGroup of labelGroups) {
    const font = labelGroup.getAttribute("font-family");
    if (font) usedFontFamilies.add(font);
  }

  const provinceFont = provs.attr("font-family");
  if (provinceFont) usedFontFamilies.add(provinceFont);

  const legend = svg.querySelector("#legend");
  const legendFont = legend?.getAttribute("font-family");
  if (legendFont) usedFontFamilies.add(legendFont);

  const usedFonts = fonts.filter(font => usedFontFamilies.has(font.family));
  return usedFonts;
}

function addFontOption(family) {
  const options = document.getElementById("styleSelectFont");
  // const existingOption = options.querySelector(`[value="${family}"]`);
  // if (existingOption) return;

  const option = document.createElement("option");
  option.value = family;
  option.innerText = family;
  option.style.fontFamily = family;
  options.add(option);
}

async function fetchGoogleFont(family) {
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}`;
  try {
    const resp = await fetch(url);
    const text = await resp.text();

    const fontFaceRules = text.match(/font-face\s*{[^}]+}/g);
    const fonts = fontFaceRules.map(fontFace => {
      const srcURL = fontFace.match(/url\(['"]?(.+?)['"]?\)/)[1];
      const src = `url(${srcURL})`;
      const unicodeRange = fontFace.match(/unicode-range: (.*?);/)?.[1];
      const variant = fontFace.match(/font-style: (.*?);/)?.[1];

      const font = {family, src};
      if (unicodeRange) font.unicodeRange = unicodeRange;
      if (variant && variant !== "normal") font.variant = variant;
      return font;
    });

    return fonts;
  } catch (err) {
    ERROR && console.error(err);
    return null;
  }
}

function readBlobAsDataURL(blob) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function loadFontsAsDataURI(fonts) {
  const promises = fonts.map(async font => {
    const url = font.src.match(/url\(['"]?(.+?)['"]?\)/)[1];
    const resp = await fetch(url);
    const blob = await resp.blob();
    const dataURL = await readBlobAsDataURL(blob);

    return {...font, src: `url('${dataURL}')`};
  });

  return await Promise.all(promises);
}

async function addGoogleFont(family) {
  const fontRanges = await fetchGoogleFont(family);
  if (!fontRanges) return tip("Cannot fetch Google font for this value", true, "error", 4000);
  tip(`Google font ${family} is loading...`, true, "warn", 4000);

  const promises = fontRanges.map(range => {
    const {src, unicodeRange, variant} = range;
    const fontFace = new FontFace(family, src, {unicodeRange, variant, display: "block"});
    return fontFace.load();
  });

  Promise.all(promises)
    .then(fontFaces => {
      fontFaces.forEach(fontFace => document.fonts.add(fontFace));
      fonts.push(...fontRanges);
      tip(`Google font ${family} is added to the list`, true, "success", 4000);
      addFontOption(family);
      document.getElementById("styleSelectFont").value = family;
      changeFont();
    })
    .catch(err => {
      tip(`Failed to load Google font ${family}`, true, "error", 4000);
      ERROR && console.error(err);
    });
}

function addLocalFont(family) {
  fonts.push({family});

  const fontFace = new FontFace(family, `local(${family})`, {display: "block"});
  document.fonts.add(fontFace);
  tip(`Local font ${family} is added to the fonts list`, true, "success", 4000);
  addFontOption(family);
  document.getElementById("styleSelectFont").value = family;
  changeFont();
}

function addWebFont(family, url) {
  const src = `url('${url}')`;
  fonts.push({family, src});

  const fontFace = new FontFace(family, src, {display: "block"});
  document.fonts.add(fontFace);
  tip(`Font ${family} is added to the list`, true, "success", 4000);
  addFontOption(family);
  document.getElementById("styleSelectFont").value = family;
  changeFont();
}
