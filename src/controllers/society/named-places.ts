// What names each kind of place that keeps a meaning: the model that stores its name, and what coins one

import { Features } from "@/model/physical/features-generator";
import { Rivers } from "@/model/physical/river-generator";
import { Burgs } from "@/model/political/burgs-generator";
import { Provinces } from "@/model/political/provinces-generator";
import { States } from "@/model/political/states-generator";
import { Names } from "@/model/society/names/names-generator";
import { type PlaceType, Toponyms } from "@/model/society/names/toponyms-generator";
import type { Named } from "@/types/names";

interface Naming {
  model: { setName(id: number, named: Named): void };
  find: (id: number) => Partial<Named>;
  /** A meaning that fits the place, and its name in a base */
  generate: (id: number, baseId: string) => Named;
  /** A proper name in a base */
  proper: (id: number, baseId: string) => string;
}

const byId = (id: number) => pack.rivers.find(({ i }) => i === id)!;
const sizeOf = (id: number) => States.getLandSize(pack.states[id].area);

export const NAMINGS: Record<PlaceType, Naming> = {
  burg: {
    model: Burgs,
    find: id => pack.burgs[id],
    generate: (id, baseId) => Toponyms.burg(pack.burgs[id], { baseId }),
    proper: (_, baseId) => Names.getBase(baseId)
  },
  state: {
    model: States,
    find: id => pack.states[id],
    generate: (id, baseId) => {
      const { capital, culture } = pack.states[id];
      return Toponyms.state(pack.burgs[capital], culture, { baseId, size: sizeOf(id) });
    },
    proper: (id, baseId) => Toponyms.land(baseId, sizeOf(id))
  },
  province: {
    model: Provinces,
    find: id => pack.provinces[id],
    generate: (_, baseId) => Toponyms.landOf(baseId),
    proper: (_, baseId) => Toponyms.land(baseId)
  },
  river: {
    model: Rivers,
    find: byId,
    generate: (id, baseId) => Toponyms.river(byId(id), { baseId }),
    proper: (_, baseId) => Names.getWater(baseId)
  },
  feature: {
    model: Features,
    find: id => pack.features[id],
    generate: (id, baseId) => {
      const feature = pack.features[id];
      return feature.type === "lake" ? Toponyms.lake(feature, { baseId }) : Toponyms.island(feature, { baseId });
    },
    proper: (id, baseId) => {
      const feature = pack.features[id];
      if (feature.type === "ocean") return Features.getOceanName(feature);
      return feature.type === "lake" ? Names.getWater(baseId) : Toponyms.land(baseId);
    }
  }
};
