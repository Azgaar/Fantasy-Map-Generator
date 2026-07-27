// The brush radius circle, drawn on #debug while a brush tool is active

/**
 * Show the brush radius circle at the given point, creating it if needed
 * @param {number} x - The x coordinate of the circle center
 * @param {number} y - The y coordinate of the circle center
 * @param {number} r - The circle radius
 */
export function moveCircle(x: number, y: number, r = 20): void {
  const circle = document.getElementById("brushCircle");

  if (!circle) {
    const html = /* html */ `<circle id="brushCircle" cx=${x} cy=${y} r=${r}></circle>`;
    document.getElementById("debug")?.insertAdjacentHTML("afterbegin", html);
    return;
  }

  circle.setAttribute("cx", String(x));
  circle.setAttribute("cy", String(y));
  circle.setAttribute("r", String(r));
}

/** Remove the brush radius circle */
export function removeCircle(): void {
  document.getElementById("brushCircle")?.remove();
}
