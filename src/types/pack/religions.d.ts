interface IReligion {
  i: number;
  name: string;
  type: "Folk" | "Organized" | "Cult" | "Heresy";
  color: string;
  culture: number;
  form: any;
  deity: string | null;
  center: number;
  origins: number[];
  expansion?: "global" | "culture" | "state";
  expansionism: number;
  removed?: boolean;
}

type TNoReligion = {
  i: 0;
  name: "No religion";
};

type TReligions = [TNoReligion, ...IReligion[]];
