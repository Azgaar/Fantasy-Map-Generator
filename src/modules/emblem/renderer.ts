import { shieldBox } from "./box";
import { colors } from "./colors";
import { lines } from "./lines";
import { shieldPaths } from "./paths";
import { patterns } from "./patterns";
import { shieldPositions } from "./shieldPositions";
import { shieldSize } from "./size";
import { templates } from "./templates";

declare global {
  var COArenderer: EmblemRenderModule;
}

interface Division {
  division: string;
  line?: string;
  t: string;
}

interface Ordinary {
  ordinary: string;
  line?: string;
  t: string;
  divided?: "field" | "division" | "counter";
  above?: boolean;
}

interface Charge {
  stroke: string;
  charge: string;
  t: string;
  size?: number;
  sinister?: boolean;
  reversed?: boolean;
  line?: string;
  divided?: "field" | "division" | "counter";
  p: number[]; // position on shield from 1 to 9
}

interface Emblem {
  shield: string;
  t1: string;
  division?: Division;
  ordinaries?: Ordinary[];
  charges?: Charge[];
  custom?: boolean; // if true, coa will not be rendered
}

class EmblemRenderModule {
  get shieldPaths() {
    return shieldPaths;
  }

  private getTemplate(id: string, line?: string) {
    const linedId = `${id}Lined` as keyof typeof templates;
    if (!line || line === "straight" || !templates[linedId])
      return templates[id as keyof typeof templates]; // return regular template if no line or line is straight or lined template does not exist
    const linePath = lines[line as keyof typeof lines];
    return (templates[linedId] as (line: string) => string)(linePath);
  }

  // get charge is string starts with "semy"
  private semy(input: string | undefined) {
    if (!input) return false;
    const isSemy = /^semy/.test(input);
    if (!isSemy) return false;
    const match = input.match(/semy_of_(.*?)-/);
    return match ? match[1] : false;
  }

  private async fetchCharge(charge: string, id: string) {
    const fetched = fetch(`./charges/${charge}.svg`)
      .then((res) => {
        if (res.ok) return res.text();
        else throw new Error("Cannot fetch charge");
      })
      .then((text) => {
        const html = document.createElement("html");
        html.innerHTML = text;
        const g: SVGAElement = html.querySelector("g") as SVGAElement;
        g.setAttribute("id", `${charge}_${id}`);
        return g.outerHTML;
      })
      .catch((err) => {
        ERROR && console.error(err);
      });
    return fetched;
  }

  private async getCharges(coa: Emblem, id: string, shieldPath: string) {
    const charges = coa.charges
      ? coa.charges.map((charge) => charge.charge)
      : []; // add charges
    if (this.semy(coa.t1)) charges.push(this.semy(coa.t1) as string); // add field semy charge
    if (this.semy(coa.division?.t))
      charges.push(this.semy(coa.division?.t) as string); // add division semy charge

    const uniqueCharges = [...new Set(charges)];
    const fetchedCharges = await Promise.all(
      uniqueCharges.map(async (charge) => {
        if (charge === "inescutcheon")
          return `<g id="inescutcheon_${id}"><path transform="translate(66 66) scale(.34)" d="${shieldPath}"/></g>`;
        const fetched = await this.fetchCharge(charge, id);
        return fetched;
      }),
    );
    return fetchedCharges.join("");
  }

  // get color or link to pattern
  private clr(tincture: string) {
    return tincture in colors
      ? colors[tincture as keyof typeof colors]
      : `url(#${tincture})`;
  }

  private getSizeMod(size: string) {
    if (size === "small") return 0.8;
    if (size === "smaller") return 0.5;
    if (size === "smallest") return 0.25;
    if (size === "big") return 1.6;
    return 1;
  }

  private getPatterns(coa: Emblem, id: string) {
    const isPattern = (string: string) => string.includes("-");
    const patternsToAdd = [];
    if (coa.t1.includes("-")) patternsToAdd.push(coa.t1); // add field pattern
    if (coa.division && isPattern(coa.division.t))
      patternsToAdd.push(coa.division.t); // add division pattern
    if (coa.ordinaries)
      coa.ordinaries
        .filter((ordinary) => isPattern(ordinary.t))
        .forEach((ordinary) => {
          patternsToAdd.push(ordinary.t); // add ordinaries pattern
        });
    if (coa.charges)
      coa.charges
        .filter((charge) => isPattern(charge.t))
        .forEach((charge) => {
          patternsToAdd.push(charge.t); // add charges pattern
        });
    if (!patternsToAdd.length) return "";

    return [...new Set(patternsToAdd)]
      .map((patternString) => {
        const [pattern, t1, t2, size] = patternString.split("-");
        const charge = this.semy(patternString);
        if (charge)
          return patterns.semy(
            patternString,
            this.clr(t1),
            this.clr(t2),
            this.getSizeMod(size),
            `${charge}_${id}`,
          );
        return patterns[pattern as keyof typeof patterns](
          patternString,
          this.clr(t1),
          this.clr(t2),
          this.getSizeMod(size),
          charge as string,
        );
      })
      .join("");
  }

  private async draw(id: string, coa: Emblem) {
    const { shield = "heater", division, ordinaries = [], charges = [] } = coa;

    const ordinariesRegular = ordinaries.filter((o) => !o.above);
    const ordinariesAboveCharges = ordinaries.filter((o) => o.above);
    const shieldPath =
      shield in shieldPaths
        ? shieldPaths[shield as keyof typeof shieldPaths]
        : shieldPaths.heater;
    const tDiv = division
      ? division.t.includes("-")
        ? division.t.split("-")[1]
        : division.t
      : null;
    const positions =
      shield in shieldPositions
        ? shieldPositions[shield as keyof typeof shieldPositions]
        : shieldPositions.heater;
    const sizeModifier =
      shield in shieldSize ? shieldSize[shield as keyof typeof shieldSize] : 1;
    const viewBox =
      shield in shieldBox
        ? shieldBox[shield as keyof typeof shieldBox]
        : "0 0 200 200";

    const shieldClip = `<clipPath id="${shield}_${id}"><path d="${shieldPath}"/></clipPath>`;
    const divisionClip = division
      ? `<clipPath id="divisionClip_${id}">${this.getTemplate(division.division, division.line)}</clipPath>`
      : "";
    const loadedCharges = await this.getCharges(coa, id, shieldPath);
    const loadedPatterns = this.getPatterns(coa, id);
    const blacklight = `<radialGradient id="backlight_${id}" cx="100%" cy="100%" r="150%"><stop stop-color="#fff" stop-opacity=".3" offset="0"/><stop stop-color="#fff" stop-opacity=".15" offset=".25"/><stop stop-color="#000" stop-opacity="0" offset="1"/></radialGradient>`;
    const field = `<rect x="0" y="0" width="200" height="200" fill="${this.clr(coa.t1)}"/>`;
    const style = `<style>
      g.secondary,path.secondary {fill: var(--secondary);}
      g.tertiary,path.tertiary {fill: var(--tertiary);}
    </style>`;

    const templateCharge = (
      charge: Charge,
      tincture: string,
      secondaryTincture?: string,
      tertiaryTincture?: string,
    ) => {
      const primary = this.clr(tincture);
      const secondary = this.clr(secondaryTincture || tincture);
      const tertiary = this.clr(tertiaryTincture || tincture);
      const stroke = charge.stroke || "#000";

      const chargePositions = [...new Set(charge.p)].filter(
        (position) => positions[position as unknown as keyof typeof positions],
      ); // filter out invalid positions

      let svg = `<g fill="${primary}" style="--secondary: ${secondary}; --tertiary: ${tertiary}" stroke="${stroke}">`;
      for (const p of chargePositions) {
        const transform = getElTransform(charge, p);
        svg += `<use href="#${charge.charge}_${id}" transform="${transform}"></use>`;
      }
      return `${svg}</g>`;

      function getElTransform(c: Charge, p: string | number) {
        const s = (c.size || 1) * sizeModifier;
        const sx = c.sinister ? -s : s;
        const sy = c.reversed ? -s : s;
        let [x, y] = positions[p as keyof typeof positions];
        x = x - 100 * (sx - 1);
        y = y - 100 * (sy - 1);
        const scale = c.sinister || c.reversed ? `${sx} ${sy}` : s;
        return `translate(${x} ${y}) scale(${scale})`;
      }
    };

    const templateOrdinary = (ordinary: Ordinary, tincture: string) => {
      const fill = this.clr(tincture);
      let svg = `<g fill="${fill}" stroke="none">`;
      if (ordinary.ordinary === "bordure")
        svg += `<path d="${shieldPath}" fill="none" stroke="${fill}" stroke-width="16.7%"/>`;
      else if (ordinary.ordinary === "orle")
        svg += `<path d="${shieldPath}" fill="none" stroke="${fill}" stroke-width="5%" transform="scale(.85)" transform-origin="center"/>`;
      else svg += this.getTemplate(ordinary.ordinary, ordinary.line);
      return `${svg}</g>`;
    };

    const templateDivision = () => {
      let svg = "";

      // In field part
      for (const ordinary of ordinariesRegular) {
        if (ordinary.divided === "field")
          svg += templateOrdinary(ordinary, ordinary.t);
        else if (ordinary.divided === "counter")
          svg += templateOrdinary(ordinary, tDiv!);
      }

      for (const charge of charges) {
        if (charge.divided === "field") svg += templateCharge(charge, charge.t);
        else if (charge.divided === "counter")
          svg += templateCharge(charge, tDiv!);
      }

      for (const ordinary of ordinariesAboveCharges) {
        if (ordinary.divided === "field")
          svg += templateOrdinary(ordinary, ordinary.t);
        else if (ordinary.divided === "counter")
          svg += templateOrdinary(ordinary, tDiv!);
      }

      // In division part
      svg += `<g clip-path="url(#divisionClip_${id})"><rect x="0" y="0" width="200" height="200" fill="${this.clr(
        division!.t,
      )}"/>`;

      for (const ordinary of ordinariesRegular) {
        if (ordinary.divided === "division")
          svg += templateOrdinary(ordinary, ordinary.t);
        else if (ordinary.divided === "counter")
          svg += templateOrdinary(ordinary, coa.t1);
      }

      for (const charge of charges) {
        if (charge.divided === "division")
          svg += templateCharge(charge, charge.t);
        else if (charge.divided === "counter")
          svg += templateCharge(charge, coa.t1);
      }

      for (const ordinary of ordinariesAboveCharges) {
        if (ordinary.divided === "division")
          svg += templateOrdinary(ordinary, ordinary.t);
        else if (ordinary.divided === "counter")
          svg += templateOrdinary(ordinary, coa.t1);
      }

      svg += `</g>`;
      return svg;
    };

    const templateAboveAll = () => {
      let svg = "";

      ordinariesRegular
        .filter((o) => !o.divided)
        .forEach((ordinary) => {
          svg += templateOrdinary(ordinary, ordinary.t);
        });

      charges
        .filter((o) => !o.divided || !division)
        .forEach((charge) => {
          svg += templateCharge(charge, charge.t);
        });

      ordinariesAboveCharges
        .filter((o) => !o.divided)
        .forEach((ordinary) => {
          svg += templateOrdinary(ordinary, ordinary.t);
        });

      return svg;
    };

    const divisionGroup = division ? templateDivision() : "";
    const overlay = `<path d="${shieldPath}" fill="url(#backlight_${id})" stroke="#333"/>`;

    const svg = `<svg id="${id}" width="200" height="200" viewBox="${viewBox}">
        <defs>${shieldClip}${divisionClip}${loadedCharges}${loadedPatterns}${blacklight}${style}</defs>
        <g clip-path="url(#${shield}_${id})">${field}${divisionGroup}${templateAboveAll()}</g>
        ${overlay}</svg>`;

    // insert coa svg to defs
    document.getElementById("coas")!.insertAdjacentHTML("beforeend", svg);
    return true;
  }

  // render coa if does not exist
  async trigger(id: string, coa: Emblem) {
    if (!coa) return console.warn(`Emblem ${id} is undefined`);
    if (coa.custom) return console.warn("Cannot render custom emblem", coa);
    if (!document.getElementById(id)) return this.draw(id, coa);
  }

  async add(type: string, i: number, coa: Emblem, x: number, y: number) {
    const id = `${type}COA${i}`;
    const g: HTMLElement = document.getElementById(
      `${type}Emblems`,
    ) as HTMLElement;

    if (emblems.selectAll("use").size()) {
      const size = parseFloat(g.getAttribute("font-size") || "50");
      const use = `<use data-i="${i}" x="${x - size / 2}" y="${y - size / 2}" width="1em" height="1em" href="#${id}"/>`;
      g.insertAdjacentHTML("beforeend", use);
    }
    if (layerIsOn("toggleEmblems")) this.trigger(id, coa);
  }
}
window.COArenderer = new EmblemRenderModule();
