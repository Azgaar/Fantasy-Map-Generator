// helper finction to work with fonts

function loadUsedFonts() {
  const fontsInUse = getFontsList(svg);
  const fontsToLoad = fontsInUse.filter(font => !fonts.includes(font));
  if (fontsToLoad) {
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
  if (legend.node().hasChildNodes()) fontsInUse.push(legend.attr("data-font"));

  return [...new Set(fontsInUse)];
}

// code from Kaiido's answer https://stackoverflow.com/questions/42402584/how-to-use-google-fonts-in-canvas-when-drawing-dom-objects-in-svg
function GFontToDataURI(url) {
  if (!url) return Promise.resolve();
  return fetch(url) // first fecth the embed stylesheet page
    .then(resp => resp.text()) // we only need the text of it
    .then(text => {
      let s = document.createElement("style");
      s.innerHTML = text;
      document.head.appendChild(s);
      const styleSheet = Array.prototype.filter.call(document.styleSheets, sS => sS.ownerNode === s)[0];

      const FontRule = rule => {
        const src = rule.style.getPropertyValue("src");
        const url = src ? src.split("url(")[1].split(")")[0] : "";
        return {rule, src, url: url.substring(url.length - 1, 1)};
      };
      const fontProms = [];

      for (const r of styleSheet.cssRules) {
        let fR = FontRule(r);
        if (!fR.url) continue;

        fontProms.push(
          fetch(fR.url) // fetch the actual font-file (.woff)
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
      document.head.removeChild(s); // clean up
      return Promise.all(fontProms); // wait for all this has been done
    });
}
