import {each, rw} from "utils/probabilityUtils";

const {Names} = window;

// weighted arrays of river type names
const riverTypes = {
  main: {
    big: {River: 1},
    small: {Creek: 9, River: 3, Brook: 3, Stream: 1}
  },
  fork: {
    big: {Fork: 1},
    small: {Branch: 1}
  }
};

export function specifyRivers(
  rawRivers: Omit<IRiver, "name" | "basin" | "type">[],
  cultureIds: Uint16Array,
  cultures: TCultures
): TRivers {
  const thresholdIndex = Math.ceil(rawRivers.length * 0.15);
  const smallLength = rawRivers.map(r => r.length).sort((a, b) => a - b)[thresholdIndex];

  const rivers: TRivers = rawRivers.map(river => {
    const basin = getBasin(rawRivers, river.i);
    const name = getName(river.mouth, cultureIds, cultures);
    const type = getType(smallLength, river.i, river.length, river.parent);

    return {...river, basin, name, type};
  });

  return rivers;
}

function getBasin(rivers: {i: number; parent: number}[], riverId: number): number {
  const parent = rivers.find(river => river.i === riverId)?.parent;
  if (!parent || riverId === parent) return riverId;
  return getBasin(rivers, parent);
}

const getName = function (cellId: number, cultureIds: Uint16Array, cultures: TCultures) {
  const culture = cultures[cultureIds[cellId]];
  const namebase = culture.base;
  return Names.getBase(namebase);
};

const getType = function (smallLength: number, riverId: number, length: number, parent: number) {
  const isSmall = length < smallLength;
  const isFork = parent && parent !== riverId && each(3)(riverId);
  return rw(riverTypes[isFork ? "fork" : "main"][isSmall ? "small" : "big"] as {[key: string]: number});
};
