// The model that stores the name of each kind of place that keeps a meaning; Toponyms knows the rest

import { Features } from "@/model/physical/features-generator";
import { Rivers } from "@/model/physical/river-generator";
import { Burgs } from "@/model/political/burgs-generator";
import { Provinces } from "@/model/political/provinces-generator";
import { States } from "@/model/political/states-generator";
import type { Named, PlaceType } from "@/types/names";

interface NamedModel {
  rename(id: number, name: string): void; // a proper name: the meaning is cleared
  setName(id: number, named: Named): void;
}

export const NAMED_MODELS: Record<PlaceType, NamedModel> = {
  burg: Burgs,
  state: States,
  province: Provinces,
  river: Rivers,
  feature: Features
};
