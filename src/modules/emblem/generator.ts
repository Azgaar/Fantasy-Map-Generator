import { P, rw } from "../../utils";
import { charges } from "./charges";
import { divisions } from "./divisions";
import { lineWeights } from "./lineWeights";
import { ordinaries } from "./ordinaries";
import { positions } from "./positions";
import { shields } from "./shields";
import { createTinctures } from "./tinctures";
import { typeMapping } from "./typeMapping";

declare global {
  var COA: EmblemGeneratorModule;
}

export interface EmblemCharge {
  charge: string;
  t: string;
  p: string;
  t2?: string;
  t3?: string;
  size?: number;
  sinister?: number;
  reversed?: number;
  divided?: string;
}

export interface EmblemOrdinary {
  ordinary: string;
  t: string;
  line?: string;
  divided?: string;
  above?: boolean;
}

export interface EmblemDivision {
  division: string;
  t: string;
  line?: string;
}

export interface Emblem {
  t1: string;
  shield?: string;
  division?: EmblemDivision;
  ordinaries?: EmblemOrdinary[];
  charges?: EmblemCharge[];
  custom?: boolean;
}

class EmblemGeneratorModule {
  generate(
    parent: Emblem | null,
    kinship: number | null,
    dominion: number | null,
    type?: string,
  ): Emblem {
    if (!parent || parent.custom) {
      parent = null;
      kinship = 0;
      dominion = 0;
    }

    let usedPattern: string | null = null;
    const usedTinctures: string[] = [];

    const t1 = P(kinship as number)
      ? parent!.t1
      : this.getTincture("field", usedTinctures, null);
    if (t1.includes("-")) usedPattern = t1;
    const coa: Emblem = { t1 };

    const addCharge = P(usedPattern ? 0.5 : 0.93); // 80% for charge
    const linedOrdinary =
      (addCharge && P(0.3)) || P(0.5)
        ? parent?.ordinaries && P(kinship as number)
          ? parent.ordinaries[0].ordinary
          : rw(ordinaries.lined)
        : null;

    const ordinary =
      (!addCharge && P(0.65)) || P(0.3)
        ? linedOrdinary
          ? linedOrdinary
          : rw(ordinaries.straight)
        : null; // 36% for ordinary

    const rareDivided = [
      "chief",
      "terrace",
      "chevron",
      "quarter",
      "flaunches",
    ].includes(ordinary!);

    const divisioned = (() => {
      if (rareDivided) return P(0.03);
      if (addCharge && ordinary) return P(0.03);
      if (addCharge) return P(0.3);
      if (ordinary) return P(0.7);
      return P(0.995);
    })();

    const division = (() => {
      if (divisioned) {
        if (parent?.division && P((kinship as number) - 0.1))
          return parent.division.division;
        return rw(divisions.variants);
      }
      return null;
    })();

    if (division) {
      const t = this.getTincture(
        "division",
        usedTinctures,
        P(0.98) ? coa.t1 : null,
      );
      coa.division = { division, t };
      if (divisions[division as keyof typeof divisions])
        coa.division.line =
          usedPattern || (ordinary && P(0.7))
            ? "straight"
            : rw(divisions[division as keyof typeof divisions]);
    }

    if (ordinary) {
      coa.ordinaries = [
        { ordinary, t: this.getTincture("charge", usedTinctures, coa.t1) },
      ];
      if (linedOrdinary)
        coa.ordinaries[0].line =
          usedPattern || (division && P(0.7)) ? "straight" : rw(lineWeights);
      if (
        division &&
        !addCharge &&
        !usedPattern &&
        P(0.5) &&
        ordinary !== "bordure" &&
        ordinary !== "orle"
      ) {
        if (P(0.8)) coa.ordinaries[0].divided = "counter";
        // 40%
        else if (P(0.6)) coa.ordinaries[0].divided = "field";
        // 6%
        else coa.ordinaries[0].divided = "division"; // 4%
      }
    }

    if (addCharge) {
      const charge = (() => {
        if (parent?.charges && P((kinship as number) - 0.1))
          return parent.charges[0].charge;
        if (type && type !== "Generic" && P(0.3)) return rw(typeMapping[type]);
        return this.selectCharge(
          ordinary || divisioned ? charges.types : charges.single,
        );
      })();
      const chargeDataEntry = charges.data[charge] || {};

      let p: string;
      let t: string;

      const ordinaryData = ordinaries.data[ordinary!];
      const tOrdinary = coa.ordinaries ? coa.ordinaries[0].t : null;

      if (ordinaryData?.positionsOn && P(0.8)) {
        // place charge over ordinary (use tincture of field type)
        p = rw(ordinaryData.positionsOn);
        t =
          !usedPattern && P(0.3)
            ? coa.t1
            : this.getTincture("charge", [], tOrdinary);
      } else if (ordinaryData?.positionsOff && P(0.95)) {
        // place charge out of ordinary (use tincture of ordinary type)
        p = rw(ordinaryData.positionsOff);
        t =
          !usedPattern && P(0.3)
            ? tOrdinary!
            : this.getTincture("charge", usedTinctures, coa.t1);
      } else if (
        positions.divisions[division as keyof typeof positions.divisions]
      ) {
        // place charge in fields made by division
        p = rw(
          positions.divisions[division as keyof typeof positions.divisions],
        );
        t = this.getTincture(
          "charge",
          tOrdinary ? usedTinctures.concat(tOrdinary) : usedTinctures,
          coa.t1,
        );
      } else if (chargeDataEntry.positions) {
        // place charge-suitable position
        p = rw(chargeDataEntry.positions);
        t = this.getTincture("charge", usedTinctures, coa.t1);
      } else {
        // place in standard position (use new tincture)
        p = usedPattern
          ? "e"
          : charges.conventional[charge as keyof typeof charges.conventional]
            ? rw(positions.conventional)
            : rw(positions.complex);
        t = this.getTincture(
          "charge",
          usedTinctures.concat(tOrdinary!),
          coa.t1,
        );
      }

      if (
        chargeDataEntry.natural &&
        chargeDataEntry.natural !== t &&
        chargeDataEntry.natural !== tOrdinary
      )
        t = chargeDataEntry.natural;

      const item: EmblemCharge = { charge: charge, t, p };
      const colors = chargeDataEntry.colors || 1;
      if (colors > 1)
        item.t2 = P(0.25)
          ? this.getTincture("charge", usedTinctures, coa.t1)
          : t;
      if (colors > 2 && item.t2)
        item.t3 = P(0.5)
          ? this.getTincture("charge", usedTinctures, coa.t1)
          : t;
      coa.charges = [item];

      if (p === "ABCDEFGHIJKL" && P(0.95)) {
        // add central charge if charge is in bordure
        coa.charges[0].charge = rw(charges.conventional);
        const chargeNew = this.selectCharge(charges.single);
        const tNew = this.getTincture("charge", usedTinctures, coa.t1);
        coa.charges.push({ charge: chargeNew, t: tNew, p: "e" });
      } else if (P(0.8) && charge === "inescutcheon") {
        // add charge to inescutcheon
        const chargeNew = this.selectCharge(charges.types);
        const t2 = this.getTincture("charge", [], t);
        coa.charges.push({ charge: chargeNew, t: t2, p, size: 0.5 });
      } else if (division && !ordinary) {
        const allowCounter =
          !usedPattern &&
          (!coa.division?.line || coa.division.line === "straight");

        // dimidiation: second charge at division basic positions
        if (
          P(0.3) &&
          ["perPale", "perFess"].includes(division) &&
          coa.division?.line === "straight"
        ) {
          coa.charges[0].divided = "field";
          if (P(0.95)) {
            const p2 =
              p === "e" || P(0.5)
                ? "e"
                : rw(
                    positions.divisions[
                      division as keyof typeof positions.divisions
                    ],
                  );
            const chargeNew = this.selectCharge(charges.single);
            const tNew = this.getTincture(
              "charge",
              usedTinctures,
              coa.division!.t,
            );
            coa.charges.push({
              charge: chargeNew,
              t: tNew,
              p: p2,
              divided: "division",
            });
          }
        } else if (allowCounter && P(0.4)) coa.charges[0].divided = "counter";
        // counterchanged, 40%
        else if (
          ["perPale", "perFess", "perBend", "perBendSinister"].includes(
            division,
          ) &&
          P(0.8)
        ) {
          // place 2 charges in division standard positions
          const [p1, p2] =
            division === "perPale"
              ? ["p", "q"]
              : division === "perFess"
                ? ["k", "n"]
                : division === "perBend"
                  ? ["l", "m"]
                  : ["j", "o"]; // perBendSinister
          coa.charges[0].p = p1;

          const chargeNew = this.selectCharge(charges.single);
          const tNew = this.getTincture(
            "charge",
            usedTinctures,
            coa.division!.t,
          );
          coa.charges.push({ charge: chargeNew, t: tNew, p: p2 });
        } else if (["perCross", "perSaltire"].includes(division) && P(0.5)) {
          // place 4 charges in division standard positions
          const [p1, p2, p3, p4] =
            division === "perCross"
              ? ["j", "l", "m", "o"]
              : ["b", "d", "f", "h"];
          coa.charges[0].p = p1;

          const c2 = this.selectCharge(charges.single);
          const t2 = this.getTincture("charge", [], coa.division!.t);

          const c3 = this.selectCharge(charges.single);
          const t3 = this.getTincture("charge", [], coa.division!.t);

          const c4 = this.selectCharge(charges.single);
          const t4 = this.getTincture("charge", [], coa.t1);
          coa.charges.push(
            { charge: c2, t: t2, p: p2 },
            { charge: c3, t: t3, p: p3 },
            { charge: c4, t: t4, p: p4 },
          );
        } else if (allowCounter && p.length > 1)
          coa.charges[0].divided = "counter"; // counterchanged, 40%
      }

      for (const c of coa.charges) {
        this.defineChargeAttributes(ordinary, division, c);
      }
    }

    // dominions have canton with parent coa
    if (P(dominion as number) && parent?.charges) {
      const invert = this.isSameType(parent.t1, coa.t1);
      const t = invert
        ? this.getTincture("division", usedTinctures, coa.t1)
        : parent.t1;
      const canton: EmblemOrdinary = { ordinary: "canton", t };

      if (coa.charges) {
        for (let i = coa.charges.length - 1; i >= 0; i--) {
          const charge = coa.charges[i];
          if (charge.size === 1.5) charge.size = 1.4;
          charge.p = charge.p.replaceAll(/[ajy]/g, "");
          if (!charge.p) coa.charges.splice(i, 1);
        }
      }

      let charge = parent.charges[0].charge;
      if (charge === "inescutcheon" && parent.charges[1])
        charge = parent.charges[1].charge;

      let t2 = invert ? parent.t1 : parent.charges[0].t;
      if (this.isSameType(t, t2))
        t2 = this.getTincture("charge", usedTinctures, t);

      if (!coa.charges) coa.charges = [];
      coa.charges.push({ charge, t: t2, p: "y", size: 0.5 });

      if (coa.ordinaries) {
        coa.ordinaries.push(canton);
      } else {
        coa.ordinaries = [canton];
      }
    }

    return coa;
  }

  private selectCharge(set?: Record<string, number>): string {
    const type = set ? rw(set) : rw(charges.types);
    return type === "inescutcheon"
      ? "inescutcheon"
      : rw(charges[type as keyof typeof charges] as Record<string, number>);
  }

  // Select tincture: element type (field, division, charge), used field tinctures, field type to follow RoT
  private getTincture(
    element: "field" | "division" | "charge",
    fields: string[] = [],
    RoT: string | null,
  ): string {
    const base = RoT ? (RoT.includes("-") ? RoT.split("-")[1] : RoT) : null;
    const tinctures = createTinctures();

    let type = rw(tinctures[element]); // metals, colours, stains, patterns
    if (RoT && type !== "patterns")
      type = this.getType(base!) === "metals" ? "colours" : "metals"; // follow RoT
    if (type === "metals" && fields.includes("or") && fields.includes("argent"))
      type = "colours"; // exclude metals overuse
    let tincture = rw(
      tinctures[type as keyof typeof tinctures] as Record<string, number>,
    );

    while (tincture === base || fields.includes(tincture)) {
      tincture = rw(
        tinctures[type as keyof typeof tinctures] as Record<string, number>,
      );
    } // follow RoT

    if (type !== "patterns" && element !== "charge") fields.push(tincture); // add field tincture

    if (type === "patterns") {
      tincture = this.definePattern(tincture, element, fields);
    }

    return tincture;
  }

  private defineChargeAttributes(
    ordinary: string | null,
    division: string | null,
    c: EmblemCharge,
  ): void {
    // define size
    c.size = (c.size || 1) * this.getSize(c.p, ordinary, division);

    // clean-up position
    c.p = [...new Set(c.p)].join("");

    // define orientation
    if (P(0.02) && charges.data[c.charge]?.sinister) c.sinister = 1;
    if (P(0.02) && charges.data[c.charge]?.reversed) c.reversed = 1;
  }

  private getType(t: string): string | undefined {
    const tinc = t.includes("-") ? t.split("-")[1] : t;
    const tinctures = createTinctures();
    if (Object.keys(tinctures.metals).includes(tinc)) return "metals";
    if (Object.keys(tinctures.colours).includes(tinc)) return "colours";
    if (Object.keys(tinctures.stains).includes(tinc)) return "stains";
    return undefined;
  }

  private isSameType(t1: string, t2: string): boolean {
    return this.typeOf(t1) === this.typeOf(t2);
  }

  private typeOf(tinc: string): string {
    const tinctures = createTinctures();
    if (Object.keys(tinctures.metals).includes(tinc)) return "metals";
    if (Object.keys(tinctures.colours).includes(tinc)) return "colours";
    if (Object.keys(tinctures.stains).includes(tinc)) return "stains";
    return "pattern";
  }

  private definePattern(
    pattern: string,
    element: "field" | "division" | "charge",
    usedTinctures: string[],
  ): string {
    let t1: string | null = null;
    let t2: string | null = null;
    let size = "";

    // Size selection - must use sequential P() calls to match original behavior
    if (P(0.1)) size = "-small";
    // biome-ignore lint/suspicious/noDuplicateElseIf: <explanation>
    else if (P(0.1)) size = "-smaller";
    else if (P(0.01)) size = "-big";
    else if (P(0.005)) size = "-smallest";

    // apply standard tinctures
    if (P(0.5) && ["vair", "vairInPale", "vairEnPointe"].includes(pattern)) {
      t1 = "azure";
      t2 = "argent";
    } else if (P(0.8) && pattern === "ermine") {
      t1 = "argent";
      t2 = "sable";
    } else if (pattern === "pappellony") {
      if (P(0.2)) {
        t1 = "gules";
        t2 = "or";
        // biome-ignore lint/suspicious/noDuplicateElseIf: <explanation>
      } else if (P(0.2)) {
        t1 = "argent";
        t2 = "sable";
        // biome-ignore lint/suspicious/noDuplicateElseIf: <explanation>
      } else if (P(0.2)) {
        t1 = "azure";
        t2 = "argent";
      }
    } else if (pattern === "masoned") {
      if (P(0.3)) {
        t1 = "gules";
        t2 = "argent";
        // biome-ignore lint/suspicious/noDuplicateElseIf: <explanation>
      } else if (P(0.3)) {
        t1 = "argent";
        t2 = "sable";
      } else if (P(0.1)) {
        t1 = "or";
        t2 = "sable";
      }
    } else if (pattern === "fretty") {
      if (t2 === "sable" || P(0.35)) {
        t1 = "argent";
        t2 = "gules";
      } else if (P(0.25)) {
        t1 = "sable";
        t2 = "or";
      } else if (P(0.15)) {
        t1 = "gules";
        t2 = "argent";
      }
    } else if (pattern === "semy")
      pattern = `${pattern}_of_${this.selectCharge(charges.semy)}`;

    if (!t1 || !t2) {
      const tinctures = createTinctures();
      const startWithMetal = P(0.7);
      t1 = startWithMetal ? rw(tinctures.metals) : rw(tinctures.colours);
      t2 = startWithMetal ? rw(tinctures.colours) : rw(tinctures.metals);
    }

    // division should not be the same tincture as base field
    if (element === "division") {
      if (usedTinctures.includes(t1)) t1 = this.replaceTincture(t1);
      if (usedTinctures.includes(t2)) t2 = this.replaceTincture(t2);
    }

    usedTinctures.push(t1, t2);
    return `${pattern}-${t1}-${t2}${size}`;
  }

  private replaceTincture(t: string): string {
    const type = this.getType(t);
    let n: string | null = null;
    const tinctures = createTinctures();
    while (!n || n === t) {
      n = rw(
        tinctures[type as keyof typeof tinctures] as Record<string, number>,
      );
    }
    return n;
  }

  private getSize(
    p: string,
    o: string | null = null,
    d: string | null = null,
  ): number {
    if (p === "e" && (o === "bordure" || o === "orle")) return 1.1;
    if (p === "e") return 1.5;
    if (p === "jln" || p === "jlh") return 0.7;
    if (p === "abcpqh" || p === "ez" || p === "be") return 0.5;
    if (["a", "b", "c", "d", "f", "g", "h", "i", "bh", "df"].includes(p))
      return 0.5;
    if (["j", "l", "m", "o", "jlmo"].includes(p) && d === "perCross")
      return 0.6;
    if (p.length > 10) return 0.18; // >10 (bordure)
    if (p.length > 7) return 0.3; // 8, 9, 10
    if (p.length > 4) return 0.4; // 5, 6, 7
    if (p.length > 2) return 0.5; // 3, 4
    return 0.7; // 1, 2
  }

  getShield(culture: number, state?: number): string {
    const emblemShape = document.getElementById(
      "emblemShape",
    ) as HTMLSelectElement | null;
    const shapeGroup =
      emblemShape?.selectedOptions[0]?.parentElement?.getAttribute("label") ||
      "Diversiform";
    if (shapeGroup !== "Diversiform") return emblemShape!.value;

    if (emblemShape?.value === "state" && state && pack.states[state].coa)
      return pack.states[state].coa!.shield!;
    if (pack.cultures[culture].shield) return pack.cultures[culture].shield!;
    ERROR &&
      console.error(
        "Shield shape is not defined on culture level",
        pack.cultures[culture],
      );
    return "heater";
  }

  toString(coa: Emblem): string {
    return JSON.stringify(coa).replaceAll("#", "%23");
  }

  copy(coa: Emblem): Emblem {
    return JSON.parse(JSON.stringify(coa));
  }

  get shields() {
    return shields;
  }
}

export default EmblemGeneratorModule;

window.COA = new EmblemGeneratorModule();
