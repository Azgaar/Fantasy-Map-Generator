import { Emblems } from "@/generators/emblems-generator";
import { colors } from "@/renderers/emblems/colors";
import { diapers } from "@/renderers/emblems/diapers";
import { lines } from "@/renderers/emblems/lines";
import { patterns } from "@/renderers/emblems/patterns";
import { inescutcheonShape, shieldShapes } from "@/renderers/emblems/shields";
import { divisionTemplates, ordinaryTemplates } from "@/renderers/emblems/templates";
import type { HeraldicEmblem } from "@/types/emblems";

export function isDrawable(coa: HeraldicEmblem): boolean {
  const tincture = (value: string | undefined): boolean => {
    if (!value || typeof value !== "string") return false;
    if (value in colors || /^#[\da-f]{3,8}$/i.test(value)) return true;
    const [pattern, first, second] = value.split("-");
    if (!tincture(first) || !tincture(second)) return false;
    if (pattern.startsWith("semy_of_")) return !!Emblems.chargeIcon(pattern.slice(8));
    return pattern in patterns;
  };
  const line = (name: string | undefined) => !name || name in lines;
  const charge = (name: string) => {
    const shape = inescutcheonShape(name, "heater"); // a bare inescutcheon takes the emblem's shield
    return shape ? shape in shieldShapes : !!Emblems.chargeArt(name);
  };
  return (
    tincture(coa.t1) &&
    (!coa.shield || coa.shield in shieldShapes) &&
    (!coa.diaper || coa.diaper === "no" || coa.diaper in diapers) &&
    (!coa.division ||
      ((coa.division.division === "no" || coa.division.division in divisionTemplates) &&
        tincture(coa.division.t) &&
        line(coa.division.line))) &&
    (coa.ordinaries ?? []).every(
      item =>
        (item.ordinary === "bordure" || item.ordinary === "orle" || item.ordinary in ordinaryTemplates) &&
        tincture(item.t) &&
        (!item.t2 || tincture(item.t2)) &&
        line(item.line)
    ) &&
    (coa.charges ?? []).every(
      item =>
        charge(item.charge) && tincture(item.t) && (!item.t2 || tincture(item.t2)) && (!item.t3 || tincture(item.t3))
    )
  );
}
