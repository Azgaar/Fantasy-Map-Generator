interface IProvince {
  i: number;
  name: string;
  burg: number;
  formName: string;
  fullName: string;
  color: Hex | CssUrls;
  state: number;
  center: number;
  coa: ICoa | string;
  removed?: boolean;
}

type TProvinces = IProvince[];
