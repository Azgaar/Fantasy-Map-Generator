import {nth} from "utils/languageUtils";
import {gauss} from "utils/probabilityUtils";
import {isBurg, isProvince, isState} from "utils/typeUtils";

export const getName = (
  regiment: IRegiment,
  regiments: IRegiment[],
  provinceIds: Uint16Array,
  burgIds: Uint16Array,
  provinces: TProvinces,
  burgs: TBurgs
) => {
  const proper = getProperName();
  const number = nth(regiments.filter(reg => reg.isNaval === regiment.isNaval && reg.i < regiment.i).length + 1);
  const form = regiment.isNaval ? "Fleet" : "Regiment";
  return `${number}${proper ? ` (${proper}) ` : ` `}${form}`;

  function getProperName() {
    if (regiment.isNaval) return null;

    const province = provinces[provinceIds[regiment.cell]];
    if (isProvince(province)) return province.name;

    const burg = burgs[burgIds[regiment.cell]];
    if (isBurg(burg)) return burg.name;

    return null;
  }
};

export const getEmblem = (regiment: IRegiment, states: TStates, burgs: TBurgs, burgIds: Uint16Array) => {
  if (regiment.isNaval) return "🌊"; //
  if (!regiment.isNaval && !regiment.total) return "🔰"; // "Newbie": regiment without troops

  const state = states[regiment.state];
  const isMonarchy = isState(state) && state.form === "Monarchy";

  const burg = burgs[burgIds[regiment.cell]];
  const isCapital = isBurg(burg) && burg.capital;

  if (isMonarchy && isCapital) return "👑"; // "Royal" regiment based in capital

  // unit with more troops in regiment
  const largestUnitName = Object.entries(regiment.units).sort((a, b) => b[1] - a[1])[0][0];
  const unit = options.military.find(unit => unit.name === largestUnitName);
  return unit?.icon || "🎖️";
};

export const generateNote = (
  regiment: IRegiment,
  provinceIds: Uint16Array,
  burgIds: Uint16Array,
  provinces: TProvinces,
  burgs: TBurgs
) => {
  const baseName = getBaseName();
  const station = baseName ? `${regiment.name} is ${regiment.isNaval ? "based" : "stationed"} in ${baseName}. ` : "";
  const troops = getTroopsComposition() || "";

  // TODO: add campaigns
  // const campaign = state.campaigns ? ra(state.campaigns) : null;
  // const year = campaign ? rand(campaign.start, campaign.end) : gauss(options.year - 100, 150, 1, options.year - 6);
  // const conflict = campaign ? ` during the ${campaign.name}` : "";
  // const legend = `Regiment was formed in ${year} ${options.era}${conflict}. ${station}${troops}`;

  const year = gauss(options.year - 100, 150, 1, options.year - 6);
  const legend = `Regiment was formed in ${year} ${options.era}. ${station}${troops}`;

  const id = `regiment${regiment.state}-${regiment.i}`;
  const name = `${regiment.icon} ${regiment.name}`;
  notes.push({id, name, legend});

  function getBaseName() {
    const burg = burgs[burgIds[regiment.cell]];
    if (isBurg(burg)) return burg.name;

    const province = provinces[provinceIds[regiment.cell]];
    if (isProvince(province)) return province.fullName;

    return null;
  }

  function getTroopsComposition() {
    if (regiment.total) return null;

    const composition = Object.keys(regiment.units)
      .map(t => `— ${t}: ${regiment.units[t]}`)
      .join("\r\n");

    return `\r\n\r\nRegiment composition in ${options.year} ${options.eraShort}:\r\n${composition}.`;
  }
};
