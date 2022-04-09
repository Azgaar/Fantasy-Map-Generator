"use strict";

window.Formats = (function () {
  async function csvParser(file, separator = ",") {
    const txt = await file.text();
    const rows = txt.split("\n");
    const headers = rows
      .shift()
      .split(separator)
      .map(x => x.toLowerCase());
    const data = rows.filter(a => a.trim() !== "").map(r => r.split(separator));

    return {
      headers,
      data,
      iterator: function* (sortf) {
        const dataset = sortf ? this.data.sort(sortf) : this.data;
        for (const d of dataset) yield Object.fromEntries(d.map((a, i) => [this.headers[i], a]));
      }
    };
  }

  return {csvParser};
})();
