import { generateCOA, getTincture, shields, tinctures } from "armoria";
import { P, rw } from "../../utils";
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
    return generateCOA(null, {
      charge: () => {
        if (parent?.charges && P((kinship as number) - 0.1))
          return parent.charges[0].charge;
        if (type && type !== "Generic" && P(0.3)) return rw(typeMapping[type]);
      },
      division: () => {
        if (parent?.division && P((kinship as number) - 0.1))
          return parent.division.division;
      },
      ordinary: () => {
        if (parent?.ordinaries && P(kinship as number))
          return parent.ordinaries[0].ordinary;
      },
      tincture: () => {
        if (P(kinship as number)) return parent!.t1;
      },
      finalize: (coa: Emblem, config: Record<string, any>) => {
        // dominions have canton with parent coa
        if (P(dominion as number) && parent?.charges) {
          const invert = this.isSameType(parent.t1, coa.t1);
          const t = invert
            ? getTincture(config, "division", config.usedTinctures, coa.t1)
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
            t2 = getTincture(config, "charge", config.usedTinctures, t);

          if (!coa.charges) coa.charges = [];
          coa.charges.push({ charge, t: t2, p: "y", size: 0.5 });

          if (coa.ordinaries) {
            coa.ordinaries.push(canton);
          } else {
            coa.ordinaries = [canton];
          }
        }
      },
    });
  }

  private isSameType(t1: string, t2: string): boolean {
    return this.typeOf(t1) === this.typeOf(t2);
  }

  private typeOf(tinc: string): string {
    if (Object.keys(tinctures.metals).includes(tinc)) return "metals";
    if (Object.keys(tinctures.colours).includes(tinc)) return "colours";
    if (Object.keys(tinctures.stains).includes(tinc)) return "stains";
    return "pattern";
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
