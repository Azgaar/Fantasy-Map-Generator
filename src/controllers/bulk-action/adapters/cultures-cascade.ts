/**
 * Pure data cascade for removing a culture from `pack`: reassigns the culture's
 * burgs and the states that have it as dominant culture to the neutral culture,
 * releases its cells, drops it from other cultures' origin lists, and marks it
 * removed. No DOM/SVG side effects — the caller redraws. Mirrors the data mutations
 * of the Cultures editor's single-culture delete so bulk delete and single delete
 * share one cascade.
 */
export function removeCultureCascade(cultureId: number): void {
  const culture = pack.cultures[cultureId];
  if (!cultureId || !culture || culture.removed) return;

  // reassign the culture's burgs to the neutral culture
  pack.burgs.forEach(burg => {
    if (burg.culture === cultureId) burg.culture = 0;
  });

  // reassign states that have this culture as dominant to the neutral culture
  pack.states.forEach(state => {
    if (state.culture === cultureId) state.culture = 0;
  });

  // release the culture's cells
  pack.cells.culture.forEach((c: number, i: number) => {
    if (c === cultureId) pack.cells.culture[i] = 0;
  });

  culture.removed = true;

  // drop the removed culture from other cultures' origin lists
  pack.cultures.forEach(c => {
    if (!c.i || c.removed) return;
    c.origins = (c.origins ?? []).filter((origin: number | null) => origin !== cultureId);
    if (!c.origins.length) c.origins = [0];
  });
}
