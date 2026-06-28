/**
 * Pure data cascade for removing a religion from `pack`: releases the religion's
 * cells to "no religion", drops it from other religions' origin lists, and marks it
 * removed. No DOM/SVG side effects — the caller redraws. Mirrors the data mutations
 * of the Religions editor's single-religion delete so bulk delete and single delete
 * share one cascade.
 */
export function removeReligionCascade(religionId: number): void {
  const religion = pack.religions[religionId];
  if (!religionId || !religion || religion.removed) return;

  // release the religion's cells to "no religion"
  pack.cells.religion.forEach((r: number, i: number) => {
    if (r === religionId) pack.cells.religion[i] = 0;
  });

  religion.removed = true;

  // drop the removed religion from other religions' origin lists
  pack.religions.forEach(r => {
    if (!r.i || r.removed) return;
    r.origins = (r.origins ?? []).filter((origin: number) => origin !== religionId);
    if (!r.origins.length) r.origins = [0];
  });
}
