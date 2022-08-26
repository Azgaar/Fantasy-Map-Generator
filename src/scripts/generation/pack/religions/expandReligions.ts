import FlatQueue from "flatqueue";
import {getInputNumber} from "utils/nodeUtils";
import {gauss} from "utils/probabilityUtils";
import {isReligion} from "utils/typeUtils";

type TReligionData = Pick<IReligion, "i" | "type" | "center" | "culture" | "expansion" | "expansionism">;
type TCellsData = Pick<IPack["cells"], "i" | "c" | "culture">;

export function expandReligions(religions: TReligionData[], cells: TCellsData) {
  const religionIds = spreadFolkReligions(religions, cells);

  const queue = new FlatQueue<{cellId: number; religionId: number}>();
  const cost: number[] = [];

  const neutralInput = getInputNumber("neutralInput");
  const maxExpansionCost = (cells.i.length / 25) * gauss(1, 0.3, 0.2, 2, 2) * neutralInput;

  for (const religion of religions) {
    if (!isReligion(religion as IReligion) || (religion as IReligion).type === "Folk") continue;

    const {i: religionId, center: cellId} = religion;
    religionIds[cellId] = religionId;
    cost[cellId] = 1;
    queue.push({cellId, religionId}, 0);
  }

  return religionIds;
}

// folk religions initially get all cells of their culture
function spreadFolkReligions(religions: TReligionData[], cells: TCellsData) {
  const religionIds = new Uint16Array(cells.i.length);

  const folkReligions = religions.filter(({type}) => type === "Folk");
  const cultureToReligionMap = new Map<number, number>(folkReligions.map(({i, culture}) => [culture, i]));

  for (const cellId of cells.i) {
    const cultureId = cells.culture[cellId];
    religionIds[cellId] = cultureToReligionMap.get(cultureId) || 0;
  }

  return religionIds;
}
