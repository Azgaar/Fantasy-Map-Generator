interface IReligion {
  i: number;
  name: string;
  type: "Folk" | "Orgamized" | "Cult" | "Heresy";
  color: string;
  culture: number;
  form: any;
  deity: string | null;
  center: number;
  origins: number[];
  removed?: boolean;
}

type TNoReligion = {
  i: 0;
  name: string;
};

type TReligions = [TNoReligion, ...IReligion[]];
