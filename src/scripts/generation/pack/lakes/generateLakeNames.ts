const {Names} = window;

export function generateLakeNames(features: TPackFeatures, culture: UintArray, cultures: TCultures) {
  const updatedFeatures = features.map(feature => {
    if (feature === 0) return 0;
    if (feature.type !== "lake") return feature;

    const landCell = feature.shoreline[0];
    const cultureId = culture[landCell];
    const namebase = cultures[cultureId].base;

    const name: string = Names.getBase(namebase);
    return {...feature, name};
  });

  return updatedFeatures as TPackFeatures;
}
