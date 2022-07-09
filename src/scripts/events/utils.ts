type TEmblemType = "state" | "burg" | "province";
type TEmblemTypeArray = IPack[`${TEmblemType}s`];

const emblemTypeMap: {[key: string]: [TEmblemTypeArray, TEmblemType]} = {
  burgEmblems: [pack.burgs, "burg"],
  provinceEmblems: [pack.provinces, "province"],
  stateEmblems: [pack.states, "state"]
};

export function defineEmblemData(el: HTMLElement) {
  const i = +(el.dataset?.i || 0);

  const emblemType = el.parentElement?.id;
  if (emblemType && emblemType in emblemTypeMap) {
    const [data, type] = emblemTypeMap[emblemType];
    return {type, id: type + "COA" + i, el: data[i]};
  }

  return undefined;
}
